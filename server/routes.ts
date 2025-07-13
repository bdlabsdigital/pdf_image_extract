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

// Adobe PDF Services configuration
const ADOBE_CLIENT_ID = process.env.ADOBE_CLIENT_ID;
const ADOBE_CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET;

// Intelligent image filtering function for math content
async function isRelevantMathImage(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<boolean> {
  const { width = 0, height = 0 } = metadata;
  
  // Filter 1: Minimum size requirements for meaningful diagrams
  if (width < 120 || height < 120) {
    return false; // Too small to be meaningful math diagrams
  }
  
  // Filter 2: Aspect ratio filtering (avoid very thin lines or decorative elements)
  const aspectRatio = width / height;
  if (aspectRatio > 8 || aspectRatio < 0.2) {
    return false; // Likely lines, headers, or decorative elements
  }
  
  // Filter 3: Area-based filtering - only large diagrams
  const area = width * height;
  if (area < 20000) {
    return false; // Too small area for meaningful math diagrams
  }
  
  // Filter 4: Analyze content complexity and characteristics
  try {
    // Convert to grayscale for analysis
    const grayscaleBuffer = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = new Uint8Array(grayscaleBuffer.data);
    const totalPixels = pixels.length;
    
    // Calculate edge density (indicates complexity)
    let edgeCount = 0;
    const threshold = 25; // Edge detection threshold
    
    for (let i = 0; i < pixels.length - width; i++) {
      if (Math.abs(pixels[i] - pixels[i + 1]) > threshold || 
          Math.abs(pixels[i] - pixels[i + width]) > threshold) {
        edgeCount++;
      }
    }
    
    const edgeDensity = edgeCount / totalPixels;
    
    // Calculate variance (indicates content diversity)
    let sum = 0;
    for (let i = 0; i < pixels.length; i++) {
      sum += pixels[i];
    }
    const mean = sum / totalPixels;
    
    let variance = 0;
    for (let i = 0; i < pixels.length; i++) {
      variance += Math.pow(pixels[i] - mean, 2);
    }
    variance = variance / totalPixels;
    
    // Filter 5: Detect circular patterns (logos, stamps)
    const isCircular = await detectCircularPattern(pixels, width, height);
    if (isCircular) {
      return false; // Reject circular logos and stamps
    }
    
    // Filter 6: Detect table patterns (regular grid structures)
    const isTable = await detectTablePattern(pixels, width, height);
    if (isTable) {
      return false; // Reject table images (should be HTML)
    }
    
    // Filter 7: Detect simple text patterns (low complexity, high uniformity)
    const isSimpleText = edgeDensity < 0.03 && variance < 150;
    if (isSimpleText) {
      return false; // Reject simple text elements
    }
    
    // Filter 8: Detect grid/chart patterns (line graphs, bar charts)
    const hasChartPattern = await detectChartPattern(pixels, width, height);
    
    // Filter 9: Only accept very specific mathematical content
    const hasVeryHighComplexity = edgeDensity > 0.08 && variance > 500;
    const hasExtremelyLargeArea = area >= 60000;
    const hasGoodAspect = aspectRatio >= 0.5 && aspectRatio <= 2.5;
    
    // ULTRA STRICT: Only accept geometric tools and complex charts
    if (hasExtremelyLargeArea && hasVeryHighComplexity && hasGoodAspect) {
      return true; // Only very large, very complex geometric diagrams
    }
    
    if (hasChartPattern && area >= 40000 && edgeDensity > 0.06) {
      return true; // Line graphs and mathematical charts
    }
    
    return false; // Reject everything else
    
  } catch (error) {
    console.error('Error analyzing image complexity:', error);
    // Fall back to very conservative filtering
    return area >= 40000 && aspectRatio >= 0.4 && aspectRatio <= 3.0;
  }
}

// Helper function to detect circular patterns (logos, stamps)
async function detectCircularPattern(pixels: Uint8Array, width: number, height: number): Promise<boolean> {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const radius = Math.min(width, height) / 3;
  
  let circularEdges = 0;
  let totalChecked = 0;
  
  // Check for circular edge patterns
  for (let angle = 0; angle < 360; angle += 10) {
    const x = centerX + Math.cos(angle * Math.PI / 180) * radius;
    const y = centerY + Math.sin(angle * Math.PI / 180) * radius;
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const pixelIndex = Math.floor(y) * width + Math.floor(x);
      if (pixelIndex < pixels.length - 1) {
        const edgeStrength = Math.abs(pixels[pixelIndex] - pixels[pixelIndex + 1]);
        if (edgeStrength > 30) {
          circularEdges++;
        }
        totalChecked++;
      }
    }
  }
  
  // If more than 60% of circular samples have edges, likely a circular logo
  return totalChecked > 0 && (circularEdges / totalChecked) > 0.6;
}

