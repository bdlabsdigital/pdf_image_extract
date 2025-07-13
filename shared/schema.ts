import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  requestId: text("request_id"),
  pageRange: text("page_range"),
  outputFormat: text("output_format").default("json"),
  useLlm: boolean("use_llm").default(false),
  formatLines: boolean("format_lines").default(false),
  forceOcr: boolean("force_ocr").default(false),
  questionsFound: integer("questions_found").default(0),
  imagesExtracted: integer("images_extracted").default(0),
  tablesConverted: integer("tables_converted").default(0),
  jsonResult: json("json_result"),
  images: json("images"), // Store image data as JSON
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
});

export const insertJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type ProcessingJob = typeof processingJobs.$inferSelect;

// Types for API responses
export const datalabResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  request_id: z.string(),
  request_check_url: z.string(),
  versions: z.record(z.any()).optional(),
});

export const datalabResultSchema = z.object({
  status: z.string(),
  output_format: z.string().optional(),
  json: z.record(z.any()).optional(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  images: z.record(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  success: z.boolean(),
  error: z.string().optional(),
  page_count: z.number().optional(),
  total_cost: z.number().optional(),
  runtime: z.number().optional(),
});

export type DatalabResponse = z.infer<typeof datalabResponseSchema>;
export type DatalabResult = z.infer<typeof datalabResultSchema>;

// Question structure to match your JSON format
export const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.number(), // 0 = MCQ, 1 = Open-ended
  mcqOptions: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).optional(),
  correctAnswer: z.string().optional(),
  marks: z.number().optional(),
  explanation: z.string().optional(),
  topicId: z.string().optional(),
  images: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  questionImageSvg: z.string().optional(),
  konvaScript: z.string().optional(),
  konvaWidth: z.number().optional(),
  konvaHeight: z.number().optional(),
  chartData: z.record(z.any()).optional(),
});

export type Question = z.infer<typeof questionSchema>;
