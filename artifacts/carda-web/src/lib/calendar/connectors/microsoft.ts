/**
 * Microsoft 365 Calendar Connector (Stub for v2)
 * Placeholder for future OAuth integration
 */

export interface MicrosoftCalendarEvent {
  subject: string;
  body?: { contentType: 'text' | 'html'; content: string };
  location?: { displayName: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ emailAddress: { address: string; name?: string } }>;
}

// Stub: Create event via Microsoft Graph API
export async function createEvent(_event: MicrosoftCalendarEvent): Promise<{ success: boolean; error?: string }> {
  console.warn('[Microsoft365] OAuth not configured. Use ICS download instead.');
  return { success: false, error: 'Microsoft 365 integration coming soon' };
}

// Stub: Check if connected
export function isConnected(): boolean {
  return false;
}

// Stub: Initiate OAuth flow
export function connect(): void {
  console.warn('[Microsoft365] OAuth flow not implemented');
}

// Stub: Disconnect
export function disconnect(): void {
  console.warn('[Microsoft365] Disconnect not implemented');
}
