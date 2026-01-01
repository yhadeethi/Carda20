import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { StoredContact, ContactOrg, TimelineEvent } from "@/lib/contactsStorage";
import { 
  loadContacts as loadLocalContacts, 
  saveContact as saveLocalContact,
  updateContact as updateLocalContact,
  deleteContact as deleteLocalContact 
} from "@/lib/contactsStorage";

function generateTimelineId(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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
    timeline: (contact.timeline as TimelineEvent[]) || [],
    notes: contact.notes || undefined,
    lastTouchedAt: contact.lastTouchedAt || undefined,
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
  if (contact.timeline !== undefined) result.timeline = contact.timeline || [];
  if (contact.notes !== undefined) result.notes = contact.notes || null;
  if (contact.lastTouchedAt !== undefined) result.lastTouchedAt = contact.lastTouchedAt || null;
  
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
    console.log("[useContacts] saveOrUpdateContact called, isAuthenticated:", isAuthenticated);
    
    if (!isAuthenticated) {
      console.log("[useContacts] Not authenticated, using local storage");
      return saveLocalContact(contactData, eventName);
    }

    try {
      console.log("[useContacts] Authenticated, saving to server. Contact data:", contactData);
      const existing = findExistingContact(contactData.email, contactData.name, contactData.company);
      const now = new Date().toISOString();
      
      if (existing) {
        console.log("[useContacts] Updating existing contact:", existing.id);
        // Add an update timeline event - only send the new event, backend will merge
        const updateEvent: TimelineEvent = {
          id: generateTimelineId(),
          type: "contact_updated",
          at: now,
          summary: "Contact updated via scan",
        };
        
        const updated = await updateMutation.mutateAsync({
          id: existing.id,
          updates: { 
            ...contactData, 
            eventName: eventName ?? existing.eventName,
            timeline: [updateEvent],
            lastTouchedAt: now,
          },
        });
        console.log("[useContacts] Contact updated successfully:", updated);
        return dbContactToStoredContact(updated);
      } else {
        console.log("[useContacts] Creating new contact");
        // Create with a scan_created timeline event
        const scanCreatedEvent: TimelineEvent = {
          id: generateTimelineId(),
          type: "scan_created",
          at: now,
          summary: "Contact created via scan",
        };
        
        const created = await createMutation.mutateAsync({
          ...contactData,
          eventName,
          timeline: [scanCreatedEvent],
          lastTouchedAt: now,
        });
        console.log("[useContacts] Contact created successfully:", created);
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
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["/api/contacts"] }),
  };
}
