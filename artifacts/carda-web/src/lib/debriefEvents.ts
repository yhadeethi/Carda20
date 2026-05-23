const KEY = "carda_debrief_events";
const MAX = 100;

export interface DebriefEvent {
  completedAt: string; // ISO
  contactId: string;
}

export function logDebriefEvent(contactId: string): void {
  try {
    const stored = localStorage.getItem(KEY);
    const events: DebriefEvent[] = stored ? JSON.parse(stored) : [];
    events.push({ completedAt: new Date().toISOString(), contactId });
    localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX)));
  } catch {
    // fail silently
  }
}
