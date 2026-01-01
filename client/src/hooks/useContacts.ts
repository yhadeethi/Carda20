import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { StoredContact, ContactOrg } from "@/lib/contactsStorage";
import { 
  loadContacts as loadLocalContacts, 
  saveContact as saveLocalContact,
  updateContact as updateLocalContact,
  deleteContact as deleteLocalContact 
} from "@/lib/contactsStorage";

// Database contact type matching the server schema
export interface DbContact {
  id: number;
  userId: number;
  fullName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedinUrl: string | null;
  rawText: string | null;
  companyDomain: string | null;
  companyId: number | null;
  createdAt: string | null;
  address: string | null;
  eventName: string | null;
  org: ContactOrg | null;
  tasks: unknown[] | null;
  reminders: unknown[] | null;
  timeline: unknown[] | null;
  notes: string | null;
  mergeMeta: unknown | null;
  lastTouchedAt: string | null;
}

const defaultOrg: StoredContact['org'] = {
  department: 'UNKNOWN',
  reportsToId: null,
  role: 'UNKNOWN',
  influence: 'UNKNOWN',
  relationshipStrength: 'UNKNOWN',
};

function dbContactToStoredContact(contact: DbContact): StoredContact {
  return {
    id: String(contact.id),
    createdAt: contact.createdAt || new Date().toISOString(),
    name: contact.fullName || "",
    company: contact.companyName || "",
    title: contact.jobTitle || "",
    email: contact.email || "",
    phone: contact.phone || "",
    website: contact.website || "",
    linkedinUrl: contact.linkedinUrl || "",
    address: contact.address || "",
    eventName: contact.eventName || null,
    companyId: contact.companyId ? String(contact.companyId) : null,
    org: contact.org || defaultOrg,
  };
}

function storedContactToDbContact(contact: Partial<StoredContact>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  if (contact.name !== undefined) result.fullName = contact.name || null;
  if (contact.company !== undefined) result.companyName = contact.company || null;
  if (contact.title !== undefined) result.jobTitle = contact.title || null;
  if (contact.email !== undefined) result.email = contact.email || null;
  if (contact.phone !== undefined) result.phone = contact.phone || null;
  if (contact.website !== undefined) result.website = contact.website || null;
  if (contact.linkedinUrl !== undefined) result.linkedinUrl = contact.linkedinUrl || null;
  if (contact.address !== undefined) result.address = contact.address || null;
  if (contact.eventName !== undefined) result.eventName = contact.eventName || null;
  if (contact.org !== undefined) result.org = contact.org || null;
  
  return result;
}