// Helper function to detect table patterns (regular grid structures)
async function detectTablePattern(pixels: Uint8Array, width: number, height: number): Promise<boolean> {
  let horizontalLines = 0;
  let verticalLines = 0;
  
  // Check for horizontal lines
  for (let y = 0; y < height; y += 10) {
    let lineStrength = 0;
    for (let x = 0; x < width - 1; x++) {
      const pixelIndex = y * width + x;
      if (pixelIndex < pixels.length - 1) {
        const edgeStrength = Math.abs(pixels[pixelIndex] - pixels[pixelIndex + 1]);
        if (edgeStrength > 20) {
          lineStrength++;
        }
      }
    }
    if (lineStrength > width * 0.3) {
      horizontalLines++;
    }
  }
  
  // Check for vertical lines
  for (let x = 0; x < width; x += 10) {
    let lineStrength = 0;
    for (let y = 0; y < height - 1; y++) {
      const pixelIndex = y * width + x;
      const belowIndex = (y + 1) * width + x;
      if (belowIndex < pixels.length) {
        const edgeStrength = Math.abs(pixels[pixelIndex] - pixels[belowIndex]);
        if (edgeStrength > 20) {
          lineStrength++;
        }
      }
    }
    if (lineStrength > height * 0.3) {
      verticalLines++;
    }
  }
  
  // If we have multiple horizontal and vertical lines, likely a table
  return horizontalLines >= 3 && verticalLines >= 2;
}

// Helper function to detect chart patterns (line graphs, bar charts)
async function detectChartPattern(pixels: Uint8Array, width: number, height: number): Promise<boolean> {
  let lineConnections = 0;
  let curveSegments = 0;
  
  // Look for diagonal lines and curves (characteristic of line graphs)
  for (let y = 1; y < height - 1; y += 5) {
    for (let x = 1; x < width - 1; x += 5) {
      const centerIndex = y * width + x;
      if (centerIndex < pixels.length) {
        const center = pixels[centerIndex];
        const left = pixels[centerIndex - 1];
        const right = pixels[centerIndex + 1];
        const top = pixels[(y - 1) * width + x];
        const bottom = pixels[(y + 1) * width + x];
        
        // Check for diagonal connections (line graph characteristics)
        if (Math.abs(center - left) > 20 && Math.abs(center - right) > 20) {
          lineConnections++;
        }
        
        // Check for smooth curves
        if (Math.abs(center - top) > 15 && Math.abs(center - bottom) > 15) {
          curveSegments++;
        }
      }
    }
  }
  
  const totalSamples = Math.floor((height / 5) * (width / 5));
  const lineRatio = lineConnections / totalSamples;
  const curveRatio = curveSegments / totalSamples;
  
  // Chart patterns have connected lines and smooth curves
  return lineRatio > 0.02 || curveRatio > 0.03;
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
    const credentials = new ServicePrincipalCredentials({
      clientId: ADOBE_CLIENT_ID!,
      clientSecret: ADOBE_CLIENT_SECRET!
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
  
  // Process figures directory with intelligent filtering
  const figuresDir = path.join(extractDir, 'figures');
  if (fs.existsSync(figuresDir)) {
    const imageFiles = fs.readdirSync(figuresDir).filter(f => f.endsWith('.png'));
    for (const imageFile of imageFiles) {
      const imagePath = path.join(figuresDir, imageFile);
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Filter out unwanted images using intelligent criteria
      const imageInfo = await sharp(imageBuffer).metadata();
      const isQualityImage = await isRelevantMathImage(imageBuffer, imageInfo);
      
      if (!isQualityImage) {
        console.log(`Filtered out: ${imageFile} (not relevant math content)`);
        continue;
      }
      
      // Enhanced image processing with better quality settings
      const webpBuffer = await sharp(imageBuffer)
        .extend({
          top: Math.max(20, Math.floor(imageInfo.height! * 0.05)),
          bottom: Math.max(20, Math.floor(imageInfo.height! * 0.05)),
          left: Math.max(20, Math.floor(imageInfo.width! * 0.05)),
          right: Math.max(20, Math.floor(imageInfo.width! * 0.05)),
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .sharpen({
          sigma: 0.5,
          m1: 1.0,
          m2: 2.0,
          x1: 2.0,
          y2: 10.0,
          y3: 20.0
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
      
      // Filter out unwanted table images using intelligent criteria
      const tableInfo = await sharp(tableBuffer).metadata();
      const isQualityImage = await isRelevantMathImage(tableBuffer, tableInfo);
      
      if (!isQualityImage) {
        console.log(`Filtered out: ${tableImageFile} (not relevant math content)`);
        continue;
      }
      
      // Enhanced processing for table images
      const webpBuffer = await sharp(tableBuffer)
        .extend({
          top: Math.max(15, Math.floor(tableInfo.height! * 0.03)),
          bottom: Math.max(15, Math.floor(tableInfo.height! * 0.03)),
          left: Math.max(15, Math.floor(tableInfo.width! * 0.03)),
          right: Math.max(15, Math.floor(tableInfo.width! * 0.03)),
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .sharpen({
          sigma: 0.5,
          m1: 1.0,
          m2: 2.0,
          x1: 2.0,
          y2: 10.0,
          y3: 20.0
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


