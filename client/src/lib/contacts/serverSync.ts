/**
 * Server sync utilities for contacts
 * Syncs timeline events and other data to the server for authenticated users
 */

import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TimelineEvent } from './types';

let cachedAuthStatus: boolean | null = null;

async function checkAuthStatus(): Promise<boolean> {
  if (cachedAuthStatus !== null) return cachedAuthStatus;
  
  try {
    const res = await fetch('/api/auth/user', { credentials: 'include' });
    if (!res.ok) {
      cachedAuthStatus = false;
      return false;
    }
    const user = await res.json();
    cachedAuthStatus = !!user;
    return cachedAuthStatus;
  } catch {
    cachedAuthStatus = false;
    return false;
  }
}

export function resetAuthCache(): void {
  cachedAuthStatus = null;
}

export async function syncTimelineEventToServer(
  contactId: string,
  event: TimelineEvent
): Promise<boolean> {
  const isAuth = await checkAuthStatus();
  if (!isAuth) return false;

  try {
    await apiRequest('PATCH', `/api/contacts/${contactId}`, {
      timeline: [event],
      lastTouchedAt: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    return true;
  } catch (e) {
    console.error('[serverSync] Failed to sync timeline event:', e);
    return false;
  }
}

export async function syncNotesToServer(
  contactId: string,
  notes: string
): Promise<boolean> {
  const isAuth = await checkAuthStatus();
  if (!isAuth) return false;

  try {
    await apiRequest('PATCH', `/api/contacts/${contactId}`, {
      notes,
      lastTouchedAt: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    return true;
  } catch (e) {
    console.error('[serverSync] Failed to sync notes:', e);
    return false;
  }
}

export async function syncRemindersToServer(
  contactId: string,
  reminders: unknown[]
): Promise<boolean> {
  const isAuth = await checkAuthStatus();
  if (!isAuth) return false;

  try {
    await apiRequest('PATCH', `/api/contacts/${contactId}`, {
      reminders,
      lastTouchedAt: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    return true;
  } catch (e) {
    console.error('[serverSync] Failed to sync reminders:', e);
    return false;
  }
}

export async function syncTasksToServer(
  contactId: string,
  tasks: unknown[]
): Promise<boolean> {
  const isAuth = await checkAuthStatus();
  if (!isAuth) return false;

  try {
    await apiRequest('PATCH', `/api/contacts/${contactId}`, {
      tasks,
      lastTouchedAt: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    return true;
  } catch (e) {
    console.error('[serverSync] Failed to sync tasks:', e);
    return false;
  }
}
