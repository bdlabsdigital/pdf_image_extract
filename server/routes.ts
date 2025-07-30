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
  ExtractRenditionsElementType,
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

// Adobe PDF Services configuration - lazy loaded to ensure dotenv is initialized
function getAdobeCredentials() {
  return {
    clientId: process.env.ADOBE_CLIENT_ID,
    clientSecret: process.env.ADOBE_CLIENT_SECRET
  };
}

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

      // Validate file type
      if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: "Only PDF files are supported. Please upload a PDF file." });
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
      const { clientId, clientSecret } = getAdobeCredentials();
      
      // Debug: Log the environment variables (without exposing full values)
      console.log("ADOBE_CLIENT_ID exists:", !!clientId);
      console.log("ADOBE_CLIENT_SECRET exists:", !!clientSecret);
      console.log("ADOBE_CLIENT_ID length:", clientId?.length || 0);
      console.log("ADOBE_CLIENT_SECRET length:", clientSecret?.length || 0);
      
      // Check if Adobe credentials are configured
      if (clientId && clientSecret) {
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
  let readStream: fs.ReadStream | null = null;
  
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
    const { clientId, clientSecret } = getAdobeCredentials();
    const credentials = new ServicePrincipalCredentials({
      clientId: clientId!,
      clientSecret: clientSecret!
    });

    const pdfServices = new PDFServices({ credentials });

    // Create parameters for extraction with improved settings
    const params = new ExtractPDFParams({
      elementsToExtract: [
        ExtractElementType.TEXT,
        ExtractElementType.TABLES
      ],
      elementsToExtractRenditions: [
        ExtractRenditionsElementType.FIGURES,
        ExtractRenditionsElementType.TABLES
      ]
    });

    // Create asset from file
    readStream = fs.createReadStream(tempFile);
    const inputAsset = await pdfServices.upload({
      readStream,
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
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // Save to file
    const resultPath = path.join(tempDir, `${jobId}_result.zip`);
    const writeStream = fs.createWriteStream(resultPath);
    streamAsset.readStream.pipe(writeStream);
    
    // Wait for write to complete
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
  } finally {
    // Clean up the read stream
    readStream?.destroy();
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
  
  // Process images with enhanced quality settings
  const images: Record<string, string> = {};
  let imagesExtracted = 0;
  
  // Process figures directory
  const figuresDir = path.join(extractDir, 'figures');
  if (fs.existsSync(figuresDir)) {
    const imageFiles = fs.readdirSync(figuresDir).filter(f => f.endsWith('.png'));
    for (const imageFile of imageFiles) {
      const imagePath = path.join(figuresDir, imageFile);
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Enhanced image processing with upscaling for better quality
      const imageInfo = await sharp(imageBuffer).metadata();
      console.log(`Original image size: ${imageInfo.width}x${imageInfo.height} (${imageFile})`);
      
      // Calculate upscale factor only for very small images
      const minDesiredWidth = 400;
      const minDesiredHeight = 300;
      const scaleFactorX = imageInfo.width! < minDesiredWidth ? minDesiredWidth / imageInfo.width! : 1;
      const scaleFactorY = imageInfo.height! < minDesiredHeight ? minDesiredHeight / imageInfo.height! : 1;
      const scaleFactor = Math.max(scaleFactorX, scaleFactorY, 1); // Only upscale if needed
      
      const targetWidth = Math.round(imageInfo.width! * scaleFactor);
      const targetHeight = Math.round(imageInfo.height! * scaleFactor);
      
      console.log(`Upscaling to: ${targetWidth}x${targetHeight} (${scaleFactor}x)`);
      
      let processedImage = sharp(imageBuffer);
      
      // Only resize if upscaling is needed
      if (scaleFactor > 1) {
        processedImage = processedImage.resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false,
          fastShrinkOnLoad: false
        });
      }
      
      const webpBuffer = await processedImage
        .extend({
          top: Math.max(30, Math.floor(targetHeight * 0.03)),
          bottom: Math.max(30, Math.floor(targetHeight * 0.03)),
          left: Math.max(30, Math.floor(targetWidth * 0.03)),
          right: Math.max(30, Math.floor(targetWidth * 0.03)),
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .sharpen({
          sigma: 0.8,
          m1: 1.2,
          m2: 2.5,
          x1: 2.0,
          y2: 10.0,
          y3: 20.0
        })
        .modulate({
          brightness: 1.02,
          saturation: 1.05,
          hue: 0
        })
        .gamma(1.1)
        .normalize()
        .webp({ 
          quality: 95,
          effort: 6,
          smartSubsample: false,
          nearLossless: true
        })
        .toBuffer();
      
      images[imageFile.replace('.png', '.webp')] = webpBuffer.toString('base64');
      imagesExtracted++;
    }
  }
  
  // Also process table renditions which might contain visual elements
  const tablesDir = path.join(extractDir, 'tables');
  if (fs.existsSync(tablesDir)) {
    const tableImageFiles = fs.readdirSync(tablesDir).filter(f => f.endsWith('.png'));
    for (const tableImageFile of tableImageFiles) {
      const tablePath = path.join(tablesDir, tableImageFile);
      const tableBuffer = fs.readFileSync(tablePath);
      
      // Enhanced processing for table images with upscaling
      const tableInfo = await sharp(tableBuffer).metadata();
      console.log(`Original table image size: ${tableInfo.width}x${tableInfo.height} (${tableImageFile})`);
      
      // Calculate upscale factor only for very small table images
      const minDesiredWidth = 500;
      const minDesiredHeight = 300;
      const scaleFactorX = tableInfo.width! < minDesiredWidth ? minDesiredWidth / tableInfo.width! : 1;
      const scaleFactorY = tableInfo.height! < minDesiredHeight ? minDesiredHeight / tableInfo.height! : 1;
      const scaleFactor = Math.max(scaleFactorX, scaleFactorY, 1); // Only upscale if needed
      
      const targetWidth = Math.round(tableInfo.width! * scaleFactor);
      const targetHeight = Math.round(tableInfo.height! * scaleFactor);
      
      console.log(`Upscaling table to: ${targetWidth}x${targetHeight} (${scaleFactor}x)`);
      
      let processedTable = sharp(tableBuffer);
      
      // Only resize if upscaling is needed
      if (scaleFactor > 1) {
        processedTable = processedTable.resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false,
          fastShrinkOnLoad: false
        });
      }
      
      const webpBuffer = await processedTable
        .extend({
          top: Math.max(25, Math.floor(targetHeight * 0.02)),
          bottom: Math.max(25, Math.floor(targetHeight * 0.02)),
          left: Math.max(25, Math.floor(targetWidth * 0.02)),
          right: Math.max(25, Math.floor(targetWidth * 0.02)),
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .sharpen({
          sigma: 0.8,
          m1: 1.2,
          m2: 2.5,
          x1: 2.0,
          y2: 10.0,
          y3: 20.0
        })
        .modulate({
          brightness: 1.02,
          saturation: 1.05,
          hue: 0
        })
        .gamma(1.1)
        .normalize()
        .webp({ 
          quality: 95,
          effort: 6,
          smartSubsample: false,
          nearLossless: true
        })
        .toBuffer();
      
      images[tableImageFile.replace('.png', '.webp')] = webpBuffer.toString('base64');
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


