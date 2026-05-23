import { StoredContact, saveContact, loadContacts, updateContact } from "@/lib/contactsStorage";
import { loadContactsV2, ContactV2, upsertContact as upsertContactV2 } from "@/lib/contacts/storage";
import { findFuzzyCompanyMatch } from "@/lib/contacts/dedupe";
import { generateId as generateTimelineId } from "@/lib/contacts/ids";
import {
  autoGenerateCompaniesFromContacts,
  resolveCompanyIdForContact,
} from "@/lib/companiesStorage";

export interface ParsedContactInput {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  linkedinSearchUrl?: string;
  address?: string;
}

/**
 * Saves a parsed contact to v1 + v2 storage, runs fuzzy company matching
 * and company resolution. Pure data function — no UI state updates.
 * Returns the saved StoredContact or null on failure.
 */
export function saveContactFromParsed(
  parsedContact: ParsedContactInput,
  source: "scan" | "paste" = "paste"
): StoredContact | null {
  try {
    let contactData = {
      name: parsedContact.fullName || "",
      company: parsedContact.companyName || "",
      title: parsedContact.jobTitle || "",
      email: parsedContact.email || "",
      phone: parsedContact.phone || "",
      website: parsedContact.website || "",
      linkedinUrl: parsedContact.linkedinUrl || "",
      address: parsedContact.address || "",
    };

    if (contactData.company) {
      const existingContacts = loadContactsV2();
      const canonicalCompany = findFuzzyCompanyMatch(contactData.company, existingContacts);
      if (canonicalCompany && canonicalCompany !== contactData.company) {
        contactData = { ...contactData, company: canonicalCompany };
      }
    }

    const savedContact = saveContact(contactData, null);
    if (!savedContact) return null;

    const existingV2Contacts = loadContactsV2();
    const existingV2 = existingV2Contacts.find((c) => c.id === savedContact.id);

    let v2Contact: ContactV2;

    if (existingV2) {
      v2Contact = {
        ...existingV2,
        name: savedContact.name,
        company: savedContact.company,
        title: savedContact.title,
        email: savedContact.email,
        phone: savedContact.phone,
        website: savedContact.website,
        linkedinUrl: savedContact.linkedinUrl,
        address: savedContact.address,
        eventName: savedContact.eventName,
        companyId: savedContact.companyId,
        timeline: [
          ...existingV2.timeline,
          {
            id: generateTimelineId(),
            type: "contact_updated" as const,
            at: new Date().toISOString(),
            summary: `Contact updated via ${source}`,
          },
        ],
        lastTouchedAt: new Date().toISOString(),
      };
    } else {
      v2Contact = {
        ...savedContact,
        tasks: [],
        reminders: [],
        timeline: [
          {
            id: generateTimelineId(),
            type: source === "scan" ? ("scan_created" as const) : ("contact_updated" as const),
            at: savedContact.createdAt || new Date().toISOString(),
            summary: `Contact created via ${source}`,
          },
        ],
        lastTouchedAt: savedContact.createdAt,
        notes: "",
      };
    }

    upsertContactV2(v2Contact);

    autoGenerateCompaniesFromContacts(loadContacts());
    const resolvedCompanyId = resolveCompanyIdForContact({
      companyId: savedContact.companyId,
      company: savedContact.company,
      email: savedContact.email,
      website: savedContact.website,
    });
    if (resolvedCompanyId && resolvedCompanyId !== savedContact.companyId) {
      updateContact(savedContact.id, { companyId: resolvedCompanyId });
      const linkedV2 = { ...v2Contact, companyId: resolvedCompanyId };
      upsertContactV2(linkedV2);
      savedContact.companyId = resolvedCompanyId;
    }

    return savedContact;
  } catch (e) {
    console.error("[captureUtils] Failed to save contact:", e);
    return null;
  }
}
