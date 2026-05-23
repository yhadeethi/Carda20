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
  draftBody?: string; // optional draft message for communication intent tasks
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
  | "followup_sent"
  | "reminder_set"
  | "reminder_done"
  | "task_added"
  | "task_done"
  | "meeting_scheduled"
  | "event_attended"
  | "contact_merged"
  | "contact_updated"
  | "hubspot_synced"
  | "salesforce_synced"
  | "voice_debrief"
  | "call_logged";
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
// Communication intent extracted from voice debrief
export interface CommunicationIntent {
  recipientName: string;
  recipientCompany: string;
  intentDescription: string;
  suggestedTone: "warm" | "friendly" | "direct" | "formal";
}
// Draft action generated from a communication intent
export interface DraftAction {
  recipientName: string;
  recipientCompany: string;
  subject: string | null;
  body: string;
  status: "pending" | "ready" | "dismissed";
}

// ── Enhanced Voice Debrief Parser Output ────────────────────────────────
// These types represent the structured data extracted by the enhanced
// debrief parser (server/routes.ts /api/debrief/parse)

/** Org relationship detected from voice debrief transcript */
export interface OrgRelationship {
  /** Name of the person as mentioned in transcript */
  personName: string;
  /** Name of the person they report to, as mentioned */
  reportsToName: string;
  /** Matched contact ID for the person, if found in user's contacts */
  personContactId: string | null;
  /** Matched contact ID for the manager, if found in user's contacts */
  reportsToContactId: string | null;
  /** Confidence of the match */
  confidence: "high" | "medium" | "low";
}

/** Structured action item extracted from voice debrief */
export interface ActionItem {
  /** Description of the action */
  description: string;
  /** Who is responsible (user or the contact) */
  owner: "user" | "contact" | "unknown";
  /** Natural language due date, e.g. "next Tuesday", "end of month" */
  dueDescription: string | null;
}

/** Deal/opportunity signal detected from voice debrief */
export interface DealSignal {
  /** Brief description of the signal */
  signal: string;
  /** Strength of the signal */
  strength: "strong" | "moderate" | "weak";
}
