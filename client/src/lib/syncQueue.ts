/**
 * Sync Queue for offline support
 * Queues timeline data changes when offline and syncs when back online
 */

const SYNC_QUEUE_KEY = 'carda_sync_queue_v1';

export interface QueuedChange {
  id: string;
  type: 'task' | 'reminder' | 'timeline_event' | 'event_preference' | 'merge_history';
  action: 'create' | 'update' | 'delete';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: string;
  retryCount: number;
}

// Load sync queue from localStorage
function loadQueue(): QueuedChange[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Save sync queue to localStorage
function saveQueue(queue: QueuedChange[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[SyncQueue] Failed to save queue:', e);
  }
}

// Generate unique ID for queued items
function generateQueueId(): string {
  return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Add item to sync queue
export function addToSyncQueue(
  type: QueuedChange['type'],
  action: QueuedChange['action'],
  endpoint: string,
  method: QueuedChange['method'],
  data: any
): void {
  const queue = loadQueue();

  const item: QueuedChange = {
    id: generateQueueId(),
    type,
    action,
    endpoint,
    method,
    data,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  queue.push(item);
  saveQueue(queue);

  console.log(`[SyncQueue] Added ${type} ${action} to queue (${queue.length} items)`);
}

// Remove item from queue
export function removeFromQueue(itemId: string): void {
  const queue = loadQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  saveQueue(filtered);
}

// Get queue size
export function getQueueSize(): number {
  return loadQueue().length;
}

// Process sync queue (retry failed requests)
export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  errors: string[]
}> {
  const queue = loadQueue();

  if (queue.length === 0) {
    return { processed: 0, failed: 0, errors: [] };
  }

  console.log(`[SyncQueue] Processing ${queue.length} queued items...`);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  const remainingQueue: QueuedChange[] = [];

  for (const item of queue) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: item.data ? JSON.stringify(item.data) : undefined,
      });

      if (response.ok) {
        processed++;
        console.log(`[SyncQueue] Synced ${item.type} ${item.action}`);
      } else {
        // Retry failed - increment retry count
        item.retryCount++;

        if (item.retryCount < 3) {
          // Keep in queue for retry
          remainingQueue.push(item);
          failed++;
          errors.push(`${item.type} ${item.action} failed (retry ${item.retryCount})`);
        } else {
          // Give up after 3 retries
          console.error(`[SyncQueue] Giving up on ${item.type} after 3 retries`);
          failed++;
          errors.push(`${item.type} ${item.action} failed permanently`);
        }
      }
    } catch (error) {
      // Network error - keep in queue
      item.retryCount++;

      if (item.retryCount < 3) {
        remainingQueue.push(item);
      }

      failed++;
      errors.push(`${item.type} ${item.action}: ${error.message}`);
    }
  }

  // Save remaining items back to queue
  saveQueue(remainingQueue);

  console.log(`[SyncQueue] Processed: ${processed}, Failed: ${failed}, Remaining: ${remainingQueue.length}`);

  return { processed, failed, errors };
}

// Clear entire queue (use with caution!)
export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  console.log('[SyncQueue] Queue cleared');
}

// Check if online and auto-process queue
export function setupAutoSync(): void {
  // Process queue on app load if online
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 1000);
  }

  // Process queue when coming back online
  window.addEventListener('online', () => {
    console.log('[SyncQueue] Back online, processing queue...');
    processSyncQueue();
  });

  // Periodic sync every 5 minutes
  setInterval(() => {
    if (navigator.onLine && getQueueSize() > 0) {
      processSyncQueue();
    }
  }, 5 * 60 * 1000);
}
