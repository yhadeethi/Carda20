const STORAGE_KEY = "carda_contacts_v2";
const STORAGE_KEY_V1 = "carda_contacts_v1";

// Org Intelligence v2: Department classification
export type Department = 'EXEC' | 'LEGAL' | 'PROJECT_DELIVERY' | 'SALES' | 'FINANCE' | 'OPS' | 'UNKNOWN';

// Org Intelligence: Role classification for deal management
export type OrgRole = 'CHAMPION' | 'NEUTRAL' | 'BLOCKER' | 'UNKNOWN';

// Org Intelligence: Influence level for prioritization
export type InfluenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

// Org Intelligence: Relationship strength
export type RelationshipStrength = 'CLOSE' | 'NORMAL' | 'CASUAL' | 'UNKNOWN';

// Nested org structure for v2
export interface ContactOrg {
  department: Department;
  reportsToId: string | null;
  role: OrgRole;
  influence: InfluenceLevel;
  relationshipStrength: RelationshipStrength;
}

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
  companyId?: string | null;
  orgRole?: OrgRole;
  influenceLevel?: InfluenceLevel;
  managerContactId?: string | null;
  org?: ContactOrg;
  legacyId?: string;
  _needsUpsert?: boolean;
}

// Default org values for new/migrated contacts
export const DEFAULT_ORG: ContactOrg = {
  department: 'UNKNOWN',
  reportsToId: null,
  role: 'UNKNOWN',
  influence: 'UNKNOWN',
  relationshipStrength: 'UNKNOWN',
};

// Migrate legacy org fields to new org structure
function migrateContact(contact: StoredContact): StoredContact {
  if (contact.org) return contact; // Already migrated
  
  // Migrate from legacy fields
  const legacyRole = contact.orgRole;
  const legacyInfluence = contact.influenceLevel;
  const legacyManager = contact.managerContactId;
  
  // Map legacy values to new format
  const roleMap: Record<string, OrgRole> = {
    'Champion': 'CHAMPION',
    'Neutral': 'NEUTRAL',
    'Blocker': 'BLOCKER',
    'Unknown': 'UNKNOWN',
  };
  
  const influenceMap: Record<string, InfluenceLevel> = {
    'High': 'HIGH',
    'Medium': 'MEDIUM',
    'Low': 'LOW',
    'Unknown': 'UNKNOWN',
  };
  
  return {
    ...contact,
    org: {
      department: 'UNKNOWN',
      reportsToId: legacyManager || null,
      role: (legacyRole && roleMap[legacyRole]) || 'UNKNOWN',
      influence: (legacyInfluence && influenceMap[legacyInfluence]) || 'UNKNOWN',
      relationshipStrength: 'UNKNOWN',
    },
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

export function loadContacts(): StoredContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map(migrateContact);
        if (migrated.some((c: StoredContact, i: number) => c.org && !parsed[i].org)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
        return migrated;
      }
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (Array.isArray(parsedV1) && parsedV1.length > 0) {
        const migrated = parsedV1.map(migrateContact);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }

    return [];
  } catch (e) {
    console.error("[ContactsStorage] Failed to load contacts:", e);
    return [];
  }
}

// Ensure contact has org structure (for use after load)
export function ensureOrg(contact: StoredContact): StoredContact & { org: ContactOrg } {
  return {
    ...contact,
    org: contact.org || { ...DEFAULT_ORG },
  } as StoredContact & { org: ContactOrg };
}

