import { apiRequest } from "@/lib/queryClient";

export type UserEventSource = "manual" | "calendar";

export type UserEvent = {
  id: string;
  title: string;
  startAt: string | null;
  locationTag: string | null;
  coords: { lat: number; lon: number } | null;
  tags: string[];
  notes: string;
  source: UserEventSource;
  calendarMeta: any | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreateUserEventInput = {
  title: string;
  startAt?: string | null;
  locationTag?: string | null;
  coords?: { lat: number; lon: number } | null;
  tags?: string[];
  notes?: string | null;
  source?: UserEventSource;
  calendarMeta?: any | null;
};

export type UpdateUserEventInput = Partial<CreateUserEventInput>;

type DbUserEvent = {
  id: number;
  userId: number;
  title: string;
  startAt: string | null;
  locationTag: string | null;
  coords: { lat: number; lon: number } | null;
  tags: string[] | null;
  notes: string | null;
  source: UserEventSource | null;
  calendarMeta: any | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function dbToUserEvent(e: DbUserEvent): UserEvent {
  return {
    id: String(e.id),
    title: e.title,
    startAt: e.startAt,
    locationTag: e.locationTag,
    coords: e.coords ?? null,
    tags: Array.isArray(e.tags) ? e.tags : [],
    notes: e.notes ?? "",
    source: (e.source ?? "manual") as UserEventSource,
    calendarMeta: e.calendarMeta ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export async function listUserEvents(limit = 50): Promise<UserEvent[]> {
  const res = await apiRequest("GET", `/api/user-events?limit=${limit}`);
  const data = (await res.json()) as DbUserEvent[];
  return data.map(dbToUserEvent);
}

export async function createUserEvent(input: CreateUserEventInput): Promise<UserEvent> {
  const res = await apiRequest("POST", "/api/user-events", input);
  const data = (await res.json()) as DbUserEvent;
  return dbToUserEvent(data);
}

export async function updateUserEvent(id: string, updates: UpdateUserEventInput): Promise<UserEvent> {
  const res = await apiRequest("PATCH", `/api/user-events/${id}`, updates);
  const data = (await res.json()) as DbUserEvent;
  return dbToUserEvent(data);
}

export async function deleteUserEvent(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/user-events/${id}`);
}

const ACTIVE_KEY = "carda_active_user_event_id_v1";

export function getActiveUserEventId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveUserEventId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}
