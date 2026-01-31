import { saveContact, type StoredContact } from "@/lib/contactsStorage";
import { loadContactsV2, upsertContact as upsertContactV2, type ContactV2 } from "@/lib/contacts/storage";
import { generateId as generateTimelineId } from "@/lib/contacts/ids";

type ParsedContact = {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  address?: string;
};

export type SaveSource = "scan" | "paste" | "event";

export interface SaveUnifiedOptions {
  eventName: string | null;
  source: SaveSource;
  eventMeta?: Record<string, unknown>;
}

export function saveUnifiedContactFromParsed(
  parsedContact: ParsedContact,
  options: SaveUnifiedOptions
): { v1: StoredContact | null; v2: ContactV2 | null } {
  const contactData = {
    name: parsedContact.fullName || "",
    company: parsedContact.companyName || "",
    title: parsedContact.jobTitle || "",
    email: parsedContact.email || "",
    phone: parsedContact.phone || "",
    website: parsedContact.website || "",
    linkedinUrl: parsedContact.linkedinUrl || "",
    address: parsedContact.address || "",
  };

  const v1 = saveContact(contactData, options.eventName);
  if (!v1) return { v1: null, v2: null };

  const existingV2Contacts = loadContactsV2();
  const existingV2 = existingV2Contacts.find((c) => c.id === v1.id);

  const now = new Date().toISOString();
  const sourceLabel = options.source === "paste" ? "paste" : options.source === "event" ? "event" : "scan";

  const timeline = existingV2?.timeline ? [...existingV2.timeline] : [];
  if (existingV2) {
    timeline.push({
      id: generateTimelineId(),
      type: "contact_updated",
      at: now,
      summary: `Contact updated via ${sourceLabel}`,
      meta: options.eventMeta,
    });
  } else {
    timeline.push({
      id: generateTimelineId(),
      type: options.source === "event" ? "event_attended" : "scan_created",
      at: v1.createdAt || now,
      summary:
        options.source === "event"
          ? `Captured at ${options.eventName || "event"}`
          : options.source === "paste"
            ? "Contact created via paste"
            : "Contact created via scan",
      meta: options.eventMeta,
    });
  }

  const v2: ContactV2 = existingV2
    ? {
        ...existingV2,
        name: v1.name,
        company: v1.company,
        title: v1.title,
        email: v1.email,
        phone: v1.phone,
        website: v1.website,
        linkedinUrl: v1.linkedinUrl,
        address: v1.address,
        eventName: v1.eventName,
        companyId: v1.companyId,
        timeline,
        lastTouchedAt: now,
      }
    : {
        ...v1,
        tasks: [],
        reminders: [],
        timeline,
        lastTouchedAt: v1.createdAt || now,
        notes: "",
      };

  upsertContactV2(v2);
  return { v1, v2 };
}
