export interface ProcessingOptions {
  pageRange: string;
  outputFormat: string;
  useLlm: boolean;
  formatLines: boolean;
  forceOcr: boolean;
}

export interface Question {
  id: string;
  type: string;
  question_text: string;
  options?: string[];
  correct_answer?: string;
  answer_format?: string;
  difficulty: string;
  topic: string;
  images: string[];
  tables: string[];
}

export interface ProcessingResult {
  questions: Question[];
}

export interface ApiHealthResponse {
  status: string;
  datalab?: any;
}
