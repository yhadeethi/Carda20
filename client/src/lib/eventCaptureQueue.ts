/**
 * Event Capture Queue
 * Manages a local queue for batch capturing contacts at events.
 * Uses localStorage for fast, offline-first capture with background sync to Neon.
 */

import { attachContactsToEvent, getOrCreateDraftEvent, type UserEvent } from "./userEventsApi";

const STORAGE_KEY = "carda_event_capture_queue_v1";
const ACTIVE_EVENT_KEY = "carda_active_event_id_v1";

export type CaptureStatus = "queued" | "extracting" | "saved" | "attaching" | "synced" | "failed";

export interface QueuedCapture {
  localId: string;
  eventId: number | null; // null for draft
  imageDataRef?: string; // base64 or blob URL
  status: CaptureStatus;
  createdAt: string;
  extractedContact?: {
    contactIdV1?: string;
    contactIdV2?: number;
    name?: string;
    company?: string;
    email?: string;
  };
  error?: string;
  retryCount?: number;
}

export interface CaptureQueue {
  [eventIdOrDraft: string]: QueuedCapture[];
}

/**
 * Generate a local ID for queue items
 */
export function generateLocalId(): string {
  return `cap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Load the capture queue from localStorage
 */
export function loadCaptureQueue(): CaptureQueue {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save the capture queue to localStorage
 */
function saveCaptureQueue(queue: CaptureQueue): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("[CaptureQueue] Failed to save queue:", e);
  }
}

/**
 * Get active event ID from localStorage
 */
export function getActiveEventId(): number | null {
  try {
    const stored = localStorage.getItem(ACTIVE_EVENT_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Set active event ID in localStorage
 */
export function setActiveEventId(eventId: number | null): void {
  try {
    if (eventId === null) {
      localStorage.removeItem(ACTIVE_EVENT_KEY);
    } else {
      localStorage.setItem(ACTIVE_EVENT_KEY, String(eventId));
    }
  } catch (e) {
    console.error("[CaptureQueue] Failed to save active event ID:", e);
  }
}

/**
 * Get the key for a queue (event ID or "draft")
 */
function getQueueKey(eventId: number | null): string {
  return eventId === null ? "draft" : String(eventId);
}

/**
 * Add a capture to the queue
 */
export function addCaptureToQueue(
  eventId: number | null,
  imageDataRef?: string
): QueuedCapture {
  const queue = loadCaptureQueue();
  const key = getQueueKey(eventId);

  const capture: QueuedCapture = {
    localId: generateLocalId(),
    eventId,
    imageDataRef,
    status: "queued",
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  if (!queue[key]) {
    queue[key] = [];
  }
  queue[key].push(capture);

  saveCaptureQueue(queue);
  return capture;
}

/**
 * Update a capture in the queue
 */
export function updateCaptureInQueue(
  eventId: number | null,
  localId: string,
  updates: Partial<QueuedCapture>
): QueuedCapture | null {
  const queue = loadCaptureQueue();
  const key = getQueueKey(eventId);

  if (!queue[key]) return null;

  const index = queue[key].findIndex((c) => c.localId === localId);
  if (index === -1) return null;

  queue[key][index] = { ...queue[key][index], ...updates };
  saveCaptureQueue(queue);

  return queue[key][index];
}

/**
 * Remove a capture from the queue
 */
export function removeCaptureFromQueue(eventId: number | null, localId: string): void {
  const queue = loadCaptureQueue();
  const key = getQueueKey(eventId);

  if (!queue[key]) return;

  queue[key] = queue[key].filter((c) => c.localId !== localId);

  if (queue[key].length === 0) {
    delete queue[key];
  }

  saveCaptureQueue(queue);
}

/**
 * Get all captures for an event
 */
export function getCapturesForEvent(eventId: number | null): QueuedCapture[] {
  const queue = loadCaptureQueue();
  const key = getQueueKey(eventId);
  return queue[key] || [];
}

/**
 * Get pending captures (not yet synced)
 */
export function getPendingCaptures(eventId: number | null): QueuedCapture[] {
  return getCapturesForEvent(eventId).filter(
    (c) => c.status !== "synced"
  );
}

/**
 * Get failed captures that can be retried
 */
export function getRetryableCaptures(eventId: number | null): QueuedCapture[] {
  return getCapturesForEvent(eventId).filter(
    (c) => c.status === "failed" && (c.retryCount || 0) < 3
  );
}

/**
 * Clear all captures for an event
 */
export function clearEventCaptures(eventId: number | null): void {
  const queue = loadCaptureQueue();
  const key = getQueueKey(eventId);
  delete queue[key];
  saveCaptureQueue(queue);
}

/**
 * Ensure we have an event to attach captures to
 * Returns existing active event or creates a draft
 */
export async function ensureEventTarget(): Promise<{ eventId: number; isDraft: boolean; event: UserEvent }> {
  const activeId = getActiveEventId();

  if (activeId !== null) {
    // We have an active event, use it
    // Note: We trust this ID; caller should verify if needed
    return {
      eventId: activeId,
      isDraft: false,
      event: { id: activeId } as UserEvent, // Minimal placeholder
    };
  }

  // No active event, get or create a draft
  const draft = await getOrCreateDraftEvent();
  return {
    eventId: draft.id,
    isDraft: draft.isDraft === 1,
    event: draft,
  };
}

/**
 * Mark a capture as saved and schedule sync
 */
export function markCaptureSaved(
  eventId: number | null,
  localId: string,
  contactData: { contactIdV1?: string; contactIdV2?: number; name?: string; company?: string; email?: string }
): void {
  updateCaptureInQueue(eventId, localId, {
    status: "saved",
    extractedContact: contactData,
  });

  // Schedule async sync to Neon
  scheduleContactSync(eventId, localId);
}

/**
 * Schedule background sync of a contact to the event
 */
async function scheduleContactSync(eventId: number | null, localId: string): Promise<void> {
  // Small delay to batch potential rapid saves
  setTimeout(async () => {
    await syncCaptureToEvent(eventId, localId);
  }, 500);
}

/**
 * Sync a single capture's contact to the Neon event
 */
export async function syncCaptureToEvent(eventId: number | null, localId: string): Promise<boolean> {
  const queue = loadCaptureQueue();
  const key = getQueueKey(eventId);
  const captures = queue[key] || [];
  const capture = captures.find((c) => c.localId === localId);

  if (!capture || !capture.extractedContact) {
    return false;
  }

  if (capture.status === "synced") {
    return true;
  }

  // Need an actual event ID to sync
  let targetEventId = eventId;
  if (targetEventId === null) {
    // Get or create draft
    try {
      const draft = await getOrCreateDraftEvent();
      targetEventId = draft.id;
    } catch (e) {
      console.error("[CaptureQueue] Failed to get draft event:", e);
      updateCaptureInQueue(eventId, localId, {
        status: "failed",
        error: "Failed to get event for sync",
        retryCount: (capture.retryCount || 0) + 1,
      });
      return false;
    }
  }

  updateCaptureInQueue(eventId, localId, { status: "attaching" });

  try {
    await attachContactsToEvent(targetEventId, [
      {
        contactIdV1: capture.extractedContact.contactIdV1,
        contactIdV2: capture.extractedContact.contactIdV2,
      },
    ]);

    updateCaptureInQueue(eventId, localId, { status: "synced" });
    return true;
  } catch (e) {
    console.error("[CaptureQueue] Failed to attach contact:", e);
    updateCaptureInQueue(eventId, localId, {
      status: "failed",
      error: e instanceof Error ? e.message : "Sync failed",
      retryCount: (capture.retryCount || 0) + 1,
    });
    return false;
  }
}

/**
 * Sync all pending captures for an event
 */
export async function syncAllPendingCaptures(eventId: number | null): Promise<{ synced: number; failed: number }> {
  const pending = getPendingCaptures(eventId).filter(
    (c) => c.status === "saved" || c.status === "failed"
  );

  let synced = 0;
  let failed = 0;

  for (const capture of pending) {
    const success = await syncCaptureToEvent(eventId, capture.localId);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Resume syncing on app reload
 */
export function resumePendingSyncs(): void {
  const queue = loadCaptureQueue();

  for (const key of Object.keys(queue)) {
    const eventId = key === "draft" ? null : parseInt(key, 10);
    const pending = getPendingCaptures(eventId).filter(
      (c) => c.status === "saved" || (c.status === "failed" && (c.retryCount || 0) < 3)
    );

    for (const capture of pending) {
      syncCaptureToEvent(eventId, capture.localId).catch(console.error);
    }
  }
}

// Auto-resume on load
if (typeof window !== "undefined") {
  // Delay to ensure app is ready
  setTimeout(resumePendingSyncs, 2000);
}
