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

export function getEventPrefs(eventId: string): EventUserPrefs {
  const all = loadAllPrefs();
  return all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
}

export function setEventPinned(eventId: string, pinned: boolean): void {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, pinned };
  saveAllPrefs(all);
}

export function setEventAttending(eventId: string, attending: 'yes' | 'no' | 'maybe' | null): void {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, attending };
  saveAllPrefs(all);
}

export function setEventNote(eventId: string, note: string): void {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, note };
  saveAllPrefs(all);
}

export function setEventReminder(eventId: string, reminderSet: boolean): void {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, reminderSet };
  saveAllPrefs(all);
}

export function dismissEventReminder(eventId: string): void {
  const all = loadAllPrefs();
  const current = all[eventId] || { pinned: false, attending: null, note: '', reminderSet: false, reminderDismissed: false };
  all[eventId] = { ...current, reminderDismissed: true };
  saveAllPrefs(all);
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
