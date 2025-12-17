/**
 * Batch Scan Storage
 * Manages queue of captured images for batch processing in event mode
 */

export interface QueuedScan {
  id: string;
  imageData: string; // base64
  thumbnail: string; // smaller base64 for preview
  capturedAt: string; // ISO
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: {
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
  };
}

export interface BatchScanSession {
  id: string;
  eventName: string;
  startedAt: string;
  items: QueuedScan[];
}

const STORAGE_KEY = "carda_batch_scan_v1";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create thumbnail from base64 image
export async function createThumbnail(imageData: string, maxSize: number = 150): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(imageData); // fallback to original
    img.src = imageData;
  });
}

// Load current batch session
export function loadBatchSession(): BatchScanSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("[BatchScan] Failed to load session:", e);
    return null;
  }
}

// Save batch session
export function saveBatchSession(session: BatchScanSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("[BatchScan] Failed to save session:", e);
  }
}

// Start new batch session
export function startBatchSession(eventName: string): BatchScanSession {
  const session: BatchScanSession = {
    id: generateId(),
    eventName,
    startedAt: new Date().toISOString(),
    items: [],
  };
  saveBatchSession(session);
  return session;
}

// Add image to queue
export async function addToQueue(imageData: string): Promise<QueuedScan | null> {
  const session = loadBatchSession();
  if (!session) return null;
  
  const thumbnail = await createThumbnail(imageData);
  
  const item: QueuedScan = {
    id: generateId(),
    imageData,
    thumbnail,
    capturedAt: new Date().toISOString(),
    status: 'pending',
  };
  
  session.items.push(item);
  saveBatchSession(session);
  return item;
}

// Remove item from queue
export function removeFromQueue(itemId: string): boolean {
  const session = loadBatchSession();
  if (!session) return false;
  
  const index = session.items.findIndex(i => i.id === itemId);
  if (index === -1) return false;
  
  session.items.splice(index, 1);
  saveBatchSession(session);
  return true;
}

// Update item status
export function updateQueueItem(itemId: string, updates: Partial<QueuedScan>): QueuedScan | null {
  const session = loadBatchSession();
  if (!session) return null;
  
  const item = session.items.find(i => i.id === itemId);
  if (!item) return null;
  
  Object.assign(item, updates);
  saveBatchSession(session);
  return item;
}

// Get pending items
export function getPendingItems(): QueuedScan[] {
  const session = loadBatchSession();
  if (!session) return [];
  return session.items.filter(i => i.status === 'pending');
}

// Get all items
export function getAllQueueItems(): QueuedScan[] {
  const session = loadBatchSession();
  if (!session) return [];
  return session.items;
}

// Clear session
export function clearBatchSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Get session summary
export function getSessionSummary(): {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
} {
  const session = loadBatchSession();
  if (!session) {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  }
  
  return {
    total: session.items.length,
    pending: session.items.filter(i => i.status === 'pending').length,
    processing: session.items.filter(i => i.status === 'processing').length,
    completed: session.items.filter(i => i.status === 'completed').length,
    failed: session.items.filter(i => i.status === 'failed').length,
  };
}
