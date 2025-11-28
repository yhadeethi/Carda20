export interface OCRResult {
  rawText: string;
  confidence?: number;
  error?: string;
}

export interface OCRProvider {
  name: string;
  extractText(imageBase64: string): Promise<OCRResult>;
}
