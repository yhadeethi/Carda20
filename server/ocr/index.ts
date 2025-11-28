import { OCRProvider, OCRResult } from "./types";
import { OCRSpaceProvider } from "./ocrspace-provider";

export { OCRResult, OCRProvider };

let currentProvider: OCRProvider | null = null;

export function initializeOCR(): void {
  const ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;
  
  if (ocrSpaceApiKey) {
    currentProvider = new OCRSpaceProvider(ocrSpaceApiKey);
    console.log("OCR initialized with OCR.space provider");
  } else {
    console.warn("OCR_SPACE_API_KEY not set - OCR functionality will be unavailable");
  }
}

export function getOCRProvider(): OCRProvider | null {
  return currentProvider;
}

export async function extractTextFromImage(imageBase64: string): Promise<OCRResult> {
  if (!currentProvider) {
    return {
      rawText: "",
      error: "OCR provider not configured. Please set OCR_SPACE_API_KEY.",
    };
  }
  
  return currentProvider.extractText(imageBase64);
}
