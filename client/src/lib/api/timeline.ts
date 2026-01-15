/**
 * API Client for Timeline Data
 * Centralized functions for calling timeline-related endpoints
 */

// Tasks API
export async function createTaskAPI(contactId: string, data: {
  clientId: string;
  title: string;
  dueAt?: string;
}): Promise<any> {
  const response = await fetch(`/api/contacts/${contactId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }

  return response.json();
}

export async function updateTaskAPI(contactId: string, taskId: number, updates: {
  done?: boolean;
  completedAt?: string | null;
  title?: string;
  dueAt?: string | null;
}): Promise<any> {
  const response = await fetch(`/api/contacts/${contactId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update task: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteTaskAPI(contactId: string, taskId: number): Promise<void> {
  const response = await fetch(`/api/contacts/${contactId}/tasks/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete task: ${response.statusText}`);
  }
}

// Reminders API
export async function createReminderAPI(contactId: string, data: {
  clientId: string;
  label: string;
  remindAt: string;
}): Promise<any> {
  const response = await fetch(`/api/contacts/${contactId}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create reminder: ${response.statusText}`);
  }

  return response.json();
}

export async function updateReminderAPI(contactId: string, reminderId: number, updates: {
  done?: boolean;
  doneAt?: string | null;
  label?: string;
  remindAt?: string;
}): Promise<any> {
  const response = await fetch(`/api/contacts/${contactId}/reminders/${reminderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update reminder: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteReminderAPI(contactId: string, reminderId: number): Promise<void> {
  const response = await fetch(`/api/contacts/${contactId}/reminders/${reminderId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete reminder: ${response.statusText}`);
  }
}

// Timeline Events API
export async function createTimelineEventAPI(contactId: string, data: {
  clientId: string;
  type: string;
  summary: string;
  meta?: Record<string, unknown>;
  eventAt: string;
}): Promise<any> {
  const response = await fetch(`/api/contacts/${contactId}/timeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create timeline event: ${response.statusText}`);
  }

  return response.json();
}

// Event Preferences API
export async function upsertEventPreferenceAPI(eventId: string, data: {
  pinned?: boolean;
  attending?: 'yes' | 'no' | 'maybe' | null;
  note?: string;
  reminderSet?: boolean;
  reminderDismissed?: boolean;
}): Promise<any> {
  const response = await fetch(`/api/events/${eventId}/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to save event preferences: ${response.statusText}`);
  }

  return response.json();
}

export async function getEventPreferenceAPI(eventId: string): Promise<any> {
  const response = await fetch(`/api/events/${eventId}/preferences`);

  if (!response.ok) {
    throw new Error(`Failed to get event preferences: ${response.statusText}`);
  }

  return response.json();
}

export async function getAllEventPreferencesAPI(): Promise<any[]> {
  const response = await fetch(`/api/events/preferences`);

  if (!response.ok) {
    throw new Error(`Failed to get all event preferences: ${response.statusText}`);
  }

  return response.json();
}

// Merge History API
export async function createMergeHistoryAPI(data: {
  primaryContactId: string;
  mergedContactSnapshots: any[];
  mergedAt: string;
}): Promise<any> {
  const response = await fetch(`/api/merge-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to save merge history: ${response.statusText}`);
  }

  return response.json();
}

export async function getMergeHistoryAPI(limit: number = 10): Promise<any[]> {
  const response = await fetch(`/api/merge-history?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`Failed to get merge history: ${response.statusText}`);
  }

  return response.json();
}
