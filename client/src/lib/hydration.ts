import { loadContacts, saveContacts, type StoredContact } from './contactsStorage';
import { getCompanies, saveCompanies, type Company } from './companiesStorage';
import { upsertContactToServer, upsertCompanyToServer } from './api/sync';

interface ServerContact {
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

    const serverContacts: ServerContact[] = await contactsRes.json();
    const serverCompanies: ServerCompany[] = await companiesRes.json();

    // --- COMPANIES ---
    const localCompanies = getCompanies();
    const localCompanyMap = new Map(localCompanies.map(c => [c.id, c]));
    const serverCompanyMap = new Map(serverCompanies.filter(c => c.publicId).map(c => [c.publicId, c]));

    for (const [pubId, server] of serverCompanyMap) {
      const local = localCompanyMap.get(pubId);
      if (local) {
        if (!local._needsUpsert) {
          const merged = mergeServerCompany(local, server);
          localCompanyMap.set(pubId, merged);
        }
      } else {
        localCompanyMap.set(pubId, {
          id: pubId,
          name: server.name,
          domain: server.domain,
          city: server.city,
          state: server.state,
          country: server.country,
          notes: server.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const mergedCompanies = Array.from(localCompanyMap.values());
    saveCompanies(mergedCompanies);

    // --- CONTACTS ---
    const localContacts = loadContacts();
    const localContactMap = new Map(localContacts.map(c => [c.id, c]));
    const serverContactMap = new Map(serverContacts.filter(c => c.publicId).map(c => [c.publicId, c]));

    for (const [pubId, server] of serverContactMap) {
      const local = localContactMap.get(pubId);
      if (local) {
        if (!local._needsUpsert) {
          const merged = mergeServerContact(local, server);
          localContactMap.set(pubId, merged);
        }
      } else {
        localContactMap.set(pubId, {
          id: pubId,
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
