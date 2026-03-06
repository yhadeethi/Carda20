import { addToSyncQueue } from '../syncQueue';
import type { StoredContact } from '../contactsStorage';
import type { Company } from '../companiesStorage';

export function buildContactUpsertPayload(contact: StoredContact): Record<string, any> {
  const payload: Record<string, any> = {
    publicId: contact.id,
  };

  if (contact.name) payload.fullName = contact.name;
  if (contact.company) payload.companyName = contact.company;
  if (contact.title) payload.jobTitle = contact.title;
  if (contact.email) payload.email = contact.email;
  if (contact.phone) payload.phone = contact.phone;
  if (contact.website) payload.website = contact.website;
  if (contact.linkedinUrl) payload.linkedinUrl = contact.linkedinUrl;

  if (contact.org) {
    if (contact.org.department && contact.org.department !== 'UNKNOWN') payload.orgDepartment = contact.org.department;
    if (contact.org.role && contact.org.role !== 'UNKNOWN') payload.orgRole = contact.org.role;
    if (contact.org.influence && contact.org.influence !== 'UNKNOWN') payload.orgInfluence = contact.org.influence;
    if (contact.org.relationshipStrength && contact.org.relationshipStrength !== 'UNKNOWN') payload.orgRelationshipStrength = contact.org.relationshipStrength;
  }

  return payload;
}

export async function upsertContactToServer(contact: StoredContact): Promise<boolean> {
  const payload = buildContactUpsertPayload(contact);
  try {
    const res = await fetch('/api/contacts/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log(`[Sync] Upserted contact ${contact.id} to server`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Contact upsert failed, queuing:`, e);
    addToSyncQueue('contact_upsert', 'update', '/api/contacts/upsert', 'POST', payload);
    return false;
  }
}

function stripLocalFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const { _needsUpsert, legacyId, tasks, reminders, timeline, lastTouchedAt, mergeMeta, notes, ...rest } = obj as any;
  return rest;
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

export async function deleteCompanyFromServer(companyId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/companies/${companyId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      console.log(`[Sync] Deleted company ${companyId} from server`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Company delete failed:`, e);
    return false;
  }
}

export async function deleteContactFromServer(contactId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      console.log(`[Sync] Deleted contact ${contactId} from server`);
      return true;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.warn(`[Sync] Contact delete failed:`, e);
    return false;
  }
}

export async function attachContactToEventServer(
  eventPublicId: string,
  contactPublicIds: string[]
): Promise<boolean> {
  try {
    const res = await fetch(`/api/events/${eventPublicId}/contacts/attach`, {
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
      `/api/events/${eventPublicId}/contacts/attach`,
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
    const res = await fetch('/api/events/upsert', {
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
    addToSyncQueue('event_upsert', 'update', '/api/events/upsert', 'POST', eventData);
    return false;
  }
}
