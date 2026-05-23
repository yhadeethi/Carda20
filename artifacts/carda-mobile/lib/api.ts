const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface Contact {
  id: number;
  userId?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
  notes?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  id: number;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  description?: string;
}

export interface UserEvent {
  id: number;
  name: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface IntelResult {
  company?: string;
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

  scanCard: (formData: FormData): Promise<Partial<Contact>> =>
    apiFetch("/api/scan-ai", { method: "POST", body: formData }),

  getCompanies: (): Promise<Company[]> => apiFetch("/api/companies"),

  getIntel: (company: string, domain?: string): Promise<IntelResult> =>
    apiFetch(
      `/api/intel-v2?company=${encodeURIComponent(company)}${
        domain ? `&domain=${encodeURIComponent(domain)}` : ""
      }`
    ),

  getUserEvents: (): Promise<UserEvent[]> => apiFetch("/api/user-events"),

  getUserEvent: (id: number): Promise<UserEvent> =>
    apiFetch(`/api/user-events/${id}`),

  createUserEvent: (data: {
    name: string;
    location?: string;
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
