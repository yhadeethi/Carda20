import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { StoredContact } from "@/lib/contactsStorage";
import type { TimelineEvent } from "@/lib/contacts/types";

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
}

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
    address: "",
    eventName: null,
    companyId: contact.companyId ? String(contact.companyId) : null,
    org: {
      department: 'UNKNOWN',
      reportsToId: null,
      role: 'UNKNOWN',
      influence: 'UNKNOWN',
      relationshipStrength: 'UNKNOWN',
    },
  };
}

function storedContactToDbContact(contact: Partial<StoredContact>) {
  return {
    fullName: contact.name || null,
    companyName: contact.company || null,
    jobTitle: contact.title || null,
    email: contact.email || null,
    phone: contact.phone || null,
    website: contact.website || null,
    linkedinUrl: contact.linkedinUrl || null,
  };
}

export function useContacts() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: rawData = [], isLoading } = useQuery<DbContact[]>({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  const contacts: StoredContact[] = rawData.map(dbContactToStoredContact);

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

  
  const appendTimelineMutation = useMutation({
    mutationFn: async (params: { contactId: string; event: TimelineEvent }) => {
      if (!isAuthenticated) return null;
      const contactId = parseInt(params.contactId);
      if (isNaN(contactId)) throw new Error("Invalid contact ID");
      return apiRequest("PATCH", `/api/contacts/${contactId}`, { appendTimelineEvent: params.event });
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

  return {
    contacts,
    isLoading,
    createContact: createMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    appendTimelineEvent: appendTimelineMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
