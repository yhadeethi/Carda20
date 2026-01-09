import { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useContacts } from "./useContacts";
import { ContactV2, loadContactsV2 } from "@/lib/contacts/storage";
import type { StoredContact } from "@/lib/contactsStorage";

export interface UnifiedContact extends StoredContact {
  tasks: ContactV2["tasks"];
  reminders: ContactV2["reminders"];
  timeline: ContactV2["timeline"];
  lastTouchedAt?: string;
  notes?: string;
}

function normalizeContact(contact: Partial<ContactV2>): UnifiedContact {
  return {
    id: contact.id || "",
    createdAt: contact.createdAt || new Date().toISOString(),
    name: contact.name || "",
    company: contact.company || "",
    title: contact.title || "",
    email: contact.email || "",
    phone: contact.phone || "",
    website: contact.website || "",
    linkedinUrl: contact.linkedinUrl || "",
    address: contact.address || "",
    eventName: contact.eventName ?? null,
    companyId: contact.companyId ?? null,
    org: contact.org,
    tasks: contact.tasks || [],
    reminders: contact.reminders || [],
    timeline: contact.timeline || [],
    lastTouchedAt: contact.lastTouchedAt || contact.createdAt,
    notes: contact.notes || "",
  };
}

function storedContactToUnified(contact: StoredContact): UnifiedContact {
  return {
    ...contact,
    tasks: [],
    reminders: [],
    timeline: [],
    lastTouchedAt: contact.createdAt,
    notes: "",
  };
}

function enrichWithLocalData(
  cloudContacts: StoredContact[],
  localContacts: ContactV2[]
): UnifiedContact[] {
  const localById = new Map(localContacts.map((c) => [c.id, c]));

  return cloudContacts.map((cloud) => {
    const local = localById.get(cloud.id);
    if (local) {
      return {
        ...cloud,
        tasks: local.tasks || [],
        reminders: local.reminders || [],
        timeline: local.timeline || [],
        lastTouchedAt: local.lastTouchedAt || cloud.createdAt,
        notes: local.notes || "",
      };
    }
    return storedContactToUnified(cloud);
  });
}

export function useUnifiedContacts() {
  const { isAuthenticated } = useAuth();
  const { contacts: cloudContacts, isLoading } = useContacts();
  const [localVersion, setLocalVersion] = useState(0);

  const refreshLocal = useCallback(() => {
    setLocalVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith("carda_contacts") || e.key === null)) {
        refreshLocal();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshLocal]);

  const localContacts = useMemo(() => {
    try {
      return loadContactsV2();
    } catch {
      return [];
    }
  }, [localVersion]);

  const contacts: UnifiedContact[] = useMemo(() => {
    if (isAuthenticated) {
      if (cloudContacts.length > 0) {
        const enriched = enrichWithLocalData(cloudContacts, localContacts);
        const cloudIds = new Set(cloudContacts.map((c) => c.id));
        const localOnly = localContacts
          .filter((c) => !cloudIds.has(c.id))
          .map(normalizeContact);
        return [...enriched, ...localOnly];
      }
      return localContacts.map(normalizeContact);
    }
    return localContacts.map(normalizeContact);
  }, [isAuthenticated, cloudContacts, localContacts]);

  const getContactById = (id: string): UnifiedContact | undefined => {
    return contacts.find((c) => c.id === id);
  };

  return {
    contacts,
    isLoading: isAuthenticated ? isLoading : false,
    isAuthenticated,
    getContactById,
    refreshLocal,
  };
}
