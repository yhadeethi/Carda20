const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface Contact {
  id: number;
  publicId?: string;
  userId?: number;
  fullName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  rawText?: string;
  companyDomain?: string;
  companyId?: number;
  notes?: string;
  orgRelationshipStrength?: string;
  createdAt?: string;
}

export interface ContactActivity {
  id: string;
  type: "note" | "call" | "meeting" | "email";
  text: string;
  createdAt: string;
}

export interface Company {
  id: number;
  name: string;
  domain?: string;
  industry?: string;
  sizeBand?: string;
  hqCountry?: string;
  hqCity?: string;
}

export interface UserEvent {
  id: number;
  title: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  notes?: string;
  eventLink?: string;
  isActive?: boolean;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
}

export interface ScanResult {
  rawText: string;
  contact: Partial<Contact>;
}

export interface ContactTask {
  id: number;
  contactId: number;
  userId: number;
  clientId: string;
  title: string;
  done: number;
  dueAt?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface TimelineEvent {
  id: number;
  contactId: number;
  userId: number;
  clientId: string;
  type: string;
  summary: string;
  meta?: Record<string, unknown> | null;
  eventAt: string;
  createdAt?: string;
}

export interface ContactReminder {
  id: number;
  contactId: number;
  userId: number;
  clientId: string;
  label: string;
  remindAt: string;
  done: number;
  doneAt?: string | null;
  createdAt?: string;
}

export interface IntelResult {
  companyName?: string;
  domain?: string;
  description?: string;
  industry?: string;
  founded?: string;
  size?: string;
  headquarters?: string;
  funding?: string;
  keyPeople?: string[];
  recentNews?: Array<{ title: string; summary: string; date?: string }>;
  products?: string[];
  competitors?: string[];
  techStack?: string[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const isFormData = options?.body instanceof FormData;
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      const err = new Error("Unauthorized") as any;
      err.status = 401;
      throw err;
    }
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text);
}

export const api = {
  getContacts: (): Promise<Contact[]> => apiFetch("/api/contacts"),

  getContact: (id: number): Promise<Contact> => apiFetch(`/api/contacts/${id}`),

  createContact: (data: Partial<Contact>): Promise<Contact> =>
    apiFetch("/api/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateContact: (id: number, data: Partial<Contact>): Promise<Contact> =>
    apiFetch(`/api/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteContact: (id: number): Promise<void> =>
    apiFetch(`/api/contacts/${id}`, { method: "DELETE" }),

  scanCard: (formData: FormData): Promise<ScanResult> =>
    apiFetch("/api/scan-ai", { method: "POST", body: formData }),

  parseText: (text: string): Promise<{ contact: Partial<Contact> }> =>
    apiFetch("/api/parse-ai", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getCompanies: (): Promise<Company[]> => apiFetch("/api/companies"),

  getIntel: (companyName: string, domain?: string): Promise<IntelResult> =>
    apiFetch(
      `/api/intel-v2?companyName=${encodeURIComponent(companyName)}${
        domain ? `&domain=${encodeURIComponent(domain)}` : ""
      }`
    ),

  getUserEvents: (): Promise<UserEvent[]> => apiFetch("/api/user-events"),

  getUserEvent: (id: number): Promise<UserEvent> =>
    apiFetch(`/api/user-events/${id}`),

  createUserEvent: (data: {
    title: string;
    locationLabel?: string;
  }): Promise<UserEvent> =>
    apiFetch("/api/user-events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUserEvent: (id: number, data: Partial<UserEvent>): Promise<UserEvent> =>
    apiFetch(`/api/user-events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteUserEvent: (id: number): Promise<void> =>
    apiFetch(`/api/user-events/${id}`, { method: "DELETE" }),

  getEventContacts: (id: number): Promise<Contact[]> =>
    apiFetch(`/api/user-events/${id}/contacts`),

  getContactTasks: (contactId: number): Promise<ContactTask[]> =>
    apiFetch(`/api/contacts/${contactId}/tasks`),

  createContactTask: (
    contactId: number,
    data: { clientId: string; title: string; dueAt?: string }
  ): Promise<ContactTask> =>
    apiFetch(`/api/contacts/${contactId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateContactTask: (
    contactId: number,
    taskId: number,
    data: { done?: boolean; title?: string; dueAt?: string }
  ): Promise<ContactTask> =>
    apiFetch(`/api/contacts/${contactId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteContactTask: (contactId: number, taskId: number): Promise<void> =>
    apiFetch(`/api/contacts/${contactId}/tasks/${taskId}`, {
      method: "DELETE",
    }),

  getContactTimeline: (contactId: number): Promise<TimelineEvent[]> =>
    apiFetch(`/api/contacts/${contactId}/timeline`),

  createTimelineEvent: (
    contactId: number,
    data: {
      clientId: string;
      type: string;
      summary: string;
      eventAt: string;
      meta?: Record<string, unknown>;
    }
  ): Promise<unknown> =>
    apiFetch(`/api/contacts/${contactId}/timeline`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getContactReminders: (contactId: number): Promise<ContactReminder[]> =>
    apiFetch(`/api/contacts/${contactId}/reminders`),

  createContactReminder: (
    contactId: number,
    data: { clientId: string; label: string; remindAt: string }
  ): Promise<ContactReminder> =>
    apiFetch(`/api/contacts/${contactId}/reminders`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateContactReminder: (
    contactId: number,
    reminderId: number,
    data: { done?: boolean; doneAt?: string | null; label?: string; remindAt?: string }
  ): Promise<ContactReminder> =>
    apiFetch(`/api/contacts/${contactId}/reminders/${reminderId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteContactReminder: (contactId: number, reminderId: number): Promise<void> =>
    apiFetch(`/api/contacts/${contactId}/reminders/${reminderId}`, {
      method: "DELETE",
    }),

  generateFollowUp: (data: {
    contact: { name: string; company?: string; title?: string; email?: string };
    request: {
      mode: "email_followup" | "linkedin_message" | "meeting_intro";
      tone: "friendly" | "direct" | "warm" | "formal";
      goal?: string;
      context?: string;
      length: "short" | "medium";
    };
  }): Promise<{ subject?: string; body: string; bullets: string[] }> =>
    apiFetch("/api/followup", {
      method: "POST",
      body: JSON.stringify(data),
    }),


  getHubSpotStatus: (): Promise<{ connected: boolean }> =>
    apiFetch("/api/hubspot/status"),

  getSalesforceStatus: (): Promise<{ connected: boolean }> =>
    apiFetch("/api/salesforce/status"),

  syncHubSpot: (): Promise<void> =>
    apiFetch("/api/hubspot/sync-all", { method: "POST", body: JSON.stringify({}) }),

  syncSalesforce: (): Promise<void> =>
    apiFetch("/api/salesforce/sync-all", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
