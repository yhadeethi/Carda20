import { loadContacts, saveContacts, type StoredContact } from './contactsStorage';
import { getCompanies, saveCompanies, type Company } from './companiesStorage';
import { upsertContactToServer, upsertCompanyToServer } from './api/sync';
import { normalizeServerContact, normalizeServerCompany } from './contacts/normalize';
import { normalizeCompany } from './contacts/dedupe';

interface ServerContactRaw {
  id: number;
  publicId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  website: string | null;
  linkedinUrl: string | null;
  address: string | null;
}

interface ServerContact extends Omit<ServerContactRaw, 'id'> {
  id: string;
  dbId?: number;
}

interface ServerCompany {
  id: number;
  publicId: string;
  name: string;
  domain: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
}

const CANONICAL_CONTACT_FIELDS: (keyof StoredContact)[] = ['name', 'email', 'phone', 'title', 'company', 'website', 'linkedinUrl', 'address'];

function mergeServerContact(local: StoredContact, server: ServerContact): StoredContact {
  const merged = { ...local };
  if (server.fullName) merged.name = server.fullName;
  if (server.email) merged.email = server.email;
  if (server.phone) merged.phone = server.phone;
  if (server.jobTitle) merged.title = server.jobTitle;
  if (server.company) merged.company = server.company;
  if (server.website) merged.website = server.website;
  if (server.linkedinUrl) merged.linkedinUrl = server.linkedinUrl;
  if (server.address) merged.address = server.address;
  return merged;
}

function mergeServerCompany(local: Company, server: ServerCompany): Company {
  const merged = { ...local };
  if (server.name) merged.name = server.name;
  if (server.domain) merged.domain = server.domain;
  if (server.city) merged.city = server.city;
  if (server.state) merged.state = server.state;
  if (server.country) merged.country = server.country;
  if (server.notes) merged.notes = server.notes;
  return merged;
}

export async function hydrateFromServer(): Promise<void> {
  console.log('[Hydration] Starting server hydration...');

  try {
    const [contactsRes, companiesRes] = await Promise.all([
      fetch('/api/contacts', { credentials: 'include' }),
      fetch('/api/companies', { credentials: 'include' }),
    ]);

    if (!contactsRes.ok || !companiesRes.ok) {
      console.warn('[Hydration] Server fetch failed, skipping hydration');
      return;
    }

    const serverContactsRaw: ServerContactRaw[] = await contactsRes.json();
    const serverContacts: ServerContact[] = serverContactsRaw.map(c => normalizeServerContact(c) as unknown as ServerContact);
    const serverCompaniesRaw: ServerCompany[] = await companiesRes.json();
    const normalizedCompanies = serverCompaniesRaw.map(c => normalizeServerCompany(c));

    // Load the deleted blocklist once for use throughout hydration
    const deletedList: Array<{ normName: string; domain?: string | null }> = (() => {
      try { return JSON.parse(localStorage.getItem('carda_deleted_companies') || '[]'); } catch { return []; }
    })();

    // Helper: check if a company (by name + domain) is in the deleted blocklist.
    // FIX (Bug 2, Task 3): Use normalizeCompany (strips diacritics) instead of
    // plain .toLowerCase() so "Wärtsilä" → "wartsila" matches the stored blocklist entry.
    function isDeletedCompany(name: string, domain: string | null): boolean {
      if (deletedList.length === 0) return false;
      // FIX: normalizeCompany strips diacritics/punctuation, matching the format
      // used when the entry was written to the blocklist via addToDeletedCompaniesBlocklist
      const normName = normalizeCompany(name);
      const normDomain = (domain || '').toLowerCase();
      return deletedList.some(
        (e) =>
          (e.normName && normName && e.normName === normName) ||
          (e.domain && normDomain && e.domain === normDomain)
      );
    }

    // --- COMPANIES ---
    const localCompanies = getCompanies();
    const localCompanyMap = new Map(localCompanies.map(c => [c.id, c]));

    for (const server of normalizedCompanies) {
      const uuid = server.id;
      const local = localCompanyMap.get(uuid);
      if (local) {
        if (!local._needsUpsert) {
          const merged = mergeServerCompany(local, server as unknown as ServerCompany);
          localCompanyMap.set(uuid, merged);
        }
      } else {
        const serverName = (server as any).name || '';
        const serverDomain = (server as any).domain || null;

        if (!isDeletedCompany(serverName, serverDomain)) {
          localCompanyMap.set(uuid, {
            id: uuid,
            dbId: server.dbId,
            name: serverName,
            domain: serverDomain,
            city: (server as any).city || null,
            state: (server as any).state || null,
            country: (server as any).country || null,
            notes: (server as any).notes || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // FIX (Bug 2, Task 4): After merging, scrub any blocklisted company that
    // may have slipped in via the existing-local-company path (async race condition
    // where server delete was still in flight at the time of the last refresh).
    const mergedCompanies = Array.from(localCompanyMap.values()).filter(
      (c) => !isDeletedCompany(c.name, c.domain || null)
    );
    saveCompanies(mergedCompanies);

    // --- CONTACTS ---
    const localContacts = loadContacts();
    const localContactMap = new Map(localContacts.map(c => [c.id, c]));
    const serverContactMap = new Map(serverContacts.map(c => [c.id, c]));

    for (const [uuid, server] of serverContactMap) {
      const local = localContactMap.get(uuid);
      if (local) {
        if (!local._needsUpsert) {
          const merged = mergeServerContact(local, server);
          localContactMap.set(uuid, merged);
        }
      } else {
        localContactMap.set(uuid, {
          id: uuid,
          dbId: server.dbId,
          name: server.fullName || '',
          email: server.email || '',
          phone: server.phone || '',
          title: server.jobTitle || '',
          company: server.company || '',
          website: server.website || '',
          linkedinUrl: server.linkedinUrl || '',
          address: server.address || '',
          createdAt: new Date().toISOString(),
          eventName: null,
        });
      }
    }

    const mergedContacts = Array.from(localContactMap.values());
    saveContacts(mergedContacts);

    // --- PUSH DIRTY ITEMS BACK ---
    const dirtyContacts = mergedContacts.filter(c => c._needsUpsert);
    const dirtyCompanies = mergedCompanies.filter(c => c._needsUpsert);

    if (dirtyContacts.length > 0) {
      console.log(`[Hydration] Pushing ${dirtyContacts.length} dirty contacts to server`);
      for (const c of dirtyContacts) {
        upsertContactToServer(c).then(ok => {
          if (ok) {
            const all = loadContacts();
            const idx = all.findIndex(x => x.id === c.id);
            if (idx !== -1) {
              all[idx]._needsUpsert = false;
              saveContacts(all);
            }
          }
        });
      }
    }

    if (dirtyCompanies.length > 0) {
      console.log(`[Hydration] Pushing ${dirtyCompanies.length} dirty companies to server`);
      for (const c of dirtyCompanies) {
        upsertCompanyToServer(c).then(ok => {
          if (ok) {
            const all = getCompanies();
            const idx = all.findIndex(x => x.id === c.id);
            if (idx !== -1) {
              all[idx]._needsUpsert = false;
              saveCompanies(all);
            }
          }
        });
      }
    }

    console.log(`[Hydration] Complete: ${mergedContacts.length} contacts, ${mergedCompanies.length} companies`);
  } catch (e) {
    console.error('[Hydration] Error during hydration:', e);
  }
}