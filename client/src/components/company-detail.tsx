/**
 * Company Detail Page for Org Intelligence
 * Shows company info with tabs: Contacts, Org Map, Notes
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Briefcase,
  Globe,
  MapPin,
  Users,
  Network,
  StickyNote,
  User,
  Shield,
  Minus,
  AlertTriangle,
  CircleDot,
  Settings2,
  X,
  Filter,
  FileDown,
  Loader2,
} from "lucide-react";
import { FilterSheet, getFilterSummary } from "@/components/filters/FilterSheet";
import {
  Company,
  getCompanyById,
  upsertCompany,
  normalizeCompanyName,
  extractDomainFromEmail,
} from "@/lib/companiesStorage";
import {
  StoredContact,
  OrgRole,
  Department,
  DEFAULT_ORG,
  autoGroupByDepartment,
  batchUpdateContacts,
  revertAutoGroup,
} from "@/lib/contactsStorage";
import { loadContactsV2, updateContactV2, type ContactV2 } from "@/lib/contacts/storage";
import { useToast } from "@/hooks/use-toast";
import { OrgMap } from "@/components/org-map";
import { CompanyAvatar } from "@/components/companies/CompanyAvatar";
import { generateCompanyReport } from "@/lib/companyReportPdf";

interface CompanyDetailProps {
  companyId: string;
  onBack: () => void;
  onSelectContact: (contact: StoredContact) => void;
  initialTab?: "contacts" | "orgmap" | "notes";
  onScanForCompany?: (companyName: string) => void;
}

// Department display names
const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: "Exec",
  LEGAL: "Legal",
  PROJECT_DELIVERY: "Project Delivery",
  SALES: "Sales",
  FINANCE: "Finance",
  OPS: "Ops",
  UNKNOWN: "Unknown",
};

const DEPARTMENT_ORDER: Department[] = [
  "EXEC",
  "LEGAL",
  "PROJECT_DELIVERY",
  "SALES",
  "FINANCE",
  "OPS",
  "UNKNOWN",
];

// Department stripe colours for contact rows
const DEPARTMENT_STRIPE: Record<Department, string> = {
  EXEC: "bg-purple-500",
  LEGAL: "bg-indigo-500",
  PROJECT_DELIVERY: "bg-emerald-500",
  SALES: "bg-pink-500",
  FINANCE: "bg-amber-500",
  OPS: "bg-cyan-500",
  UNKNOWN: "bg-black/10",
};

// Company Header
function CompanyHeader({
  company,
  contactCount,
  contacts,
}: {
  company: Company;
  contactCount: number;
  contacts: ContactV2[];
}) {
  const contactEmails = contacts.map((c) => c.email).filter(Boolean);

  return (
    <div className="flex items-center gap-4 py-2">
      <CompanyAvatar
        name={company.name}
        domain={company.domain}
        contactEmails={contactEmails}
        size="lg"
        className="rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <h1
          className="text-[22px] font-extrabold tracking-[-0.6px] truncate"
          data-testid="company-name"
        >
          {company.name}
        </h1>
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground/60 flex-wrap">
          <span>{contactCount} contact{contactCount !== 1 ? "s" : ""}</span>
          {company.domain && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span>{company.domain}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to get contact initials
function getContactInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export function CompanyDetail({
  companyId,
  onBack,
  onSelectContact,
  initialTab = "orgmap",
  onScanForCompany,
}: CompanyDetailProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<ContactV2[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const reduceMotion = useReducedMotion();
  const tabIndex = activeTab === "contacts" ? 0 : activeTab === "orgmap" ? 1 : 2;
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<Department | "ALL">("ALL");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [undoState, setUndoState] = useState<Map<string, Department> | null>(null);
  const [quickEditContact, setQuickEditContact] = useState<ContactV2 | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const { toast } = useToast();

  // Load company and contacts
  useEffect(() => {
    const loadedCompany = getCompanyById(companyId);
    setCompany(loadedCompany || null);
    setNotes(loadedCompany?.notes || "");

    const allContacts = loadContactsV2();
    if (loadedCompany) {
      const companyContacts = allContacts.filter((c) => {
        if (c.companyId === companyId) return true;
        if (
          c.company &&
          normalizeCompanyName(c.company).toLowerCase() ===
            normalizeCompanyName(loadedCompany.name).toLowerCase()
        )
          return true;
        if (loadedCompany.domain) {
          const contactDomain = extractDomainFromEmail(c.email);
          if (contactDomain === loadedCompany.domain.toLowerCase()) return true;
        }
        return false;
      });
      setContacts(companyContacts);
    }
  }, [companyId]);

  const refreshContacts = useCallback(() => {
    const allContacts = loadContactsV2();
    if (company) {
      const companyContacts = allContacts.filter((c) => {
        if (c.companyId === companyId) return true;
        if (
          c.company &&
          normalizeCompanyName(c.company).toLowerCase() ===
            normalizeCompanyName(company.name).toLowerCase()
        )
          return true;
        if (company.domain) {
          const contactDomain = extractDomainFromEmail(c.email);
          if (contactDomain === company.domain.toLowerCase()) return true;
        }
        return false;
      });
      setContacts(companyContacts);
    }
  }, [company, companyId]);

  // Filter contacts by department
  const filteredContacts = useMemo(() => {
    if (departmentFilter === "ALL") return contacts;
    return contacts.filter((c) => (c.org?.department || "UNKNOWN") === departmentFilter);
  }, [contacts, departmentFilter]);

  // Auto-group handler
  const handleAutoGroup = useCallback(() => {
    const { updated, changedCount, previousStates } = autoGroupByDepartment(contacts);
    if (changedCount > 0) {
      batchUpdateContacts(updated);
      setUndoState(previousStates);
      refreshContacts();
      toast({
        title: `Grouped ${changedCount} contact${changedCount !== 1 ? "s" : ""}`,
        description: "Departments assigned based on job titles",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              revertAutoGroup(previousStates);
              setUndoState(null);
              refreshContacts();
              toast({ title: "Undo complete", description: "Departments reverted" });
            }}
          >
            Undo
          </Button>
        ),
      });
    } else {
      toast({
        title: "No changes made",
        description: "All contacts already have departments assigned",
      });
    }
  }, [contacts, refreshContacts, toast]);

  // Edit Org handler
  const handleEditOrg = useCallback(() => {
    setActiveTab("orgmap");
  }, []);

  // Quick edit org field handlers
  const handleQuickEditField = useCallback(
    async (field: "department" | "role" | "reportsToId", value: string | null) => {
      if (!quickEditContact) return;
      const currentOrg = quickEditContact.org || { ...DEFAULT_ORG };
      const updatedOrg = { ...currentOrg, [field]: value };
      await updateContactV2(quickEditContact.id, { org: updatedOrg });
      setQuickEditContact({ ...quickEditContact, org: updatedOrg });
      refreshContacts();
    },
    [quickEditContact, refreshContacts]
  );

  const handleClearManager = useCallback(() => {
    handleQuickEditField("reportsToId", null);
    toast({ title: "Manager cleared" });
  }, [handleQuickEditField, toast]);

  const handleDownloadReport = useCallback(async () => {
    if (!company || isGeneratingReport) return;
    setIsGeneratingReport(true);

    try {
      toast({ title: "Generating report...", description: "Fetching latest company data" });

      let intel = null;
      let intelV2 = null;

      try {
        const params = new URLSearchParams();
        params.set("companyName", company.name);
        if (company.domain) params.set("domain", company.domain);
        const res = await fetch(`/api/intel-v2?${params.toString()}`);
        if (res.ok) intelV2 = await res.json();
      } catch (e) {
        console.warn("[Report] Failed to fetch intel v2:", e);
      }

      try {
        const res = await fetch("/api/intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: company.name,
            website: company.domain,
          }),
        });
        if (res.ok) intel = await res.json();
      } catch (e) {
        console.warn("[Report] Failed to fetch intel v1:", e);
      }

      const freshContacts = loadContactsV2().filter((c) => {
        if (c.companyId === companyId) return true;
        if (
          c.company &&
          normalizeCompanyName(c.company).toLowerCase() ===
            normalizeCompanyName(company.name).toLowerCase()
        )
          return true;
        if (company.domain) {
          const contactDomain = extractDomainFromEmail(c.email);
          if (contactDomain === company.domain.toLowerCase()) return true;
        }
        return false;
      });

      await generateCompanyReport({
        company,
        contacts: freshContacts,
        intel,
        intelV2,
      });

      toast({ title: "Report downloaded", description: `${company.name} report saved as PDF` });
    } catch (e: any) {
      console.error("[Report] Failed to generate report:", e);
      toast({
        title: "Report failed",
        description: e?.message || "Could not generate the report",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [company, companyId, contacts, isGeneratingReport, toast]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setNotesSaved(false);
  };

  const handleSaveNotes = () => {
    if (company) {
      upsertCompany({ ...company, notes });
      setNotesSaved(true);
    }
  };

  if (!company) {
    return (
      <div className="px-4 pt-2 pb-32 max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-[#4B68F5] font-bold text-[15px] px-0 hover:bg-transparent"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </Button>
        <div className="text-center py-12 text-muted-foreground">Company not found</div>
      </div>
    );
  }

  // Build location string for intel chips
  const locationParts = [company.city, company.state, company.country].filter(Boolean);
  const locationString = locationParts.join(", ");

  return (
    <div className="px-4 pt-2 pb-32 max-w-2xl mx-auto space-y-4">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[#4B68F5] font-bold text-[15px] px-0 hover:bg-transparent"
        data-testid="button-back-companies"
      >
        <ChevronLeft className="w-5 h-5" />
        Back to Companies
      </Button>

      {/* Hero header */}
      <div className="flex items-start justify-between gap-3 mt-2">
        <div className="flex-1 min-w-0">
          <CompanyHeader company={company} contactCount={contacts.length} contacts={contacts} />

          {/* Intel chips */}
          {(company.domain || locationString) && (
            <div className="flex gap-2 flex-wrap mt-2">
              {company.domain && (
                <span className="bg-white border border-black/10 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted-foreground shadow-sm flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  {company.domain}
                </span>
              )}
              {locationString && (
                <span className="bg-white border border-black/10 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted-foreground shadow-sm flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {locationString}
                </span>
              )}
            </div>
          )}
        </div>

        {/* PDF button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleDownloadReport}
          disabled={isGeneratingReport}
          className="shrink-0 w-10 h-10 rounded-xl bg-white border border-black/10 shadow-sm"
          data-testid="button-download-report"
        >
          {isGeneratingReport ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="relative flex h-auto w-full rounded-2xl bg-[#F2F2F7] border border-black/10 shadow-sm p-1 gap-0 mt-4">
          <motion.span
            className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-white shadow-sm"
            style={{ width: "calc((100% - 0.5rem) / 3)" }}
            animate={{ x: `${tabIndex * 100}%` }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 520, damping: 42, mass: 0.35 }
            }
          />
          <TabsTrigger
            value="contacts"
            className="relative flex-1 min-w-0 rounded-xl py-2.5 text-[13px] font-bold bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60"
            data-testid="tab-people"
          >
            <span className="relative z-10 flex w-full min-w-0 items-center justify-center gap-1.5">
              <Users
                className={`w-4 h-4 shrink-0 ${activeTab === "contacts" ? "text-[#4B68F5]" : ""}`}
              />
              <span className="min-w-0 truncate">People</span>
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="orgmap"
            className="relative flex-1 min-w-0 rounded-xl py-2.5 text-[13px] font-bold bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60"
            data-testid="tab-org"
          >
            <span className="relative z-10 flex w-full min-w-0 items-center justify-center gap-1.5">
              <Network
                className={`w-4 h-4 shrink-0 ${activeTab === "orgmap" ? "text-[#4B68F5]" : ""}`}
              />
              <span className="min-w-0 truncate">Org</span>
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="notes"
            className="relative flex-1 min-w-0 rounded-xl py-2.5 text-[13px] font-bold bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60"
            data-testid="tab-notes"
          >
            <span className="relative z-10 flex w-full min-w-0 items-center justify-center gap-1.5">
              <StickyNote
                className={`w-4 h-4 shrink-0 ${activeTab === "notes" ? "text-[#4B68F5]" : ""}`}
              />
              <span className="min-w-0 truncate">Notes</span>
            </span>
          </TabsTrigger>
        </TabsList>

        {/* People Tab */}
        <TabsContent value="contacts" className="mt-4 space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No contacts yet for this company.</p>
              <p className="text-sm mt-1">Scan a card or link existing people to this company.</p>
            </div>
          ) : (
            <>
              {/* Filter Controls Row */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterSheet(true)}
                  className="gap-1.5 bg-white border border-black/10 rounded-xl shadow-sm text-[13px] font-semibold h-auto px-3 py-2"
                  data-testid="button-open-filter"
                >
                  <Filter className="w-4 h-4" />
                  <span>{getFilterSummary({ department: departmentFilter })}</span>
                </Button>
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-muted-foreground/60">
                  {filteredContacts.length} of {contacts.length}
                </span>
              </div>

              {/* Contact rows */}
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No contacts in this department.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="relative bg-white rounded-xl border border-black/10 shadow-sm p-3 flex items-start gap-3 cursor-pointer active:opacity-75 transition-opacity overflow-hidden"
                      onClick={() => onSelectContact(contact)}
                      data-testid={`company-contact-${contact.id}`}
                    >
                      {/* Department stripe */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${
                          DEPARTMENT_STRIPE[contact.org?.department || "UNKNOWN"]
                        }`}
                      />

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-black/5 text-[#3A3A3F] flex items-center justify-center font-extrabold text-sm shrink-0 ml-1">
                        {getContactInitials(contact.name)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-bold text-foreground truncate flex-1">
                            {contact.name || contact.email || "Unknown"}
                          </span>
                          <button
                            className="bg-black/5 rounded-full w-8 h-8 flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickEditContact(contact);
                            }}
                            data-testid={`button-quick-edit-${contact.id}`}
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                        </div>
                        {contact.title && (
                          <p className="text-[12px] font-medium text-muted-foreground mt-0.5 truncate pr-2">
                            {contact.title}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <DepartmentBadge department={contact.org?.department || "UNKNOWN"} />
                          {contact.org?.role && contact.org.role !== "UNKNOWN" && (
                            <OrgRoleBadge role={contact.org.role} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Org Tab */}
        <TabsContent value="orgmap" className="mt-4 pt-2">
          <OrgMap
            companyId={companyId}
            contacts={contacts}
            onContactUpdate={refreshContacts}
            onSelectContact={onSelectContact}
            companyName={company.name}
            onAddContact={(name) => {
              onScanForCompany?.(name);
            }}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <div className="bg-white rounded-2xl border border-black/10 shadow-sm overflow-hidden">
            <Textarea
              placeholder="Add notes about this company..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="w-full min-h-[140px] p-4 text-[15px] font-medium border-0 outline-none resize-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
              data-testid="company-notes-input"
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.08]">
              <span className="text-[11px] font-semibold text-muted-foreground/60">
                {notesSaved ? "All changes saved" : "Unsaved changes"}
              </span>
              <Button
                variant="ghost"
                onClick={handleSaveNotes}
                disabled={notesSaved}
                className="text-[13px] font-bold text-[#4B68F5] h-auto px-0 hover:bg-transparent disabled:opacity-40"
                data-testid="button-save-notes"
              >
                Save Notes
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Filter Sheet */}
      <FilterSheet
        open={showFilterSheet}
        onOpenChange={setShowFilterSheet}
        filters={{ department: departmentFilter }}
        onApply={(f) => {
          setDepartmentFilter(f.department);
        }}
        onAutoGroup={handleAutoGroup}
        onEditOrg={handleEditOrg}
      />

      {/* Quick Edit Drawer */}
      <Drawer open={!!quickEditContact} onOpenChange={(open) => !open && setQuickEditContact(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {quickEditContact?.name || "Edit Contact"}
            </DrawerTitle>
            {quickEditContact?.title && (
              <p className="text-sm text-muted-foreground">{quickEditContact.title}</p>
            )}
          </DrawerHeader>
          <div className="p-4 space-y-4">
            {/* Department Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select
                value={quickEditContact?.org?.department || "UNKNOWN"}
                onValueChange={(value) => handleQuickEditField("department", value as Department)}
              >
                <SelectTrigger
                  className="bg-[#F2F2F7] border border-black/10 rounded-xl h-12 text-[15px] font-semibold"
                  data-testid="select-department"
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_ORDER.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {DEPARTMENT_LABELS[dept]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Org Role</label>
              <Select
                value={quickEditContact?.org?.role || "UNKNOWN"}
                onValueChange={(value) => handleQuickEditField("role", value as OrgRole)}
              >
                <SelectTrigger
                  className="bg-[#F2F2F7] border border-black/10 rounded-xl h-12 text-[15px] font-semibold"
                  data-testid="select-role"
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAMPION">Champion</SelectItem>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  <SelectItem value="BLOCKER">Blocker</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Manager Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reports To</label>
              <Select
                value={quickEditContact?.org?.reportsToId || "_none"}
                onValueChange={(value) =>
                  handleQuickEditField("reportsToId", value === "_none" ? null : value)
                }
              >
                <SelectTrigger
                  className="bg-[#F2F2F7] border border-black/10 rounded-xl h-12 text-[15px] font-semibold"
                  data-testid="select-manager"
                >
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Manager (Top Level)</SelectItem>
                  {contacts
                    .filter((c) => c.id !== quickEditContact?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || c.email || "Unknown"}
                        {c.title && ` - ${c.title}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Manager Button */}
            {quickEditContact?.org?.reportsToId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClearManager}
                data-testid="button-clear-manager"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Manager
              </Button>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button
                className="w-full bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] text-white rounded-2xl h-12 font-bold border-0 hover:opacity-90"
                data-testid="button-close-quick-edit"
              >
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Org Role Badge
function OrgRoleBadge({ role }: { role: OrgRole }) {
  const icons: Record<OrgRole, typeof Shield> = {
    CHAMPION: Shield,
    NEUTRAL: Minus,
    BLOCKER: AlertTriangle,
    UNKNOWN: CircleDot,
  };

  const Icon = icons[role];
  const displayName = role.charAt(0) + role.slice(1).toLowerCase();

  return (
    <Badge
      variant="secondary"
      className="bg-black/5 text-muted-foreground/70 text-[11px] font-semibold rounded-md px-2 py-0.5 h-auto gap-0.5 border-0"
    >
      <Icon className="w-2.5 h-2.5" />
      {displayName}
    </Badge>
  );
}

// Department Badge
function DepartmentBadge({ department }: { department: Department }) {
  return (
    <Badge
      variant="secondary"
      className="bg-black/5 text-muted-foreground/70 text-[11px] font-semibold rounded-md px-2 py-0.5 h-auto gap-0.5 border-0"
    >
      <Briefcase className="w-2.5 h-2.5" />
      {DEPARTMENT_LABELS[department]}
    </Badge>
  );
}

export { OrgRoleBadge, DepartmentBadge };
