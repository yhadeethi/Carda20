import { isUUID } from '../contacts/ids';

const CONTACTS_V1_KEY = 'carda_contacts_v1';
const CONTACTS_V2_KEY = 'carda_contacts_v2';
const COMPANIES_V1_KEY = 'carda_companies_v1';
const COMPANIES_V2_KEY = 'carda_companies_v2';
const MERGE_HISTORY_KEY = 'carda_merges_v1';

function loadJSON(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJSON(key: string, data: any[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function runIdNormalization(userId: string | number): void {
  const flagKey = `carda_ids_normalized_${userId}`;
  if (localStorage.getItem(flagKey)) return;

  console.log('[NormalizeIds] Starting ID normalization for user', userId);

  // Step 1: Ensure companies v2 exists (import v1 if v2 empty)
  let companiesV2 = loadJSON(COMPANIES_V2_KEY);
  if (companiesV2.length === 0) {
    const companiesV1 = loadJSON(COMPANIES_V1_KEY);
    if (companiesV1.length > 0) {
      companiesV2 = [...companiesV1];
      saveJSON(COMPANIES_V2_KEY, companiesV2);
      console.log(`[NormalizeIds] Imported ${companiesV1.length} companies from v1 to v2`);
    }
  }

  // Step 2: Normalize companies v2 — build oldCompanyId -> newUUID map
  const companyIdMap = new Map<string, string>();
  let companiesChanged = false;

  for (const company of companiesV2) {
    if (!isUUID(company.id)) {
      const newId = crypto.randomUUID();
      companyIdMap.set(company.id, newId);
      company.legacyId = company.id;
      company.id = newId;
      company._needsUpsert = true;
      companiesChanged = true;
    }
  }

  if (companiesChanged) {
    saveJSON(COMPANIES_V2_KEY, companiesV2);
    console.log(`[NormalizeIds] Normalized ${companyIdMap.size} company IDs`);
  }

  // Step 3: Ensure contacts v2 exists (import v1 if v2 empty)
  let contactsV2 = loadJSON(CONTACTS_V2_KEY);
  if (contactsV2.length === 0) {
    const contactsV1 = loadJSON(CONTACTS_V1_KEY);
    if (contactsV1.length > 0) {
      contactsV2 = contactsV1.map((c: any) => ({
        ...c,
        tasks: c.tasks || [],
        reminders: c.reminders || [],
        timeline: c.timeline || [{
          id: crypto.randomUUID(),
          type: 'scan_created',
          at: c.createdAt || new Date().toISOString(),
          summary: 'Contact created',
        }],
        lastTouchedAt: c.createdAt,
        notes: c.notes || '',
      }));
      saveJSON(CONTACTS_V2_KEY, contactsV2);
      console.log(`[NormalizeIds] Imported ${contactsV1.length} contacts from v1 to v2`);
    }
  }

  // Step 4: Normalize contacts v2 — build oldContactId -> newUUID map
  const contactIdMap = new Map<string, string>();
  let contactsChanged = false;

  for (const contact of contactsV2) {
    if (!isUUID(contact.id)) {
      const newId = crypto.randomUUID();
      contactIdMap.set(contact.id, newId);
      contact.legacyId = contact.id;
      contact.id = newId;
      contact._needsUpsert = true;
      contactsChanged = true;
    }
  }

  // Step 5: Rewrite contact references using maps
  for (const contact of contactsV2) {
    // Rewrite companyId using company map
    if (contact.companyId && companyIdMap.has(contact.companyId)) {
      contact.companyId = companyIdMap.get(contact.companyId);
      contactsChanged = true;
    }

    // Rewrite org.reportsToId using contact map
    if (contact.org?.reportsToId && contactIdMap.has(contact.org.reportsToId)) {
      contact.org.reportsToId = contactIdMap.get(contact.org.reportsToId);
      contactsChanged = true;
    }

    // Rewrite legacy managerContactId using contact map
    if (contact.managerContactId && contactIdMap.has(contact.managerContactId)) {
      contact.managerContactId = contactIdMap.get(contact.managerContactId);
      contactsChanged = true;
    }

    // Rewrite mergeMeta.mergedFromIds using contact map
    if (contact.mergeMeta?.mergedFromIds && Array.isArray(contact.mergeMeta.mergedFromIds)) {
      contact.mergeMeta.mergedFromIds = contact.mergeMeta.mergedFromIds.map(
        (oldId: string) => contactIdMap.get(oldId) || oldId
      );
      contactsChanged = true;
    }
  }

  if (contactsChanged) {
    saveJSON(CONTACTS_V2_KEY, contactsV2);
    console.log(`[NormalizeIds] Normalized ${contactIdMap.size} contact IDs, rewrote references`);
  }

  // Step 6: Rewrite merge history references
  const mergeHistory = loadJSON(MERGE_HISTORY_KEY);
  let mergeChanged = false;

  for (const entry of mergeHistory) {
    if (entry.primaryContactId && contactIdMap.has(entry.primaryContactId)) {
      entry.primaryContactId = contactIdMap.get(entry.primaryContactId);
      mergeChanged = true;
    }

    if (Array.isArray(entry.mergedContactSnapshots)) {
      for (const snapshot of entry.mergedContactSnapshots) {
        if (snapshot.data?.id && contactIdMap.has(snapshot.data.id)) {
          snapshot.data.legacyId = snapshot.data.id;
          snapshot.data.id = contactIdMap.get(snapshot.data.id);
          mergeChanged = true;
        }
      }
    }
  }

  if (mergeChanged) {
    saveJSON(MERGE_HISTORY_KEY, mergeHistory);
    console.log(`[NormalizeIds] Rewrote merge history references`);
  }

  // Step 7: Also update v1 stores to keep in sync (legacy readers)
  if (contactsChanged) {
    saveJSON(CONTACTS_V1_KEY, contactsV2.map((c: any) => {
      const { tasks, reminders, timeline, lastTouchedAt, mergeMeta, ...v1Fields } = c;
      return v1Fields;
    }));
  }

  // Set the user-scoped flag
  localStorage.setItem(flagKey, new Date().toISOString());
  console.log('[NormalizeIds] Normalization complete');
}
