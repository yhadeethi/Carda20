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
  ArrowLeft,
  Briefcase,
  Building2,
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

interface CompanyDetailProps {
  companyId: string;
  onBack: () => void;
  onSelectContact: (contact: StoredContact) => void;
  initialTab?: 'contacts' | 'orgmap' | 'notes';
}

// Department display names
const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: 'Exec',
  LEGAL: 'Legal',
  PROJECT_DELIVERY: 'Project Delivery',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OPS: 'Ops',
  UNKNOWN: 'Unknown',
};

const DEPARTMENT_ORDER: Department[] = ['EXEC', 'LEGAL', 'PROJECT_DELIVERY', 'SALES', 'FINANCE', 'OPS', 'UNKNOWN'];

// Company Header with Logo using shared CompanyAvatar
function CompanyHeader({ company, contactCount, contacts }: { company: Company; contactCount: number; contacts: ContactV2[] }) {
  const contactEmails = contacts.map(c => c.email).filter(Boolean);
  
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
        <h1 className="text-xl font-semibold truncate" data-testid="company-name">
          {company.name}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {company.domain && <span>{company.domain}</span>}
          <span className="text-muted-foreground/50">·</span>
          <span>{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

export function CompanyDetail({ companyId, onBack, onSelectContact, initialTab = 'orgmap' }: CompanyDetailProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<ContactV2[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const reduceMotion = useReducedMotion();
  const tabIndex = activeTab === "contacts" ? 0 : activeTab === "orgmap" ? 1 : 2;
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'ALL'>('ALL');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [undoState, setUndoState] = useState<Map<string, Department> | null>(null);
  const [quickEditContact, setQuickEditContact] = useState<ContactV2 | null>(null);
  const { toast } = useToast();

  // Load company and contacts
  useEffect(() => {
    const loadedCompany = getCompanyById(companyId);
    setCompany(loadedCompany || null);
    setNotes(loadedCompany?.notes || "");

    // Load all contacts and filter by company
    const allContacts = loadContactsV2();
    if (loadedCompany) {
      const companyContacts = allContacts.filter((c) => {
        if (c.companyId === companyId) return true;
        if (c.company && normalizeCompanyName(c.company).toLowerCase() === normalizeCompanyName(loadedCompany.name).toLowerCase()) return true;
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
        if (c.company && normalizeCompanyName(c.company).toLowerCase() === normalizeCompanyName(company.name).toLowerCase()) return true;
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
    if (departmentFilter === 'ALL') return contacts;
    return contacts.filter(c => (c.org?.department || 'UNKNOWN') === departmentFilter);
  }, [contacts, departmentFilter]);

  // Auto-group handler
  const handleAutoGroup = useCallback(() => {
    const { updated, changedCount, previousStates } = autoGroupByDepartment(contacts);
    if (changedCount > 0) {
      batchUpdateContacts(updated);
      setUndoState(previousStates);
      refreshContacts();
      toast({
        title: `Grouped ${changedCount} contact${changedCount !== 1 ? 's' : ''}`,
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

  // Edit Org handler - switch to org map with edit mode
  const handleEditOrg = useCallback(() => {
    setActiveTab('orgmap');
  }, []);

  // Quick edit org field handlers
  const handleQuickEditField = useCallback(async (field: 'department' | 'role' | 'reportsToId', value: string | null) => {
    if (!quickEditContact) return;

    const currentOrg = quickEditContact.org || { ...DEFAULT_ORG };
    const updatedOrg = { ...currentOrg, [field]: value };

    await updateContactV2(quickEditContact.id, { org: updatedOrg });
    setQuickEditContact({ ...quickEditContact, org: updatedOrg });
    refreshContacts();
  }, [quickEditContact, refreshContacts]);

  const handleClearManager = useCallback(() => {
    handleQuickEditField('reportsToId', null);
    toast({ title: "Manager cleared" });
  }, [handleQuickEditField, toast]);

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
      <div className="p-4 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          Company not found
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={onBack} className="mb-2" data-testid="button-back-companies">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Companies
      </Button>

      {/* Simplified Hero Header with Logo */}
      <CompanyHeader company={company} contactCount={contacts.length} contacts={contacts} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="relative flex h-14 w-full rounded-full bg-muted p-1 ring-1 ring-border/50">
  <motion.span
    className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-background shadow-sm"
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
    className="relative flex-1 min-w-0 h-12 rounded-full px-3 text-sm font-medium bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
    data-testid="tab-people"
  >
    <span className="relative z-10 flex w-full min-w-0 items-center justify-center gap-2">
      <Users className="w-4 h-4 shrink-0" />
      <span className="min-w-0 truncate">People</span>
    </span>
  </TabsTrigger>

  <TabsTrigger
    value="orgmap"
    className="relative flex-1 min-w-0 h-12 rounded-full px-3 text-sm font-medium bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
    data-testid="tab-org"
  >
    <span className="relative z-10 flex w-full min-w-0 items-center justify-center gap-2">
      <Network className="w-4 h-4 shrink-0" />
      <span className="min-w-0 truncate">Org</span>
    </span>
  </TabsTrigger>

  <TabsTrigger
    value="notes"
    className="relative flex-1 min-w-0 h-12 rounded-full px-3 text-sm font-medium bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
    data-testid="tab-notes"
  >
    <span className="relative z-10 flex w-full min-w-0 items-center justify-center gap-2">
      <StickyNote className="w-4 h-4 shrink-0" />
      <span className="min-w-0 truncate">Notes</span>
    </span>
  </TabsTrigger>
</TabsList>

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
                  className="gap-1.5"
                  data-testid="button-open-filter"
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">{getFilterSummary({ department: departmentFilter })}</span>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {filteredContacts.length} of {contacts.length}
                </span>
              </div>

              {/* Contacts list */}
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No contacts in this department.</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer relative group"
                    onClick={() => onSelectContact(contact)}
                    data-testid={`company-contact-${contact.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate flex-1">{contact.name || contact.email || "Unknown"}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickEditContact(contact);
                        }}
                        data-testid={`button-quick-edit-${contact.id}`}
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {contact.title && (
                      <p className="text-sm text-muted-foreground mt-0.5 ml-6 truncate pr-8">
                        {contact.title}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 ml-6 flex-wrap">
                      {/* Department badge */}
                      <DepartmentBadge department={contact.org?.department || 'UNKNOWN'} />
                      {/* Role badge */}
                      {contact.org?.role && contact.org.role !== 'UNKNOWN' && (
                        <OrgRoleBadge role={contact.org.role} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="orgmap" className="mt-4">
          <OrgMap
            companyId={companyId}
            contacts={contacts}
            onContactUpdate={refreshContacts}
            onSelectContact={onSelectContact}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          <Textarea
            placeholder="Add notes about this company..."
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={8}
            className="resize-none"
            data-testid="company-notes-input"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {notesSaved ? "All changes saved" : "Unsaved changes"}
            </span>
            <Button
              onClick={handleSaveNotes}
              disabled={notesSaved}
              size="sm"
              data-testid="button-save-notes"
            >
              Save Notes
            </Button>
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

      {/* Quick Edit Bottom Sheet */}
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
                value={quickEditContact?.org?.department || 'UNKNOWN'}
                onValueChange={(value) => handleQuickEditField('department', value as Department)}
              >
                <SelectTrigger data-testid="select-department">
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
                value={quickEditContact?.org?.role || 'UNKNOWN'}
                onValueChange={(value) => handleQuickEditField('role', value as OrgRole)}
              >
                <SelectTrigger data-testid="select-role">
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
                value={quickEditContact?.org?.reportsToId || '_none'}
                onValueChange={(value) => handleQuickEditField('reportsToId', value === '_none' ? null : value)}
              >
                <SelectTrigger data-testid="select-manager">
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
              <Button variant="outline" data-testid="button-close-quick-edit">Done</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Org Role Badge Component
function OrgRoleBadge({ role }: { role: OrgRole }) {
  const config: Record<OrgRole, { icon: typeof Shield; className: string }> = {
    CHAMPION: { icon: Shield, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    NEUTRAL: { icon: Minus, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    BLOCKER: { icon: AlertTriangle, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    UNKNOWN: { icon: CircleDot, className: "bg-gray-100 text-gray-500" },
  };
  
  const { icon: Icon, className } = config[role];
  const displayName = role.charAt(0) + role.slice(1).toLowerCase();
  
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 gap-0.5 ${className}`}>
      <Icon className="w-2.5 h-2.5" />
      {displayName}
    </Badge>
  );
}

// Department Badge Component
function DepartmentBadge({ department }: { department: Department }) {
  const config: Record<Department, string> = {
    EXEC: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    LEGAL: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    PROJECT_DELIVERY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    SALES: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    FINANCE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    OPS: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    UNKNOWN: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 gap-0.5 ${config[department]}`}>
      <Briefcase className="w-2.5 h-2.5" />
      {DEPARTMENT_LABELS[department]}
    </Badge>
  );
}

export { OrgRoleBadge, DepartmentBadge };
