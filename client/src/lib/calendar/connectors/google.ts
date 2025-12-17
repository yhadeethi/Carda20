/**
 * Google Calendar Connector (Stub for v2)
 * Placeholder for future OAuth integration
 */

export interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
}

// Stub: Create event via Google Calendar API
export async function createEvent(_event: GoogleCalendarEvent): Promise<{ success: boolean; error?: string }> {
  console.warn('[GoogleCalendar] OAuth not configured. Use ICS download instead.');
  return { success: false, error: 'Google Calendar integration coming soon' };
}

// Stub: Check if connected
export function isConnected(): boolean {
  return false;
}

// Stub: Initiate OAuth flow
export function connect(): void {
  console.warn('[GoogleCalendar] OAuth flow not implemented');
}

// Stub: Disconnect
export function disconnect(): void {
  console.warn('[GoogleCalendar] Disconnect not implemented');
}
