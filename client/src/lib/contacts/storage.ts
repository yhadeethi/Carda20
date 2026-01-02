/**
 * Carda Contacts v2 Storage
 * Enhanced with tasks, reminders, timeline, and migration support
 */

import { 
  ContactTask, 
  ContactReminder, 
  TimelineEvent,
  TimelineEventType,
  MergeHistoryEntry,
  ContactSnapshot
} from './types';
import { generateId } from './ids';
import { 
  StoredContact, 
  ContactOrg,
  loadContacts as loadContactsV1, 
  saveContacts as saveContactsV1,
  updateContact as updateContactV1
} from '../contactsStorage';

const STORAGE_KEY_V2 = "carda_contacts_v2";
const MERGE_HISTORY_KEY = "carda_merges_v1";
const MAX_MERGE_HISTORY = 10;

// NOTE: V1 and V2 storage currently co-exist.
// Scanning and most newer features write to V2, while some legacy screens
// (notably Org Map in the current build) still write to V1.
//
// Without a merge, saving V2 can overwrite Org assignments stored in V1,
// making roles/reporting lines "revert" after a new scan.
//
// This file implements a defensive merge when syncing V2 -> V1.

// Extended contact with v2 fields
export interface ContactV2 extends StoredContact {
  tasks: ContactTask[];
  reminders: ContactReminder[];
  timeline: TimelineEvent[];
  lastTouchedAt?: string; // ISO
  notes?: string;
  mergeMeta?: {
    mergedFromIds?: string[];
    mergedAt?: string;
  };
}

// Check if a contact has been migrated to v2
function isV2Contact(contact: StoredContact): contact is ContactV2 {
  return 'tasks' in contact && 'reminders' in contact && 'timeline' in contact;
}

// Migrate a v1 contact to v2
function migrateToV2(contact: StoredContact): ContactV2 {
  if (isV2Contact(contact)) return contact;

  return {
    ...contact,
    tasks: [],
    reminders: [],
    timeline: [
      {
        id: generateId(),
        type: 'scan_created',
        at: contact.createdAt || new Date().toISOString(),
        summary: 'Contact created',
      }
    ],
    lastTouchedAt: contact.createdAt,
    notes: '',
  };
}

// Load all contacts with v2 migration
export function loadContactsV2(): ContactV2[] {
  try {
    // First try v2 storage
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        return parsed.map(migrateToV2);
      }
    }

    // Fallback to v1 and migrate
    const v1Contacts = loadContactsV1();
    const v2Contacts = v1Contacts.map(migrateToV2);

    // Save migrated contacts to v2 storage
    if (v2Contacts.length > 0) {
      saveContactsV2(v2Contacts);
    }

    return v2Contacts;
  } catch (e) {
    console.error("[ContactsStorage] Failed to load v2 contacts:", e);
    return [];
  }
}

// Save all contacts
export function saveContactsV2(contacts: ContactV2[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(contacts));
    // Also sync back to v1 for compatibility.
    // IMPORTANT: Merge in Org fields from V1 if V2 hasn't got them yet.
    // This prevents Org Map edits (still writing to V1 in the current build)
    // from being clobbered by a subsequent V2 save (e.g., after scanning).

    const v1Existing = loadContactsV1();
    const v1ById = new Map(v1Existing.map(c => [c.id, c] as const));

    const isOrgMeaningful = (org?: ContactOrg | null): boolean => {
      if (!org) return false;
      return (
        (org.department !== 'UNKNOWN') ||
        (org.reportsToId !== null && org.reportsToId !== undefined) ||
        (org.role !== 'UNKNOWN') ||
        (org.influence !== 'UNKNOWN') ||
        (org.relationshipStrength !== 'UNKNOWN')
      );
    };

    const mergeOrg = (v1Org?: ContactOrg, v2Org?: ContactOrg): ContactOrg | undefined => {
      if (!v1Org && !v2Org) return v2Org;
      if (!v1Org) return v2Org;
      if (!v2Org) return v1Org;

      // Field-level: only let V2 override if it carries a meaningful value.
      const pick = <K extends keyof ContactOrg>(key: K, def: ContactOrg[K]): ContactOrg[K] => {
        const v2 = v2Org[key];
        const v1 = v1Org[key];
        const v2IsDefault = v2 === def;
        return (v2IsDefault ? v1 : v2) as ContactOrg[K];
      };

      return {
        department: pick('department', 'UNKNOWN'),
        reportsToId: (() => {
          const v2 = v2Org?.reportsToId;
          // Null is meaningful if the user explicitly cleared the manager in V2.
          if (v2 === null) return null;
          if (v2 === undefined) return v1Org?.reportsToId ?? null;
          return v2;
        })(),
        role: pick('role', 'UNKNOWN'),
        influence: pick('influence', 'UNKNOWN'),
        relationshipStrength: pick('relationshipStrength', 'UNKNOWN'),
      };
    };

    const mergedForV1 = contacts.map((c) => {
      const v1 = v1ById.get(c.id);
      if (!v1) return c;

      // If V2 has no meaningful org but V1 does, keep V1's org.
      if (!isOrgMeaningful(c.org) && isOrgMeaningful(v1.org)) {
        return { ...c, org: v1.org };
      }

      // Otherwise, merge org field-by-field (prefer meaningful V2 values).
      const mergedOrg = mergeOrg(v1.org, c.org);
      return mergedOrg ? { ...c, org: mergedOrg } : c;
    });

    saveContactsV1(mergedForV1 as unknown as StoredContact[]);
  } catch (e) {
    console.error("[ContactsStorage] Failed to save v2 contacts:", e);
  }
}

