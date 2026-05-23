/**
 * Batch Processor
 * Processes queued scans through OCR and parsing pipeline
 */

import { QueuedScan, updateQueueItem, getAllQueueItems, saveBatchSession, loadBatchSession } from "./batchScanStorage";

interface ScanResult {
  rawText: string;
  contact: {
    fullName?: string;
    jobTitle?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    website?: string;
    linkedinUrl?: string;
    address?: string;
  };
  error?: string;
}

// Convert base64 to File for uploading
function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// Process a single image through OCR
async function processImage(imageData: string): Promise<ScanResult> {
  const file = base64ToFile(imageData, "scan.jpg");
  const formData = new FormData();
  formData.append("image", file);

  // Try AI parsing first
  try {
    const aiRes = await fetch("/api/scan-ai", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (aiRes.ok) {
      const result = await aiRes.json() as ScanResult;
      console.log("[BatchProcessor] AI parsing succeeded");
      return result;
    }
    console.log("[BatchProcessor] AI endpoint failed, falling back to deterministic");
  } catch (aiError) {
    console.log("[BatchProcessor] AI endpoint error, falling back:", aiError);
  }

  // Fallback to deterministic parsing
  const formData2 = new FormData();
  const file2 = base64ToFile(imageData, "scan.jpg");
  formData2.append("image", file2);

  const res = await fetch("/api/scan", {
    method: "POST",
    body: formData2,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to scan card");
  }

  return res.json() as Promise<ScanResult>;
}

export interface BatchProcessorCallbacks {
  onItemStart?: (itemId: string, index: number, total: number) => void;
  onItemComplete?: (itemId: string, result: ScanResult) => void;
  onItemError?: (itemId: string, error: Error) => void;
  onComplete?: (results: { successful: number; failed: number }) => void;
}

// Process all pending items in the batch queue
export async function processBatchQueue(callbacks?: BatchProcessorCallbacks): Promise<void> {
  const session = loadBatchSession();
  if (!session) {
    console.error("[BatchProcessor] No session found");
    return;
  }

  const pendingItems = session.items.filter(i => i.status === "pending");
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    
    callbacks?.onItemStart?.(item.id, i, pendingItems.length);
    
    // Mark as processing
    updateQueueItem(item.id, { status: "processing" });

    try {
      const result = await processImage(item.imageData);
      
      updateQueueItem(item.id, {
        status: "completed",
        result: {
          rawText: result.rawText,
          contact: result.contact,
        },
      });
      
      successful++;
      callbacks?.onItemComplete?.(item.id, result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      updateQueueItem(item.id, {
        status: "failed",
        error: errorMessage,
      });
      
      failed++;
      callbacks?.onItemError?.(item.id, err instanceof Error ? err : new Error(errorMessage));
    }
  }

  callbacks?.onComplete?.({ successful, failed });
}

// Get the current processing progress
export function getProcessingProgress(): {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  progress: number;
} {
  const items = getAllQueueItems();
  const total = items.length;
  const completed = items.filter(i => i.status === "completed").length;
  const processing = items.filter(i => i.status === "processing").length;
  const pending = items.filter(i => i.status === "pending").length;
  const failed = items.filter(i => i.status === "failed").length;
  
  return {
    total,
    completed,
    processing,
    pending,
    failed,
    progress: total > 0 ? ((completed + failed) / total) * 100 : 0,
  };
}
