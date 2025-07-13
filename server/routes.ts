import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import archiver from "archiver";
import sharp from "sharp";

import fs from "fs";
import path from "path";
import { 
  ServicePrincipalCredentials, 
  PDFServices, 
  MimeType, 
  ExtractPDFParams, 
  ExtractElementType, 
  ExtractPDFJob,
  ExtractPDFResult,
  StreamAsset
} from "@adobe/pdfservices-node-sdk";
import extract from "extract-zip";

// Extend Express Request type to include file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ storage: multer.memoryStorage() });

// Adobe PDF Services configuration
const ADOBE_CLIENT_ID = process.env.ADOBE_CLIENT_ID;
const ADOBE_CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET;

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
      
      // Adobe PDF Services processes synchronously, so no polling needed
      
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

      // Start processing asynchronously with Adobe PDF Services
      processDocumentWithAdobe(job.id, req.file.buffer, req.file.originalname, {
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



  // Check API health
  app.get("/api/health", async (req, res) => {
    try {
      // Check if Adobe credentials are configured
      if (ADOBE_CLIENT_ID && ADOBE_CLIENT_SECRET) {
        res.json({ 
          status: "connected", 
          adobe: { status: "ok", message: "Adobe PDF Services configured" }
        });
      } else {
        res.json({ 
          status: "error", 
          adobe: { status: "error", message: "Adobe PDF Services not configured" }
        });
      }
    } catch (error) {
      res.status(500).json({ status: "error", error: "Health check failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processDocumentWithAdobe(
  jobId: number,
  fileBuffer: Buffer,
  filename: string,
  options: {
    pageRange: string;
    outputFormat: string;
    useLlm: boolean;
    formatLines: boolean;
    forceOcr: boolean;
  }
) {
  try {
    await storage.updateJob(jobId, { status: "processing" });

    // Create temporary file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `${jobId}_${filename}`);
    fs.writeFileSync(tempFile, fileBuffer);

    // Initialize Adobe PDF Services
    const credentials = new ServicePrincipalCredentials({
      clientId: ADOBE_CLIENT_ID!,
      clientSecret: ADOBE_CLIENT_SECRET!
    });

    const pdfServices = new PDFServices({ credentials });

    // Create parameters for extraction
    const params = new ExtractPDFParams({
      elementsToExtract: [
        ExtractElementType.TEXT,
        ExtractElementType.TABLES,
        ExtractElementType.IMAGES
      ]
    });

    // Create asset from file
    const inputAsset = await pdfServices.upload({
      readStream: fs.createReadStream(tempFile),
      mimeType: MimeType.PDF
    });

    // Create the job
    const job = new ExtractPDFJob({ inputAsset, params });

    // Execute the operation
    const pollingURL = await pdfServices.submit({ job });
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult
    });

    // Download the result
    const resultAsset = pdfServicesResponse.result.resource;
    const resultPath = path.join(tempDir, `${jobId}_result.zip`);
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // Save to file
    const writeStream = fs.createWriteStream(resultPath);
    streamAsset.readStream.pipe(writeStream);
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Process the result
    const processedData = await processAdobeResults(resultPath, jobId);

    // Update job with results
    await storage.updateJob(jobId, {
      status: "completed",
      completedAt: new Date(),
      jsonResult: processedData.json,
      images: processedData.images,
      questionsFound: processedData.questionsFound,
      imagesExtracted: processedData.imagesExtracted,
      tablesConverted: processedData.tablesConverted,
    });

    // Clean up temp files
    fs.unlinkSync(tempFile);
    fs.unlinkSync(resultPath);

  } catch (error) {
    console.error("Error processing document with Adobe:", error);
    await storage.updateJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date(),
    });
  }
}

async function processAdobeResults(resultZipPath: string, jobId: number) {
  // Extract ZIP file
  const extractDir = path.join(process.cwd(), 'temp', `extracted_${jobId}`);
  await extract(resultZipPath, { dir: extractDir });

  // Read the JSON file
  const jsonFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.json'));
  if (jsonFiles.length === 0) {
    throw new Error("No JSON file found in extraction results");
  }

  const jsonContent = JSON.parse(fs.readFileSync(path.join(extractDir, jsonFiles[0]), 'utf8'));
  
  // Process images
  const images: Record<string, string> = {};
  const figuresDir = path.join(extractDir, 'figures');
  let imagesExtracted = 0;
  
  if (fs.existsSync(figuresDir)) {
    const imageFiles = fs.readdirSync(figuresDir).filter(f => f.endsWith('.png'));
    for (const imageFile of imageFiles) {
      const imagePath = path.join(figuresDir, imageFile);
      const imageBuffer = fs.readFileSync(imagePath);
      const webpBuffer = await sharp(imageBuffer).webp().toBuffer();
      images[imageFile.replace('.png', '.webp')] = webpBuffer.toString('base64');
      imagesExtracted++;
    }
  }

  // Parse questions from extracted text
  const questions = await parseQuestionsFromAdobeContent(jsonContent);

  // Clean up extraction directory
  fs.rmSync(extractDir, { recursive: true, force: true });

  return {
    json: { questions },
    images,
    questionsFound: questions.length,
    imagesExtracted,
    tablesConverted: jsonContent.elements?.filter((e: any) => e.type === 'table')?.length || 0,
  };
}

async function parseQuestionsFromAdobeContent(content: any): Promise<any[]> {
  const questions: any[] = [];
  
  // Adobe PDF Extract provides structured content with elements
  const elements = content.elements || [];
  
  let currentQuestion: any = null;
  let questionCounter = 1;
  
  for (const element of elements) {
    if (element.type === 'paragraph' || element.type === 'heading') {
      const text = element.text || '';
      
      // Look for question patterns (numbered questions)
      const questionMatch = text.match(/^(\d+)\.?\s*(.+)/);
      if (questionMatch) {
        // Save previous question if exists
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        // Start new question
        currentQuestion = {
          id: `q${questionCounter++}`,
          type: "math",
          question_text: questionMatch[2].trim(),
          difficulty: "medium",
          topic: "mathematics",
          images: [],
          tables: [],
          options: [],
          correct_answer: null,
          answer_format: "text"
        };
      } else if (currentQuestion && text.trim()) {
        // Add to current question text
        currentQuestion.question_text += " " + text.trim();
      }
    }
    
    // Handle tables
    if (element.type === 'table' && currentQuestion) {
      const tableHtml = convertTableToHtml(element);
      currentQuestion.tables.push(tableHtml);
    }
    
    // Handle figures/images
    if (element.type === 'figure' && currentQuestion) {
      const figurePath = element.path || `figure_${element.id || Math.random()}.png`;
      currentQuestion.images.push(figurePath);
    }
  }
  
  // Add the last question
  if (currentQuestion) {
    questions.push(currentQuestion);
  }
  
  return questions;
}

function convertTableToHtml(tableElement: any): string {
  if (!tableElement.cells) return '';
  
  let html = '<table>';
  const rows = tableElement.cells;
  
  for (const row of rows) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td>${cell.text || ''}</td>`;
    }
    html += '</tr>';
  }
  
  html += '</table>';
  return html;
}


