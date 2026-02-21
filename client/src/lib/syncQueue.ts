const SYNC_QUEUE_KEY = 'carda_sync_queue_v1';
const MAX_RETRIES = 5;

export type SyncType =
  | 'task' | 'reminder' | 'timeline_event' | 'event_preference' | 'merge_history' | 'contact_org'
  | 'contact_upsert' | 'company_upsert' | 'event_upsert' | 'event_attach_contacts';

export type QueueItemStatus = 'pending' | 'failed';

export interface QueuedChange {
  id: string;
  type: SyncType;
  action: 'create' | 'update' | 'delete';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data: any;
  timestamp: string;
  retryCount: number;
  status: QueueItemStatus;
  lastError?: string;
  nextRetryAt?: string;
}

type SyncQueueListener = () => void;
const listeners: SyncQueueListener[] = [];

export function subscribeSyncQueue(fn: SyncQueueListener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners(): void {
  for (const fn of listeners) {
    try { fn(); } catch {}
  }
}

function loadQueue(): QueuedChange[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedChange[];
    return parsed.map(item => ({
      ...item,
      status: item.status || 'pending',
    }));
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedChange[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[SyncQueue] Failed to save queue:', e);
  }
}

export function addToSyncQueue(
  type: QueuedChange['type'],
  action: QueuedChange['action'],
  endpoint: string,
  method: QueuedChange['method'],
  data: any
): void {
  const queue = loadQueue();

  const item: QueuedChange = {
    id: crypto.randomUUID(),
    type,
    action,
    endpoint,
    method,
    data,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  queue.push(item);
  saveQueue(queue);
  notifyListeners();

  console.log(`[SyncQueue] Added ${type} ${action} to queue (${queue.length} items)`);
}

export function removeFromQueue(itemId: string): void {
  const queue = loadQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  saveQueue(filtered);
  notifyListeners();
}

export function getQueueSize(): number {
  return loadQueue().length;
}

export function getFailedItems(): QueuedChange[] {
  return loadQueue().filter(item => item.status === 'failed');
}

export function getFailedCount(): number {
  return getFailedItems().length;
}

export function retryFailedItems(): void {
  const queue = loadQueue();
  let changed = false;
  for (const item of queue) {
    if (item.status === 'failed') {
      item.status = 'pending';
      item.retryCount = 0;
      item.lastError = undefined;
      item.nextRetryAt = undefined;
      changed = true;
    }
  }
  if (changed) {
    saveQueue(queue);
    notifyListeners();
    if (navigator.onLine) {
      processSyncQueue();
    }
  }
}

export function dismissFailedItem(itemId: string): void {
  const queue = loadQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  saveQueue(filtered);
  notifyListeners();
}

export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  newFailures: number;
  errors: string[]
}> {
  const queue = loadQueue();
  const pendingItems = queue.filter(item => item.status === 'pending');

  if (pendingItems.length === 0) {
    return { processed: 0, failed: 0, newFailures: 0, errors: [] };
  }

  console.log(`[SyncQueue] Processing ${pendingItems.length} pending items...`);

  let processed = 0;
  let failed = 0;
  let newFailures = 0;
  const errors: string[] = [];

  for (const item of pendingItems) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: item.data ? JSON.stringify(item.data) : undefined,
      });

      if (response.ok) {
        item.status = 'pending';
        const idx = queue.indexOf(item);
        if (idx !== -1) queue.splice(idx, 1);
        processed++;
        console.log(`[SyncQueue] Synced ${item.type} ${item.action}`);
      } else {
        const errorText = await response.text().catch(() => `HTTP ${response.status}`);
        item.retryCount++;
        item.lastError = errorText.slice(0, 200);

        if (item.retryCount >= MAX_RETRIES) {
          item.status = 'failed';
          newFailures++;
          console.error(`[SyncQueue] ${item.type} ${item.action} failed permanently after ${MAX_RETRIES} retries`);
        } else {
          item.nextRetryAt = new Date(Date.now() + item.retryCount * 30000).toISOString();
        }
        failed++;
        errors.push(`${item.type} ${item.action} failed (attempt ${item.retryCount})`);
      }
    } catch (error) {
      item.retryCount++;
      item.lastError = (error as any).message?.slice(0, 200) || 'Network error';

      if (item.retryCount >= MAX_RETRIES) {
        item.status = 'failed';
        newFailures++;
        console.error(`[SyncQueue] ${item.type} ${item.action} failed permanently after ${MAX_RETRIES} retries`);
      } else {
        item.nextRetryAt = new Date(Date.now() + item.retryCount * 30000).toISOString();
      }
      failed++;
      errors.push(`${item.type} ${item.action}: ${item.lastError}`);
    }
  }

  saveQueue(queue);
  notifyListeners();

  console.log(`[SyncQueue] Processed: ${processed}, Failed: ${failed}, New failures: ${newFailures}, Remaining: ${queue.length}`);

  return { processed, failed, newFailures, errors };
}

export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  console.log('[SyncQueue] Queue cleared');
  notifyListeners();
}

export function setupAutoSync(): void {
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 1000);
  }

  window.addEventListener('online', () => {
    console.log('[SyncQueue] Back online, processing queue...');
    processSyncQueue();
  });

  setInterval(() => {
    if (navigator.onLine && getQueueSize() > 0) {
      processSyncQueue();
    }
  }, 5 * 60 * 1000);
}
