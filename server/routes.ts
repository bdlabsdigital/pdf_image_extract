import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, datalabResponseSchema, datalabResultSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";
import archiver from "archiver";
import sharp from "sharp";
import { Readable } from "stream";

// Extend Express Request type to include file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ storage: multer.memoryStorage() });

const DATALAB_API_KEY = process.env.DATALAB_API_KEY || "yNIcatEQ_AI3roU68t3GWecVSY6k48FpvuOUVTCTgT4";
const DATALAB_BASE_URL = "https://www.datalab.to/api/v1";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get recent processing jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getRecentJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Get specific job by ID with optional result checking
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // If job is processing and has a request ID, check for results
      if (job.status === "processing" && job.requestId) {
        try {
          const resultResponse = await axios.get(`${DATALAB_BASE_URL}/marker/${job.requestId}`, {
            headers: {
              "X-API-Key": DATALAB_API_KEY,
            },
          });

          const result = datalabResultSchema.parse(resultResponse.data);
          
          if (result.status === "completed" && result.success) {
            // Process the results
            const processedData = await processResults(result);
            
            const updatedJob = await storage.updateJob(id, {
              status: "completed",
              completedAt: new Date(),
              jsonResult: processedData.json,
              images: processedData.images,
              questionsFound: processedData.questionsFound,
              imagesExtracted: processedData.imagesExtracted,
              tablesConverted: processedData.tablesConverted,
            });
            
            return res.json(updatedJob);
          } else if (result.status === "failed") {
            const updatedJob = await storage.updateJob(id, {
              status: "failed",
              error: result.error || "Processing failed",
              completedAt: new Date(),
            });
            return res.json(updatedJob);
          }
        } catch (error: any) {
          console.log("Error checking job status:", error.message);
          // Don't fail the request, just return current job status
          if (error.response?.status === 429) {
            console.log("Rate limit hit while checking job status");
          }
        }
      }
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Upload PDF and start processing
  app.post("/api/process", upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const {
        pageRange,
        outputFormat = "json",
        useLlm = false,
        formatLines = false,
        forceOcr = false,
      } = req.body;

      // Create job record
      const job = await storage.createJob({
        filename: req.file.originalname,
        fileSize: req.file.size,
        status: "pending",
        pageRange: pageRange || null,
        outputFormat,
        useLlm: useLlm === "true",
        formatLines: formatLines === "true",
        forceOcr: forceOcr === "true",
        questionsFound: 0,
        imagesExtracted: 0,
        tablesConverted: 0,
        jsonResult: null,
        images: null,
        error: null,
      });

      // Start processing asynchronously
      processDocument(job.id, req.file.buffer, {
        pageRange,
        outputFormat,
        useLlm: useLlm === "true",
        formatLines: formatLines === "true",
        forceOcr: forceOcr === "true",
      });

      res.json({ jobId: job.id, status: "started" });
    } catch (error) {
      console.error("Error starting processing:", error);
      res.status(500).json({ error: "Failed to start processing" });
    }
  });

  // Download results as ZIP
  app.get("/api/jobs/:id/download", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "completed") {
        return res.status(400).json({ error: "Job not completed yet" });
      }

      // Create ZIP file
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${job.filename.replace('.pdf', '')}_results.zip"`);
      
      archive.pipe(res);

      // Add JSON file
      if (job.jsonResult) {
        archive.append(JSON.stringify(job.jsonResult, null, 2), { name: "questions.json" });
      }

      // Add images
      if (job.images) {
        const images = job.images as Record<string, string>;
        for (const [filename, base64Data] of Object.entries(images)) {
          try {
            const imageBuffer = Buffer.from(base64Data, "base64");
            const webpBuffer = await sharp(imageBuffer).webp().toBuffer();
            const webpFilename = filename.replace(/\.(png|jpg|jpeg)$/i, ".webp");
            archive.append(webpBuffer, { name: `images/${webpFilename}` });
          } catch (error) {
            console.error("Error converting image:", error);
          }
        }
      }

      archive.finalize();
    } catch (error) {
      console.error("Error creating download:", error);
      res.status(500).json({ error: "Failed to create download" });
    }
  });

  // Manual result check endpoint
  app.post("/api/jobs/:id/check", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.status !== "processing" || !job.requestId) {
        return res.json({ message: "Job is not in processing state", job });
      }
      
      try {
        const resultResponse = await axios.get(`${DATALAB_BASE_URL}/marker/${job.requestId}`, {
          headers: {
            "X-API-Key": DATALAB_API_KEY,
          },
        });

        const result = datalabResultSchema.parse(resultResponse.data);
        
        if (result.status === "completed" && result.success) {
          const processedData = await processResults(result);
          
          const updatedJob = await storage.updateJob(id, {
            status: "completed",
            completedAt: new Date(),
            jsonResult: processedData.json,
            images: processedData.images,
            questionsFound: processedData.questionsFound,
            imagesExtracted: processedData.imagesExtracted,
            tablesConverted: processedData.tablesConverted,
          });
          
          return res.json({ message: "Job completed successfully", job: updatedJob });
        } else if (result.status === "failed") {
          const updatedJob = await storage.updateJob(id, {
            status: "failed",
            error: result.error || "Processing failed",
            completedAt: new Date(),
          });
          return res.json({ message: "Job failed", job: updatedJob });
        } else {
          return res.json({ message: "Job still processing", status: result.status });
        }
      } catch (error: any) {
        if (error.response?.status === 429) {
          return res.status(429).json({ error: "Rate limit reached. Please wait before checking again." });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error checking job manually:", error);
      res.status(500).json({ error: "Failed to check job status" });
    }
  });

  // Check API health
  app.get("/api/health", async (req, res) => {
    try {
      const response = await axios.get(`${DATALAB_BASE_URL}/user_health`, {
        headers: {
          "X-API-Key": DATALAB_API_KEY,
        },
      });
      res.json({ status: "connected", datalab: response.data });
    } catch (error) {
      res.status(500).json({ status: "error", error: "Failed to connect to Datalab API" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processDocument(
  jobId: number,
  fileBuffer: Buffer,
  options: {
    pageRange?: string;
    outputFormat: string;
    useLlm: boolean;
    formatLines: boolean;
    forceOcr: boolean;
  }
) {
  try {
    await storage.updateJob(jobId, { status: "processing" });

    // Create form data for Datalab API
    const formData = new FormData();
    formData.append("file", fileBuffer, { filename: "document.pdf" });
    
    if (options.pageRange) {
      formData.append("page_range", options.pageRange);
    }
    
    formData.append("output_format", options.outputFormat);
    formData.append("use_llm", options.useLlm.toString());
    formData.append("format_lines", options.formatLines.toString());
    formData.append("force_ocr", options.forceOcr.toString());
    formData.append("disable_image_extraction", "false");

    // Submit to Datalab Marker API
    const submitResponse = await axios.post(`${DATALAB_BASE_URL}/marker`, formData, {
      headers: {
        "X-API-Key": DATALAB_API_KEY,
        ...formData.getHeaders(),
      },
    });

    console.log("Raw Datalab response:", JSON.stringify(submitResponse.data, null, 2));

    let submitResult;
    try {
      submitResult = datalabResponseSchema.parse(submitResponse.data);
    } catch (validationError: any) {
      console.error("Schema validation failed:", validationError);
      console.error("Raw response data:", submitResponse.data);
      throw new Error(`Invalid API response format: ${validationError.message}`);
    }
    
    if (!submitResult.success) {
      throw new Error(submitResult.error || "Failed to submit to Datalab API");
    }

    await storage.updateJob(jobId, { requestId: submitResult.request_id });

    // Store job as pending - let frontend poll for results instead
    await storage.updateJob(jobId, { 
      status: "processing",
      requestId: submitResult.request_id 
    });

    // Return immediately - frontend will poll for completion
    return;
  } catch (error) {
    console.error("Error processing document:", error);
    await storage.updateJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date(),
    });
  }
}

async function processResults(result: any) {
  const processedData = {
    json: null as any,
    images: {} as Record<string, string>,
    questionsFound: 0,
    imagesExtracted: 0,
    tablesConverted: 0,
  };

  // Process JSON/markdown content to extract questions
  if (result.json || result.markdown) {
    const content = result.json || result.markdown;
    
    // Parse content to extract math questions
    const questions = await parseQuestionsFromContent(content);
    processedData.json = { questions };
    processedData.questionsFound = questions.length;
  }

  // Process images
  if (result.images) {
    processedData.images = result.images;
    processedData.imagesExtracted = Object.keys(result.images).length;
  }

  // Count tables (approximation based on content)
  if (result.html) {
    const tableMatches = result.html.match(/<table/g);
    processedData.tablesConverted = tableMatches ? tableMatches.length : 0;
  }

  return processedData;
}

async function parseQuestionsFromContent(content: string): Promise<any[]> {
  const questions: any[] = [];
  
  // Parse the content based on your JSON structure
  let lines: string[] = [];
  
  if (typeof content === 'string') {
    lines = content.split('\n');
  } else if (content && typeof content === 'object') {
    // If content is already parsed JSON/object, extract text
    if ((content as any).markdown) {
      lines = (content as any).markdown.split('\n');
    } else {
      lines = JSON.stringify(content, null, 2).split('\n');
    }
  }

  let currentQuestion: any = null;
  let questionId = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect question start - more flexible pattern matching
    const questionMatch = trimmed.match(/^(\d+)\.?\s*(.+)$/);
    if (questionMatch) {
      // Save previous question
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      
      // Start new question with structure matching your JSON
      currentQuestion = {
        id: `q${questionId}`,
        text: questionMatch[2], // Question text without number
        type: 0, // Default to MCQ type
        mcqOptions: [], // Will be populated if options are found
        correctAnswer: null,
        marks: 1,
        explanation: "",
        topicId: "general",
        images: [],
        tables: [],
      };
      questionId++;
    } else if (currentQuestion) {
      // Look for MCQ options (A), (B), (C), (D) or 1), 2), 3), 4)
      const optionMatch = trimmed.match(/^[(\[]?([A-D]|[1-4])[)\]]?\s*(.+)$/);
      if (optionMatch) {
        currentQuestion.mcqOptions.push({
          id: optionMatch[1],
          text: optionMatch[2]
        });
      } else if (trimmed.length > 0 && !trimmed.startsWith('Answer:') && !trimmed.startsWith('Explanation:')) {
        // Continue building question text
        currentQuestion.text += " " + trimmed;
      }
    }
  }

  // Add last question
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}
