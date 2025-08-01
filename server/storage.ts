import { processingJobs, type ProcessingJob, type InsertJob } from "@shared/schema";

export interface IStorage {
  createJob(job: InsertJob): Promise<ProcessingJob>;
  getJob(id: number): Promise<ProcessingJob | undefined>;
  updateJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob | undefined>;
  getRecentJobs(limit?: number): Promise<ProcessingJob[]>;
  deleteJob(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private jobs: Map<number, ProcessingJob>;
  private currentId: number;

  constructor() {
    this.jobs = new Map();
    this.currentId = 1;
  }

  async createJob(insertJob: InsertJob): Promise<ProcessingJob> {
    const id = this.currentId++;
    const job: ProcessingJob = {
      ...insertJob,
      id,
      status: insertJob.status || "pending",
      error: insertJob.error || null,
      requestId: insertJob.requestId || null,
      pageRange: insertJob.pageRange || null,
      outputFormat: insertJob.outputFormat || null,
      useLlm: insertJob.useLlm || null,
      formatLines: insertJob.formatLines || null,
      forceOcr: insertJob.forceOcr || null,
      questionsFound: insertJob.questionsFound || null,
      imagesExtracted: insertJob.imagesExtracted || null,
      tablesConverted: insertJob.tablesConverted || null,
      jsonResult: insertJob.jsonResult || null,
      images: insertJob.images || null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(id: number): Promise<ProcessingJob | undefined> {
    return this.jobs.get(id);
  }

  async updateJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async getRecentJobs(limit: number = 10): Promise<ProcessingJob[]> {
    return Array.from(this.jobs.values())
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  async deleteJob(id: number): Promise<boolean> {
    return this.jobs.delete(id);
  }
}

export const storage = new MemStorage();
