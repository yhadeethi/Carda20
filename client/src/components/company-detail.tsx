/**
 * Company Detail Page for Org Intelligence
 * Shows company info with tabs: Contacts, Org Map, Notes
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Building2,
  Users,
  Network,
  StickyNote,
  MapPin,
  Globe,
  User,
  ChevronDown,
  Check,
  Shield,
  Minus,
  AlertTriangle,
  CircleDot,
  Wand2,
  Pencil,
  Briefcase,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Company,
  getCompanyById,
  upsertCompany,
  getContactCountForCompany,
  normalizeCompanyName,
  extractDomainFromEmail,
} from "@/lib/companiesStorage";
import {
  StoredContact,
  loadContacts,
  updateContact,
  OrgRole,
  InfluenceLevel,
  Department,
  autoGroupByDepartment,
  batchUpdateContacts,
  revertAutoGroup,
} from "@/lib/contactsStorage";
import { useToast } from "@/hooks/use-toast";
import { OrgMap } from "@/components/org-map";

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

export function CompanyDetail({ companyId, onBack, onSelectContact, initialTab = 'orgmap' }: CompanyDetailProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<StoredContact[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'ALL'>('ALL');
  const [undoState, setUndoState] = useState<Map<string, Department> | null>(null);
  const { toast } = useToast();

  // Load company and contacts
  useEffect(() => {
    const loadedCompany = getCompanyById(companyId);
    setCompany(loadedCompany || null);
    setNotes(loadedCompany?.notes || "");
    
    // Load all contacts and filter by company
    const allContacts = loadContacts();
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
    const allContacts = loadContacts();
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

      <Card className="glass">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl font-semibold" data-testid="company-name">
                {company.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                {company.domain && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{company.domain}</span>
                  </div>
                )}
                {(company.city || company.state) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{[company.city, company.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="contacts" className="gap-1.5 text-xs" data-testid="tab-contacts">
            <Users className="w-4 h-4" />
            <span>Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="orgmap" className="gap-1.5 text-xs" data-testid="tab-orgmap">
            <Network className="w-4 h-4" />
            <span>Org Map</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs" data-testid="tab-notes">
            <StickyNote className="w-4 h-4" />
            <span>Notes</span>
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
              {/* Department filter chips */}
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-2">
                  <Badge
                    variant={departmentFilter === 'ALL' ? 'default' : 'outline'}
                    className="cursor-pointer shrink-0"
                    onClick={() => setDepartmentFilter('ALL')}
                    data-testid="filter-all"
                  >
                    All
                  </Badge>
                  {DEPARTMENT_ORDER.map((dept) => (
                    <Badge
                      key={dept}
                      variant={departmentFilter === dept ? 'default' : 'outline'}
                      className="cursor-pointer shrink-0"
                      onClick={() => setDepartmentFilter(dept)}
                      data-testid={`filter-${dept.toLowerCase()}`}
                    >
                      {DEPARTMENT_LABELS[dept]}
                    </Badge>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGroup}
                  data-testid="button-auto-group"
                >
                  <Wand2 className="w-4 h-4 mr-1.5" />
                  Auto-group
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditOrg}
                  data-testid="button-edit-org"
                >
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Edit Org
                </Button>
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
                    className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                    onClick={() => onSelectContact(contact)}
                    data-testid={`company-contact-${contact.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{contact.name || contact.email || "Unknown"}</span>
                    </div>
                    {contact.title && (
                      <p className="text-sm text-muted-foreground mt-0.5 ml-6 truncate">
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
                      {/* Influence badge */}
                      {contact.org?.influence && contact.org.influence !== 'UNKNOWN' && (
                        <InfluenceBadge level={contact.org.influence} />
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

// Influence Badge Component
function InfluenceBadge({ level }: { level: InfluenceLevel }) {
  const config: Record<InfluenceLevel, string> = {
    HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    LOW: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    UNKNOWN: "bg-gray-100 text-gray-500",
  };
  const displayName = level.charAt(0) + level.slice(1).toLowerCase();
  
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${config[level]}`}>
      {displayName} Influence
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

export { OrgRoleBadge, InfluenceBadge, DepartmentBadge };
