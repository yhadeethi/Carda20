import { addToSyncQueue } from '../syncQueue';
import type { StoredContact } from '../contactsStorage';
import type { Company } from '../companiesStorage';

function stripLocalFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const { _needsUpsert, legacyId, tasks, reminders, timeline, lastTouchedAt, mergeMeta, notes, ...rest } = obj as any;
  return rest;
}

export async function upsertContactToServer(contact: StoredContact): Promise<boolean> {
  const payload = stripLocalFields(contact);
  try {
    const res = await fetch('/api/contacts/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ publicId: contact.id, ...payload }),
    });
    if (res.ok) {
      console.log(`[Sync] Upserted contact ${contact.id} to server`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Contact upsert failed, queuing:`, e);
    addToSyncQueue('contact_upsert', 'update', '/api/contacts/upsert', 'POST', { publicId: contact.id, ...payload });
    return false;
  }
}

export async function upsertCompanyToServer(company: Company): Promise<boolean> {
  const payload = stripLocalFields(company);
  try {
    const res = await fetch('/api/companies/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ publicId: company.id, ...payload }),
    });
    if (res.ok) {
      console.log(`[Sync] Upserted company ${company.id} to server`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Company upsert failed, queuing:`, e);
    addToSyncQueue('company_upsert', 'update', '/api/companies/upsert', 'POST', { publicId: company.id, ...payload });
    return false;
  }
}

export async function attachContactToEventServer(
  eventPublicId: string,
  contactPublicIds: string[]
): Promise<boolean> {
  try {
    const res = await fetch(`/api/user-events/${eventPublicId}/attach-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contactPublicIds }),
    });
    if (res.ok) {
      console.log(`[Sync] Attached ${contactPublicIds.length} contacts to event ${eventPublicId}`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Event attach failed, queuing:`, e);
    addToSyncQueue(
      'event_attach_contacts',
      'create',
      `/api/user-events/${eventPublicId}/attach-contacts`,
      'POST',
      { contactPublicIds }
    );
    return false;
  }
}

export async function upsertEventToServer(eventData: {
  publicId: string;
  title: string;
  tags?: string[];
  notes?: string;
  eventLink?: string;
  locationLabel?: string;
  latitude?: string;
  longitude?: string;
  isActive?: number;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/user-events/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(eventData),
    });
    if (res.ok) {
      console.log(`[Sync] Upserted event ${eventData.publicId} to server`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Event upsert failed, queuing:`, e);
    addToSyncQueue('event_upsert', 'update', '/api/user-events/upsert', 'POST', eventData);
    return false;
  }
}