export function useContacts() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: rawData = [], isLoading } = useQuery<DbContact[]>({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  const contacts: StoredContact[] = isAuthenticated 
    ? rawData.map(dbContactToStoredContact)
    : loadLocalContacts();

  const createMutation = useMutation({
    mutationFn: async (contact: Partial<StoredContact>) => {
      const dbContact = storedContactToDbContact(contact);
      const res = await apiRequest("POST", "/api/contacts", dbContact);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StoredContact> }) => {
      const dbContact = storedContactToDbContact(updates);
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, dbContact);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/contacts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const findExistingContact = (email: string, name: string, company: string): StoredContact | null => {
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
  };

  const saveOrUpdateContact = async (
    contactData: Omit<StoredContact, "id" | "createdAt" | "eventName">,
    eventName: string | null
  ): Promise<StoredContact | null> => {
    if (!isAuthenticated) {
      return saveLocalContact(contactData, eventName);
    }

    try {
      const existing = findExistingContact(contactData.email, contactData.name, contactData.company);
      
      if (existing) {
        const updated = await updateMutation.mutateAsync({
          id: existing.id,
          updates: { ...contactData, eventName: eventName ?? existing.eventName },
        });
        return dbContactToStoredContact(updated);
      } else {
        const created = await createMutation.mutateAsync({
          ...contactData,
          eventName,
        });
        return dbContactToStoredContact(created);
      }
    } catch (e) {
      console.error("[useContacts] Failed to save contact:", e);
      return null;
    }
  };

  const updateContactById = async (id: string, updates: Partial<StoredContact>): Promise<StoredContact | null> => {
    if (!isAuthenticated) {
      return updateLocalContact(id, updates);
    }

    try {
      const updated = await updateMutation.mutateAsync({ id, updates });
      return dbContactToStoredContact(updated);
    } catch (e) {
      console.error("[useContacts] Failed to update contact:", e);
      return null;
    }
  };

  const deleteContactById = async (id: string): Promise<boolean> => {
    if (!isAuthenticated) {
      deleteLocalContact(id);
      return true;
    }

    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (e) {
      console.error("[useContacts] Failed to delete contact:", e);
      return false;
    }
  };

  const getUniqueEventNames = (): string[] => {
    const events = new Set<string>();
    contacts.forEach((c) => {
      if (c.eventName) events.add(c.eventName);
    });
    return Array.from(events).sort();
  };

  interface LocalContactWithV2Fields extends StoredContact {
    tasks?: unknown[];
    reminders?: unknown[];
    timeline?: unknown[];
    notes?: string;
    mergeMeta?: unknown;
    lastTouchedAt?: string;
    rawText?: string;
  }

  const getAllLocalContacts = (): LocalContactWithV2Fields[] => {
    const v1Contacts: LocalContactWithV2Fields[] = loadLocalContacts();
    
    let v2Contacts: LocalContactWithV2Fields[] = [];
    try {
      const rawV2 = localStorage.getItem("carda_contacts_v2");
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (Array.isArray(parsed)) {
          v2Contacts = parsed.map((c: Record<string, unknown>) => ({
            id: String(c.id || ""),
            createdAt: String(c.createdAt || new Date().toISOString()),
            name: String(c.name || ""),
            company: String(c.company || ""),
            title: String(c.title || ""),
            email: String(c.email || ""),
            phone: String(c.phone || ""),
            website: String(c.website || ""),
            linkedinUrl: String(c.linkedinUrl || ""),
            address: String(c.address || ""),
            eventName: c.eventName ? String(c.eventName) : null,
            companyId: c.companyId ? String(c.companyId) : null,
            org: (c.org as StoredContact['org']) || defaultOrg,
            tasks: Array.isArray(c.tasks) ? c.tasks : undefined,
            reminders: Array.isArray(c.reminders) ? c.reminders : undefined,
            timeline: Array.isArray(c.timeline) ? c.timeline : undefined,
            notes: typeof c.notes === 'string' ? c.notes : undefined,
            mergeMeta: c.mergeMeta || undefined,
            lastTouchedAt: typeof c.lastTouchedAt === 'string' ? c.lastTouchedAt : undefined,
            rawText: typeof c.rawText === 'string' ? c.rawText : undefined,
          }));
        }
      }
    } catch (e) {
      console.error("[useContacts] Failed to load v2 contacts:", e);
    }
    
    const v1Ids = new Set(v1Contacts.map(c => c.id));
    const uniqueV2 = v2Contacts.filter(c => !v1Ids.has(c.id));
    
    return [...v1Contacts, ...uniqueV2];
  };

  const getLocalContacts = (): StoredContact[] => {
    return getAllLocalContacts();
  };

  const migrateLocalContactsToCloud = async (): Promise<{ 
    imported: number; 
    failed: number; 
    successIds: string[];
    failedContacts: LocalContactWithV2Fields[];
  }> => {
    const localContacts = getAllLocalContacts();
    
    if (!isAuthenticated) {
      return { imported: 0, failed: 0, successIds: [], failedContacts: localContacts };
    }

    let imported = 0;
    let failed = 0;
    const successIds: string[] = [];
    const failedContacts: LocalContactWithV2Fields[] = [];

    for (const localContact of localContacts) {
      try {
        const dbContact: Record<string, unknown> = {
          fullName: localContact.name || null,
          companyName: localContact.company || null,
          jobTitle: localContact.title || null,
          email: localContact.email || null,
          phone: localContact.phone || null,
          website: localContact.website || null,
          linkedinUrl: localContact.linkedinUrl || null,
          address: localContact.address || null,
          eventName: localContact.eventName || null,
          org: localContact.org || null,
        };
        
        if (localContact.tasks) dbContact.tasks = localContact.tasks;
        if (localContact.reminders) dbContact.reminders = localContact.reminders;
        if (localContact.timeline) dbContact.timeline = localContact.timeline;
        if (localContact.notes) dbContact.notes = localContact.notes;
        if (localContact.mergeMeta) dbContact.mergeMeta = localContact.mergeMeta;
        if (localContact.lastTouchedAt) dbContact.lastTouchedAt = localContact.lastTouchedAt;
        if (localContact.rawText) dbContact.rawText = localContact.rawText;
        
        await apiRequest("POST", "/api/contacts", dbContact);
        imported++;
        successIds.push(localContact.id);
      } catch (e) {
        console.error("[useContacts] Failed to migrate contact:", localContact.name, e);
        failed++;
        failedContacts.push(localContact);
      }
    }

    if (imported > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    }

    return { imported, failed, successIds, failedContacts };
  };

  const removeLocalContactsByIds = (ids: string[]): void => {
    try {
      const keyV1 = "carda_contacts_v1";
      const storedV1 = localStorage.getItem(keyV1);
      if (storedV1) {
        const contactsV1 = JSON.parse(storedV1) as StoredContact[];
        const filteredV1 = contactsV1.filter(c => !ids.includes(c.id));
        localStorage.setItem(keyV1, JSON.stringify(filteredV1));
      }
      
      const keyV2 = "carda_contacts_v2";
      const storedV2 = localStorage.getItem(keyV2);
      if (storedV2) {
        const contactsV2 = JSON.parse(storedV2);
        if (Array.isArray(contactsV2)) {
          const filteredV2 = contactsV2.filter((c: { id: string }) => !ids.includes(c.id));
          localStorage.setItem(keyV2, JSON.stringify(filteredV2));
        }
      }
    } catch (e) {
      console.error("[useContacts] Failed to remove local contacts:", e);
    }
  };

  const clearLocalContacts = (): void => {
    try {
      localStorage.removeItem("carda_contacts_v1");
      localStorage.removeItem("carda_contacts_v2");
    } catch (e) {
      console.error("[useContacts] Failed to clear local contacts:", e);
    }
  };

  return {
    contacts,
    isLoading: isAuthenticated ? isLoading : false,
    isAuthenticated,
    createContact: createMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    saveOrUpdateContact,
    updateContactById,
    deleteContactById,
    findExistingContact,
    getUniqueEventNames,
    getLocalContacts,
    migrateLocalContactsToCloud,
    removeLocalContactsByIds,
    clearLocalContacts,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["/api/contacts"] }),
  };
}
