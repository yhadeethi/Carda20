import { upsertEventPreferenceAPI } from './api/timeline';
import { addToSyncQueue } from './syncQueue';

const EVENTS_PREFS_KEY = 'carda_event_prefs_v1';

export interface EventUserPrefs {
  pinned: boolean;
  attending: 'yes' | 'no' | 'maybe' | null;
  note: string;
  reminderSet: boolean;
  reminderDismissed: boolean;
}

export interface EventPrefsMap {
  [eventId: string]: EventUserPrefs;
}

function loadAllPrefs(): EventPrefsMap {
  try {
    const raw = localStorage.getItem(EVENTS_PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as EventPrefsMap;
  } catch {
    return {};
  }
}

function saveAllPrefs(prefs: EventPrefsMap): void {
  try {
    localStorage.setItem(EVENTS_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    console.error('Failed to save event preferences');
  }
}

// Helper to sync single preference to server
async function syncPrefToServer(eventId: string, prefs: EventUserPrefs): Promise<void> {
  try {
    await upsertEventPreferenceAPI(eventId, {
      pinned: prefs.pinned,
      attending: prefs.attending,
      note: prefs.note || '',
      reminderSet: prefs.reminderSet,
      reminderDismissed: prefs.reminderDismissed,
    });
  } catch (error) {
    console.error('[EventPrefs] Failed to sync to server:', error);
    addToSyncQueue('event_preference', 'create', `/api/events/${eventId}/preferences`, 'POST', {
      pinned: prefs.pinned,
      attending: prefs.attending,
      note: prefs.note || '',
      reminderSet: prefs.reminderSet,
      reminderDismissed: prefs.reminderDismissed,
    });
  }
}

export function getEventPrefs(eventId: string): EventUserPrefs {
  const all = loadAllPrefs();
  return all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
}

export async function setEventPinned(eventId: string, pinned: boolean): Promise<void> {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, pinned };
  saveAllPrefs(all);

  // Sync to server
  await syncPrefToServer(eventId, all[eventId]);
}

export async function setEventAttending(eventId: string, attending: 'yes' | 'no' | 'maybe' | null): Promise<void> {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, attending };
  saveAllPrefs(all);

  // Sync to server
  await syncPrefToServer(eventId, all[eventId]);
}

export async function setEventNote(eventId: string, note: string): Promise<void> {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, note };
  saveAllPrefs(all);

  // Sync to server
  await syncPrefToServer(eventId, all[eventId]);
}

export async function setEventReminder(eventId: string, reminderSet: boolean): Promise<void> {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, reminderSet };
  saveAllPrefs(all);

  // Sync to server
  await syncPrefToServer(eventId, all[eventId]);
}

export async function dismissEventReminder(eventId: string): Promise<void> {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, reminderDismissed: true };
  saveAllPrefs(all);

  // Sync to server
  await syncPrefToServer(eventId, all[eventId]);
}

export function getEventsWithReminders(): string[] {
  const all = loadAllPrefs();
  return Object.entries(all)
    .filter(([, prefs]) => prefs.reminderSet && !prefs.reminderDismissed)
    .map(([id]) => id);
}

export function getAllEventPrefs(): EventPrefsMap {
  return loadAllPrefs();
}

export function getPinnedEventIds(): string[] {
  const all = loadAllPrefs();
  return Object.entries(all)
    .filter(([, prefs]) => prefs.pinned)
    .map(([id]) => id);
}

export function getAttendingEventIds(): string[] {
  const all = loadAllPrefs();
  return Object.entries(all)
    .filter(([, prefs]) => prefs.attending === 'yes')
    .map(([id]) => id);
}