// Get a single contact by ID
export function getContactById(id: string): ContactV2 | null {
  const contacts = loadContactsV2();
  return contacts.find(c => c.id === id) || null;
}

// Upsert contact
export function upsertContact(contact: ContactV2): ContactV2 {
  const contacts = loadContactsV2();
  const index = contacts.findIndex(c => c.id === contact.id);

  if (index >= 0) {
    contacts[index] = contact;
  } else {
    contacts.unshift(contact);
  }

  saveContactsV2(contacts);
  return contact;
}

// Update contact by ID
export function updateContactV2(id: string, updates: Partial<ContactV2>): ContactV2 | null {
  const contacts = loadContactsV2();
  const index = contacts.findIndex(c => c.id === id);

  if (index === -1) return null;

  const updated = { ...contacts[index], ...updates };
  contacts[index] = updated;
  saveContactsV2(contacts);

  // Also sync to v1
  updateContactV1(id, updates);

  return updated;
}

// Mark contact as last touched
export function markLastTouched(contactId: string): void {
  updateContactV2(contactId, { lastTouchedAt: new Date().toISOString() });
}

// ============ TIMELINE ============

export function addTimelineEvent(
  contactId: string, 
  type: TimelineEventType, 
  summary: string, 
  meta?: Record<string, unknown>
): TimelineEvent | null {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const event: TimelineEvent = {
    id: generateId(),
    type,
    at: new Date().toISOString(),
    summary,
    meta,
  };

  const timeline = [event, ...(contact.timeline || [])];
  updateContactV2(contactId, { 
    timeline, 
    lastTouchedAt: new Date().toISOString() 
  });

  return event;
}

export function getTimeline(contactId: string): TimelineEvent[] {
  const contact = getContactById(contactId);
  return contact?.timeline || [];
}

// ============ TASKS ============