// Auto-group contacts by department based on job title keywords
export function autoGroupByDepartment(contacts: StoredContact[]): { 
  updated: StoredContact[]; 
  changedCount: number;
  previousStates: Map<string, Department>;
} {
  const previousStates = new Map<string, Department>();
  let changedCount = 0;
  
  const updated = contacts.map((contact) => {
    const currentOrg = contact.org || { ...DEFAULT_ORG };
    
    // Only update if department is currently UNKNOWN (don't overwrite user edits)
    if (currentOrg.department !== 'UNKNOWN') {
      return contact;
    }
    
    const title = contact.title?.toLowerCase() || '';
    let newDepartment: Department = 'UNKNOWN';
    
    // Order matters - EXEC should be checked after specific departments
    // so "Head of Legal" matches LEGAL, not just EXEC
    
    // LEGAL
    if (/\b(legal|counsel|law|solicitor|barrister|company secretary|secretary)\b/i.test(title)) {
      newDepartment = 'LEGAL';
    }
    // PROJECT_DELIVERY
    else if (/\b(project|delivery|epc|construction|pm|project manager|site)\b/i.test(title)) {
      newDepartment = 'PROJECT_DELIVERY';
    }
    // SALES
    else if (/\b(sales|commercial|bd|business development|account|partnerships)\b/i.test(title)) {
      newDepartment = 'SALES';
    }
    // FINANCE
    else if (/\b(finance|cfo|accountant|controller|payable|treasury)\b/i.test(title)) {
      newDepartment = 'FINANCE';
    }
    // OPS (only if not clearly delivery)
    else if (/\b(operations|o&m|asset|engineering|maintenance)\b/i.test(title) && !/\b(delivery|project)\b/i.test(title)) {
      newDepartment = 'OPS';
    }
    // EXEC - check last so specific departments take precedence
    else if (/\b(ceo|coo|cto|director|general manager|gm|head of|vp|chief)\b/i.test(title)) {
      newDepartment = 'EXEC';
    }
    
    if (newDepartment !== 'UNKNOWN') {
      previousStates.set(contact.id, currentOrg.department);
      changedCount++;
      return {
        ...contact,
        org: { ...currentOrg, department: newDepartment },
      };
    }
    
    return contact;
  });
  
  return { updated, changedCount, previousStates };
}

// Batch update contacts (for auto-group)
export function batchUpdateContacts(contacts: StoredContact[]): void {
  const allContacts = loadContacts();
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  
  const merged = allContacts.map(c => contactMap.get(c.id) || c);
  saveContacts(merged);
}

// Revert auto-group changes
export function revertAutoGroup(previousStates: Map<string, Department>): void {
  const contacts = loadContacts();
  const updated = contacts.map(c => {
    const prevDept = previousStates.get(c.id);
    if (prevDept !== undefined && c.org) {
      return { ...c, org: { ...c.org, department: prevDept } };
    }
    return c;
  });
  saveContacts(updated);
}

// Clear all reporting lines for a company's contacts
export function clearAllReportingLines(companyContacts: StoredContact[]): Map<string, string | null> {
  const previousManagers = new Map<string, string | null>();
  
  companyContacts.forEach(c => {
    if (c.org?.reportsToId) {
      previousManagers.set(c.id, c.org.reportsToId);
      updateContact(c.id, { org: { ...c.org, reportsToId: null } });
    }
  });
  
  return previousManagers;
}

// Restore reporting lines after undo
export function restoreReportingLines(previousManagers: Map<string, string | null>): void {
  const contacts = loadContacts();
  const updated = contacts.map(c => {
    const prevManager = previousManagers.get(c.id);
    if (prevManager !== undefined && c.org) {
      return { ...c, org: { ...c.org, reportsToId: prevManager } };
    }
    return c;
  });
  saveContacts(updated);
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
      _needsUpsert: true,
    };
    const newContacts = contacts.map((c) => (c.id === existing.id ? updated : c));
    saveContacts(newContacts);
    fireContactUpsert(updated);
    return updated;
  } else {
    const newContact: StoredContact = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...contact,
      eventName,
      _needsUpsert: true,
    };
    saveContacts([newContact, ...contacts]);
    fireContactUpsert(newContact);
    return newContact;
  }
}

function fireContactUpsert(contact: StoredContact): void {
  import('./api/sync').then(({ upsertContactToServer }) => {
    upsertContactToServer(contact).then((ok) => {
      if (ok) {
        const contacts = loadContacts();
        const idx = contacts.findIndex((c) => c.id === contact.id);
        if (idx !== -1) {
          contacts[idx]._needsUpsert = false;
          saveContacts(contacts);
        }
      }
    });
  });
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
  
  const updated = { ...contacts[index], ...updates, _needsUpsert: true };
  contacts[index] = updated;
  saveContacts(contacts);
  fireContactUpsert(updated);
  
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
