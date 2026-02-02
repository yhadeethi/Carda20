/**
 * User Events API Client
 * Handles all API interactions for user-created events
 */

import { apiRequest } from "./queryClient";

export interface UserEvent {
  id: number;
  userId: number;
  title: string;
  startAt: string;
  endAt: string | null;
  locationLabel: string | null;
  lat: string | null;
  lng: string | null;
  tags: string[];
  notes: string | null;
  source: 'manual' | 'calendar_import' | 'scan_draft';
  isDraft: number; // 0 or 1
  createdAt: string;
  updatedAt: string;
}

export interface UserEventContact {
  id: number;
  userId: number;
  eventId: number;
  contactIdV1: string | null;
  contactIdV2: number | null;
  createdAt: string;
}

export interface CreateEventPayload {
  title: string;
  startAt?: string;
  endAt?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  notes?: string;
  source?: 'manual' | 'calendar_import' | 'scan_draft';
}

export interface UpdateEventPayload {
  title?: string;
  startAt?: string;
  endAt?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  notes?: string;
}

export interface FinalizeEventPayload {
  title: string;
  notes?: string;
  tags?: string[];
  locationLabel?: string;
}

export interface ContactRef {
  contactIdV1?: string;
  contactIdV2?: number;
  id?: string; // alias for v1
  v1?: string;
  v2?: number;
}

// Sydney bounding box (approximate)
const SYDNEY_BOUNDS = {
  minLat: -34.2,
  maxLat: -33.5,
  minLng: 150.5,
  maxLng: 151.4,
};

export function isInSydney(lat: number, lng: number): boolean {
  return (
    lat >= SYDNEY_BOUNDS.minLat &&
    lat <= SYDNEY_BOUNDS.maxLat &&
    lng >= SYDNEY_BOUNDS.minLng &&
    lng <= SYDNEY_BOUNDS.maxLng
  );
}

/**
 * Request user's geolocation
 */
export async function requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
}

/**
 * List all user events
 */
export async function listUserEvents(limit?: number): Promise<UserEvent[]> {
  const url = limit ? `/api/user-events?limit=${limit}` : "/api/user-events";
  const res = await apiRequest("GET", url);
  return res.json();
}

/**
 * Get a specific event
 */
export async function getUserEvent(eventId: number): Promise<UserEvent> {
  const res = await apiRequest("GET", `/api/user-events/${eventId}`);
  return res.json();
}

/**
 * Create a new event
 */
export async function createUserEvent(payload: CreateEventPayload): Promise<UserEvent> {
  const res = await apiRequest("POST", "/api/user-events", payload);
  return res.json();
}

/**
 * Update an event
 */
export async function updateUserEvent(eventId: number, payload: UpdateEventPayload): Promise<UserEvent> {
  const res = await apiRequest("PATCH", `/api/user-events/${eventId}`, payload);
  return res.json();
}

/**
 * Delete an event
 */
export async function deleteUserEvent(eventId: number): Promise<void> {
  await apiRequest("DELETE", `/api/user-events/${eventId}`);
}

/**
 * End an event (set endAt to now)
 */
export async function endUserEvent(eventId: number): Promise<UserEvent> {
  const res = await apiRequest("POST", `/api/user-events/${eventId}/end`);
  return res.json();
}

/**
 * Get or create a draft event for scan mode
 */
export async function getOrCreateDraftEvent(): Promise<UserEvent> {
  const res = await apiRequest("POST", "/api/user-events/draft");
  return res.json();
}

/**
 * Finalize a draft event
 */
export async function finalizeDraftEvent(eventId: number, payload: FinalizeEventPayload): Promise<UserEvent> {
  const res = await apiRequest("POST", `/api/user-events/${eventId}/finalize`, payload);
  return res.json();
}

/**
 * Get contacts attached to an event
 */
export async function getEventContacts(eventId: number): Promise<UserEventContact[]> {
  const res = await apiRequest("GET", `/api/user-events/${eventId}/contacts`);
  return res.json();
}

/**
 * Attach contacts to an event
 */
export async function attachContactsToEvent(eventId: number, contacts: ContactRef[]): Promise<UserEventContact[]> {
  const res = await apiRequest("POST", `/api/user-events/${eventId}/attach-contacts`, { contacts });
  return res.json();
}

/**
 * Create event with geolocation (auto-tags Sydney if applicable)
 */
export async function createEventWithLocation(
  title: string,
  options: {
    notes?: string;
    tags?: string[];
    requestLocation?: boolean;
  } = {}
): Promise<UserEvent> {
  const { notes, tags = [], requestLocation = true } = options;

  let location: { lat: number; lng: number } | null = null;
  let locationLabel: string | undefined;
  let finalTags = [...tags];

  if (requestLocation) {
    location = await requestGeolocation();
    if (location && isInSydney(location.lat, location.lng)) {
      locationLabel = "Sydney";
      if (!finalTags.includes("Sydney")) {
        finalTags.push("Sydney");
      }
    }
  }

  return createUserEvent({
    title,
    notes,
    tags: finalTags,
    locationLabel,
    lat: location?.lat,
    lng: location?.lng,
    source: 'manual',
  });
}
