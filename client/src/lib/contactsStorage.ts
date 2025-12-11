const STORAGE_KEY = "carda_contacts_v1";

// Org Intelligence: Role classification for deal management
export type OrgRole = 'Champion' | 'Neutral' | 'Blocker' | 'Unknown';

// Org Intelligence: Influence level for prioritization
export type InfluenceLevel = 'Low' | 'Medium' | 'High' | 'Unknown';

export interface StoredContact {
  id: string;
  createdAt: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  website: string;
  linkedinUrl: string;
  address: string;
  eventName: string | null;
  // Org Intelligence fields (optional)
  companyId?: string | null;
  orgRole?: OrgRole;
  influenceLevel?: InfluenceLevel;
  managerContactId?: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function loadContacts(): StoredContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("[ContactsStorage] Failed to load contacts:", e);
    return [];
  }
}

export function saveContacts(contacts: StoredContact[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch (e) {
    console.error("[ContactsStorage] Failed to save contacts:", e);
  }
}

function findExistingContact(contacts: StoredContact[], email: string, name: string, company: string): StoredContact | null {
  if (email) {
    const byEmail = contacts.find((c) => c.email && c.email.toLowerCase() === email.toLowerCase());
    if (byEmail) return byEmail;
  }
  if (name && company) {
    const byNameCompany = contacts.find(
      (c) =>
        c.name &&
        c.company &&
        c.name.toLowerCase() === name.toLowerCase() &&
        c.company.toLowerCase() === company.toLowerCase()
    );
    if (byNameCompany) return byNameCompany;
  }
  return null;
}

export function saveContact(contact: Omit<StoredContact, "id" | "createdAt" | "eventName">, eventName: string | null): StoredContact {
  const contacts = loadContacts();
  const existing = findExistingContact(contacts, contact.email, contact.name, contact.company);
  
  if (existing) {
    const updated: StoredContact = {
      ...existing,
      ...contact,
      eventName: eventName ?? existing.eventName,
    };
    const newContacts = contacts.map((c) => (c.id === existing.id ? updated : c));
    saveContacts(newContacts);
    return updated;
  } else {
    const newContact: StoredContact = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...contact,
      eventName,
    };
    saveContacts([newContact, ...contacts]);
    return newContact;
  }
}

export function deleteContact(id: string): void {
  const contacts = loadContacts();
  const filtered = contacts.filter((c) => c.id !== id);
  saveContacts(filtered);
}

export function getUniqueEventNames(): string[] {
  const contacts = loadContacts();
  const events = new Set<string>();
  contacts.forEach((c) => {
    if (c.eventName) events.add(c.eventName);
  });
  return Array.from(events).sort();
}

/**
 * Update a contact's fields (for Org Intelligence updates like companyId, orgRole, etc.)
 */
export function updateContact(id: string, updates: Partial<StoredContact>): StoredContact | null {
  const contacts = loadContacts();
  const index = contacts.findIndex((c) => c.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...contacts[index], ...updates };
  contacts[index] = updated;
  saveContacts(contacts);
  
  return updated;
}

/**
 * Get contacts by company ID
 */
export function getContactsByCompanyId(companyId: string): StoredContact[] {
  return loadContacts().filter((c) => c.companyId === companyId);
}

/**
 * Get contacts grouped by company name (for companies that haven't been linked yet)
 */
export function getContactsGroupedByCompany(): Map<string, StoredContact[]> {
  const contacts = loadContacts();
  const groups = new Map<string, StoredContact[]>();
  
  contacts.forEach((c) => {
    if (c.company) {
      const normalized = c.company.trim().toLowerCase();
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(c);
    }
  });
  
  return groups;
}
