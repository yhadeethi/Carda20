export interface OCRResult {
  rawText: string;
  confidence?: number;
  error?: string;
}

interface OCRProvider {
  name: string;
  extractText(imageBase64: string): Promise<OCRResult>;
}

class OCRSpaceProvider implements OCRProvider {
  name = "ocrspace";
  private apiKey: string;
  private apiUrl = "https://api.ocr.space/parse/image";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractText(imageBase64: string): Promise<OCRResult> {
    try {
      const formData = new FormData();
      formData.append("base64Image", `data:image/jpeg;base64,${imageBase64}`);
      formData.append("language", "eng");
      formData.append("isOverlayRequired", "false");
      formData.append("detectOrientation", "true");
      formData.append("scale", "true");
      formData.append("OCREngine", "2");

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        return {
          rawText: "",
          error: `OCR.space API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();

      if (data.IsErroredOnProcessing) {
        return {
          rawText: "",
          error: data.ErrorMessage?.[0] || "OCR processing failed",
        };
      }

      const parsedResults = data.ParsedResults;
      if (!parsedResults || parsedResults.length === 0) {
        return {
          rawText: "",
          error: "No text detected in image",
        };
      }

      const rawText = parsedResults
        .map((r: { ParsedText: string }) => r.ParsedText)
        .join("\n")
        .trim();

      return {
        rawText,
        confidence: parsedResults[0]?.TextOverlay?.HasOverlay ? 0.9 : 0.7,
      };
    } catch (error) {
      console.error("OCR.space extraction error:", error);
      return {
        rawText: "",
        error: error instanceof Error ? error.message : "OCR extraction failed",
      };
    }
  }
}

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

export async function extractTextFromImage(imageBase64: string): Promise<OCRResult> {
  if (!currentProvider) {
    return {
      rawText: "",
      error: "OCR provider not configured. Please set OCR_SPACE_API_KEY.",
    };
  }
  
  return currentProvider.extractText(imageBase64);
}
