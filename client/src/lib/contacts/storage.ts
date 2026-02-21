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
} from '../contactsStorage';
import { addToSyncQueue } from '../syncQueue';
import {
  createTaskAPI,
  updateTaskAPI,
  deleteTaskAPI,
  createReminderAPI,
  updateReminderAPI,
  deleteReminderAPI,
  createTimelineEventAPI,
  createMergeHistoryAPI,
  updateContactOrgAPI,
} from '../api/timeline';

const STORAGE_KEY_V2 = "carda_contacts_v2";
const MERGE_HISTORY_KEY = "carda_merges_v1";
const MAX_MERGE_HISTORY = 10;

// All contact storage is now unified on carda_contacts_v2.
// contactsStorage.ts and this module both read/write the same key.

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
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        return parsed.map(migrateToV2);
      }
    }
    return [];
  } catch (e) {
    console.error("[ContactsStorage] Failed to load v2 contacts:", e);
    return [];
  }
}

// Save all contacts
export function saveContactsV2(contacts: ContactV2[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(contacts));
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
export async function updateContactV2(id: string, updates: Partial<ContactV2>): Promise<ContactV2 | null> {
  const contacts = loadContactsV2();
  const index = contacts.findIndex(c => c.id === id);

  if (index === -1) return null;

  const updated = { ...contacts[index], ...updates };
  contacts[index] = updated;
  saveContactsV2(contacts);

  // If org fields were updated, sync to server
  if (updates.org) {
    const orgData = {
      orgDepartment: updates.org.department || null,
      orgRole: updates.org.role || null,
      orgReportsToId: updates.org.reportsToId ? parseInt(updates.org.reportsToId) : null,
      orgInfluence: updates.org.influence || null,
      orgRelationshipStrength: updates.org.relationshipStrength || null,
    };

    try {
      await updateContactOrgAPI(id, orgData);
    } catch (error) {
      console.error('[Storage] Failed to sync org fields to server:', error);
      // Queue for retry when back online
      addToSyncQueue('contact_org', 'update', `/api/contacts/${id}`, 'PATCH', orgData);
    }
  }

  return updated;
}

// Mark contact as last touched
export async function markLastTouched(contactId: string): Promise<void> {
  await updateContactV2(contactId, { lastTouchedAt: new Date().toISOString() });
}

// ============ TIMELINE ============

export async function addTimelineEvent(
  contactId: string,
  type: TimelineEventType,
  summary: string,
  meta?: Record<string, unknown>
): Promise<TimelineEvent | null> {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const clientId = generateId();
  const eventAt = new Date().toISOString();

  // Optimistic update
  const event: TimelineEvent = {
    id: clientId,
    type,
    at: eventAt,
    summary,
    meta,
  };

  const timeline = [event, ...(contact.timeline || [])];
  updateContactV2(contactId, {
    timeline,
    lastTouchedAt: new Date().toISOString()
  });

  // Sync to server
  try {
    const serverEvent = await createTimelineEventAPI(contactId, {
      clientId,
      type,
      summary,
      meta,
      eventAt,
    });

    // Update localStorage with server ID
    const updatedTimeline = timeline.map(e =>
      e.id === clientId ? { ...e, id: serverEvent.id.toString() } : e
    );
    updateContactV2(contactId, { timeline: updatedTimeline });

    return serverEvent;
  } catch (error) {
    console.error('[Storage] Failed to sync timeline event:', error);
    addToSyncQueue('timeline_event', 'create', `/api/contacts/${contactId}/timeline`, 'POST', {
      clientId,
      type,
      summary,
      meta,
      eventAt,
    });
  }

  return event;
}

export function getTimeline(contactId: string): TimelineEvent[] {
  const contact = getContactById(contactId);
  return contact?.timeline || [];
}

// ============ TASKS ============

export async function addTask(contactId: string, title: string, dueAt?: string): Promise<ContactTask | null> {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const clientId = generateId();

  // Optimistic update - save to localStorage first for instant UI
  const task: ContactTask = {
    id: clientId,
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

  // Sync to server
  try {
    const serverTask = await createTaskAPI(contactId, { clientId, title, dueAt });

    // Update localStorage with server ID
    const updatedTasks = tasks.map(t =>
      t.id === clientId ? { ...t, id: serverTask.id.toString() } : t
    );
    updateContactV2(contactId, { tasks: updatedTasks });

    return serverTask;
  } catch (error) {
    console.error('[Storage] Failed to sync task to server:', error);
    // Queue for retry when back online
    addToSyncQueue('task', 'create', `/api/contacts/${contactId}/tasks`, 'POST', { clientId, title, dueAt });
  }

  return task;
}

export async function completeTask(contactId: string, taskId: string): Promise<boolean> {
  const contact = getContactById(contactId);
  if (!contact) return false;

  const completedAt = new Date().toISOString();

  // Optimistic update
  const tasks = (contact.tasks || []).map(t =>
    t.id === taskId
      ? { ...t, done: true, completedAt }
      : t
  );

  const task = tasks.find(t => t.id === taskId);
  if (!task) return false;

  updateContactV2(contactId, {
    tasks,
    lastTouchedAt: new Date().toISOString()
  });

  addTimelineEvent(contactId, 'task_done', `Task completed: ${task.title}`);

  // Sync to server
  try {
    await updateTaskAPI(contactId, parseInt(taskId), { done: true, completedAt });
  } catch (error) {
    console.error('[Storage] Failed to sync task completion:', error);
    addToSyncQueue('task', 'update', `/api/contacts/${contactId}/tasks/${taskId}`, 'PUT', { done: true, completedAt });
  }

  return true;
}

export async function deleteTask(contactId: string, taskId: string): Promise<boolean> {
  const contact = getContactById(contactId);
  if (!contact) return false;

  // Optimistic delete
  const tasks = (contact.tasks || []).filter(t => t.id !== taskId);
  updateContactV2(contactId, { tasks });

  // Sync to server
  try {
    await deleteTaskAPI(contactId, parseInt(taskId));
  } catch (error) {
    console.error('[Storage] Failed to delete task from server:', error);
    addToSyncQueue('task', 'delete', `/api/contacts/${contactId}/tasks/${taskId}`, 'DELETE', null);
  }

  return true;
}

export function getTasks(contactId: string): ContactTask[] {
  const contact = getContactById(contactId);
  return contact?.tasks || [];
}

// ============ REMINDERS ============

export async function addReminder(contactId: string, label: string, remindAt: string): Promise<ContactReminder | null> {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const clientId = generateId();

  // Optimistic update
  const reminder: ContactReminder = {
    id: clientId,
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

  // Sync to server
  try {
    const serverReminder = await createReminderAPI(contactId, { clientId, label, remindAt });

    // Update localStorage with server ID
    const updatedReminders = reminders.map(r =>
      r.id === clientId ? { ...r, id: serverReminder.id.toString() } : r
    );
    updateContactV2(contactId, { reminders: updatedReminders });

    return serverReminder;
  } catch (error) {
    console.error('[Storage] Failed to sync reminder to server:', error);
    addToSyncQueue('reminder', 'create', `/api/contacts/${contactId}/reminders`, 'POST', { clientId, label, remindAt });
  }

  return reminder;
}

export async function completeReminder(contactId: string, reminderId: string): Promise<boolean> {
  const contact = getContactById(contactId);
  if (!contact) return false;

  const doneAt = new Date().toISOString();

  // Optimistic update
  const reminders = (contact.reminders || []).map(r =>
    r.id === reminderId
      ? { ...r, done: true, doneAt }
      : r
  );

  const reminder = reminders.find(r => r.id === reminderId);
  if (!reminder) return false;

  updateContactV2(contactId, {
    reminders,
    lastTouchedAt: new Date().toISOString()
  });

  addTimelineEvent(contactId, 'reminder_done', `Reminder done: ${reminder.label}`);

  // Sync to server
  try {
    await updateReminderAPI(contactId, parseInt(reminderId), { done: true, doneAt });
  } catch (error) {
    console.error('[Storage] Failed to sync reminder completion:', error);
    addToSyncQueue('reminder', 'update', `/api/contacts/${contactId}/reminders/${reminderId}`, 'PUT', { done: true, doneAt });
  }

  return true;
}

export async function deleteReminder(contactId: string, reminderId: string): Promise<boolean> {
  const contact = getContactById(contactId);
  if (!contact) return false;

  // Optimistic delete
  const reminders = (contact.reminders || []).filter(r => r.id !== reminderId);
  updateContactV2(contactId, { reminders });

  // Sync to server
  try {
    await deleteReminderAPI(contactId, parseInt(reminderId));
  } catch (error) {
    console.error('[Storage] Failed to delete reminder from server:', error);
    addToSyncQueue('reminder', 'delete', `/api/contacts/${contactId}/reminders/${reminderId}`, 'DELETE', null);
  }

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

export async function addMergeHistoryEntry(entry: MergeHistoryEntry): Promise<void> {
  // Save to localStorage
  const history = loadMergeHistory();
  history.unshift(entry);
  saveMergeHistory(history);

  // Sync to server
  try {
    await createMergeHistoryAPI({
      primaryContactId: entry.primaryContactId,
      mergedContactSnapshots: entry.mergedContactSnapshots,
      mergedAt: entry.mergedAt,
    });
  } catch (error) {
    console.error('[Storage] Failed to sync merge history:', error);
    addToSyncQueue('merge_history', 'create', '/api/merge-history', 'POST', {
      primaryContactId: entry.primaryContactId,
      mergedContactSnapshots: entry.mergedContactSnapshots,
      mergedAt: entry.mergedAt,
    });
  }
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