export function addTask(contactId: string, title: string, dueAt?: string): ContactTask | null {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const task: ContactTask = {
    id: generateId(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
    dueAt,
  };

  const tasks = [...(contact.tasks || []), task];
  updateContactV2(contactId, { 
    tasks, 
    lastTouchedAt: new Date().toISOString() 
  });

  // Add timeline event
  addTimelineEvent(contactId, 'task_added', `Task added: ${title}`);

  return task;
}

export function completeTask(contactId: string, taskId: string): boolean {
  const contact = getContactById(contactId);
  if (!contact) return false;

  const tasks = (contact.tasks || []).map(t => 
    t.id === taskId 
      ? { ...t, done: true, completedAt: new Date().toISOString() }
      : t
  );

  const task = tasks.find(t => t.id === taskId);
  if (!task) return false;

  updateContactV2(contactId, { 
    tasks, 
    lastTouchedAt: new Date().toISOString() 
  });

  addTimelineEvent(contactId, 'task_done', `Task completed: ${task.title}`);

  return true;
}

export function deleteTask(contactId: string, taskId: string): boolean {
  const contact = getContactById(contactId);
  if (!contact) return false;

  const tasks = (contact.tasks || []).filter(t => t.id !== taskId);
  updateContactV2(contactId, { tasks });

  return true;
}

export function getTasks(contactId: string): ContactTask[] {
  const contact = getContactById(contactId);
  return contact?.tasks || [];
}

// ============ REMINDERS ============

export function addReminder(contactId: string, label: string, remindAt: string): ContactReminder | null {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const reminder: ContactReminder = {
    id: generateId(),
    label,
    remindAt,
    done: false,
    createdAt: new Date().toISOString(),
  };

  const reminders = [...(contact.reminders || []), reminder];
  updateContactV2(contactId, { 
    reminders, 
    lastTouchedAt: new Date().toISOString() 
  });

  addTimelineEvent(contactId, 'reminder_set', `Reminder set: ${label}`, { remindAt });

  return reminder;
}

export function completeReminder(contactId: string, reminderId: string): boolean {
  const contact = getContactById(contactId);
  if (!contact) return false;

  const reminders = (contact.reminders || []).map(r => 
    r.id === reminderId 
      ? { ...r, done: true, doneAt: new Date().toISOString() }
      : r
  );

  const reminder = reminders.find(r => r.id === reminderId);
  if (!reminder) return false;

  updateContactV2(contactId, { 
    reminders, 
    lastTouchedAt: new Date().toISOString() 
  });

  addTimelineEvent(contactId, 'reminder_done', `Reminder done: ${reminder.label}`);

  return true;
}

export function deleteReminder(contactId: string, reminderId: string): boolean {
  const contact = getContactById(contactId);
  if (!contact) return false;

  const reminders = (contact.reminders || []).filter(r => r.id !== reminderId);
  updateContactV2(contactId, { reminders });

  return true;
}

export function getReminders(contactId: string): ContactReminder[] {
  const contact = getContactById(contactId);
  return contact?.reminders || [];
}

// Get all upcoming reminders across all contacts
export function getAllUpcomingReminders(limit: number = 20): Array<{
  contactId: string;
  contactName: string;
  reminder: ContactReminder;
}> {
  const contacts = loadContactsV2();
  const now = new Date().toISOString();

  const upcoming: Array<{
    contactId: string;
    contactName: string;
    reminder: ContactReminder;
  }> = [];

  contacts.forEach(contact => {
    (contact.reminders || [])
      .filter(r => !r.done && r.remindAt >= now)
      .forEach(reminder => {
        upcoming.push({
          contactId: contact.id,
          contactName: contact.name,
          reminder,
        });
      });
  });

  // Sort by remindAt ascending
  upcoming.sort((a, b) => a.reminder.remindAt.localeCompare(b.reminder.remindAt));

  return upcoming.slice(0, limit);
}

// ============ NOTES ============

export function addNote(contactId: string, noteText: string): boolean {
  const contact = getContactById(contactId);
  if (!contact) return false;

  // Append to notes field
  const existingNotes = contact.notes || '';
  const timestamp = new Date().toLocaleString();
  const newNotes = existingNotes 
    ? `${existingNotes}\n\n[${timestamp}]\n${noteText}`
    : `[${timestamp}]\n${noteText}`;

  updateContactV2(contactId, { 
    notes: newNotes,
    lastTouchedAt: new Date().toISOString() 
  });

  addTimelineEvent(contactId, 'note_added', noteText.slice(0, 100), { fullNote: noteText });

  return true;
}

// ============ MERGE HISTORY ============

export function loadMergeHistory(): MergeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(MERGE_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMergeHistory(history: MergeHistoryEntry[]): void {
  localStorage.setItem(MERGE_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_MERGE_HISTORY)));
}

export function addMergeHistoryEntry(entry: MergeHistoryEntry): void {
  const history = loadMergeHistory();
  history.unshift(entry);
  saveMergeHistory(history);
}

export function undoLastMerge(): boolean {
  const history = loadMergeHistory();
  if (history.length === 0) return false;

  const lastMerge = history[0];
  const contacts = loadContactsV2();

  // Remove primary contact
  const filtered = contacts.filter(c => c.id !== lastMerge.primaryContactId);

  // Restore merged contacts
  lastMerge.mergedContactSnapshots.forEach(snapshot => {
    filtered.push(snapshot.data as unknown as ContactV2);
  });

  saveContactsV2(filtered);

  // Remove from history
  history.shift();
  saveMergeHistory(history);

  return true;
}
