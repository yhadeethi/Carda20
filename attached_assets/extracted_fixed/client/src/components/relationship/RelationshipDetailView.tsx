import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { StoredContact } from "@/lib/contactsStorage";
import { ContactV2, loadContactsV2 } from "@/lib/contacts/storage";

import { ContactDetailView } from "@/components/contact/ContactDetailView";
import { extractDomainFromEmail } from "@/lib/companiesStorage";
import { findCompanyByDomain, findCompanyByName } from "@/lib/companiesStorage";

type ParsedContactForVCard = {
  fullName?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  address?: string | null;
};

interface RelationshipDetailViewProps {
  contact: StoredContact;
  onBack: () => void;
  onDelete?: (id: string) => void;
  onContactUpdated?: (contactId: string) => void;
  onViewInOrgMap?: (companyId: string) => void;
  /**
   * Optional deep-link action for the detail view (used by Home Scoreboard).
   */
  initialAction?: "followup";
}

/**
 * RelationshipDetailView
 * Person-first relationship record view.
 *
 * This deliberately avoids rendering ScanTab (scanner UI) so the mental model is:
 * Relationships -> Person -> Relationship record.
 */
export function RelationshipDetailView({
  contact,
  onBack,
  onDelete,
  onContactUpdated,
  onViewInOrgMap,
  initialAction,
}: RelationshipDetailViewProps) {
  const { toast } = useToast();
  const [contactV2, setContactV2] = useState<ContactV2 | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load V2 contact (timeline/actions store) for this contact id
  useEffect(() => {
    try {
      const v2 = loadContactsV2().find((c) => c.id === contact.id) || null;
      setContactV2(v2);
    } catch {
      setContactV2(null);
    }
  }, [contact.id, refreshKey]);

  const parsedForVCard: ParsedContactForVCard = useMemo(() => {
    return {
      fullName: contact.name || null,
      jobTitle: contact.title || null,
      companyName: contact.company || null,
      email: contact.email || null,
      phone: contact.phone || null,
      website: contact.website || null,
      linkedinUrl: contact.linkedinUrl || null,
      address: contact.address || null,
    };
  }, [contact]);

  const companyId = useMemo(() => {
    // Prefer explicit mapping
    if (contact.companyId) return contact.companyId;

    // Fallback: try match by company name
    if (contact.company) {
      const byName = findCompanyByName(contact.company);
      if (byName) return byName.id;
    }

    // Fallback: try match by email domain
    if (contact.email) {
      const domain = extractDomainFromEmail(contact.email);
      if (domain) {
        const byDomain = findCompanyByDomain(domain);
        if (byDomain) return byDomain.id;
      }
    }

    return null;
  }, [contact]);

  const handleDownloadVCard = useCallback(async () => {
    try {
      const res = await fetch("/api/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedForVCard),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to generate vCard");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(parsedForVCard.fullName || "contact").replace(/[^a-z0-9]/gi, "_")}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "vCard downloaded" });
    } catch (e: any) {
      toast({
        title: "Couldn't download vCard",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    }
  }, [parsedForVCard, toast]);

  return (
    <ContactDetailView
      contact={contact}
      contactV2={contactV2}
      onBack={onBack}
      onDelete={onDelete}
      onUpdate={() => setRefreshKey((k) => k + 1)}
      onContactUpdated={onContactUpdated}
      onDownloadVCard={handleDownloadVCard}
      onViewInOrgMap={onViewInOrgMap}
      companyId={companyId}
      autoOpenFollowUp={initialAction === "followup"}
    />
  );
}
