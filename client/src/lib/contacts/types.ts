/**
 * Carda Contacts v2 - Enhanced types for follow-up, tasks, reminders, timeline
 */

export type ContactId = string;

// Task per contact
export interface ContactTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string; // ISO
  completedAt?: string; // ISO
  dueAt?: string; // ISO optional
}

// Reminder per contact
export interface ContactReminder {
  id: string;
  label: string;
  remindAt: string; // ISO
  done: boolean;
  doneAt?: string; // ISO
  createdAt: string; // ISO
}

// Timeline event types
export type TimelineEventType =
  | "scan_created"
  | "note_added"
  | "note_updated"
  | "followup_generated"
  | "reminder_set"
  | "reminder_done"
  | "task_added"
  | "task_done"
  | "meeting_scheduled"
  | "event_attended"
  | "contact_merged"
  | "contact_updated"
  | "hubspot_synced";

// Timeline event
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  at: string; // ISO
  summary: string;
  meta?: Record<string, unknown>;
}

// Merge history for undo
export interface MergeHistoryEntry {
  id: string;
  mergedAt: string; // ISO
  primaryContactId: string;
  mergedContactSnapshots: ContactSnapshot[];
}

export interface ContactSnapshot {
  id: string;
  data: Record<string, unknown>;
}

// Follow-up modes
export type FollowUpMode = "email_followup" | "linkedin_message" | "meeting_intro";

// Follow-up tone
export type FollowUpTone = "friendly" | "direct" | "warm" | "formal";

// Follow-up length
export type FollowUpLength = "short" | "medium";

// Follow-up request
export interface FollowUpRequest {
  mode: FollowUpMode;
  tone: FollowUpTone;
  goal: string;
  context?: string;
  length: FollowUpLength;
}

// Follow-up response
export interface FollowUpResponse {
  subject?: string;
  body: string;
  bullets: string[];
}
