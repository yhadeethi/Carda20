/**
 * Contacts Hub with People / Companies Split for Org Intelligence
 * UI hardened: no overflow, better hierarchy, cleaner actions
 */

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { StoredContact, loadContacts, deleteContact, getUniqueEventNames } from "@/lib/contactsStorage";
import {
  Company,
  getCompanies,
  upsertCompany,
  createCompany,
  autoGenerateCompaniesFromContacts,
  getContactCountForCompany,
} from "@/lib/companiesStorage";

import {
  Search,
  User,
  Building,
  Building2,
  Calendar,
  Tag,
  Users,
  Plus,
  Bell,
  Merge,
  MoreHorizontal,
} from "lucide-react";

import { CompanyGrid } from "@/components/companies/CompanyGrid";
import { UpcomingView } from "@/components/upcoming-view";
import { DuplicatesView } from "@/components/duplicates-view";
import { format } from "date-fns";

type TabMode = "people" | "companies";
type PeopleSubView = "all" | "upcoming" | "duplicates";

interface ContactsHubProps {
  onSelectContact: (contact: StoredContact) => void;
  onBackToScan: () => void;
  refreshKey?: number;
  onContactDeleted?: () => void;
  onSelectCompany?: (companyId: string) => void;
}

export function ContactsHub({
  onSelectContact,
  onBackToScan,
  refreshKey,
  onContactDeleted,
  onSelectCompany,
}: ContactsHubProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("people");
  const [peopleSubView, setPeopleSubView] = useState<PeopleSubView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [contacts, setContacts] = useState<StoredContact[]>(() => loadContacts());
  const [companies, setCompanies] = useState<Company[]>(() => getCompanies());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");
  const [newCompanyCity, setNewCompanyCity] = useState("");
  const [newCompanyState, setNewCompanyState] = useState("");
  const [newCompanyCountry, setNewCompanyCountry] = useState("");
  const [newCompanyNotes, setNewCompanyNotes] = useState("");

  // Auto-generate companies from contacts on first load
  useEffect(() => {
    const loadedContacts = loadContacts();
    setContacts(loadedContacts);

    const updatedCompanies = autoGenerateCompaniesFromContacts(loadedContacts);
    setCompanies(updatedCompanies);
  }, [refreshKey]);

  const eventNames = useMemo(() => getUniqueEventNames(), [contacts]);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];

    if (eventFilter !== "all") {
      result = result.filter((c) => c.eventName === eventFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.name?.toLowerCase().includes(query) || c.company?.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [contacts, searchQuery, eventFilter]);

  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.name?.toLowerCase().includes(query) || c.domain?.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      const countA = getContactCountForCompany(a.id, contacts);
      const countB = getContactCountForCompany(b.id, contacts);
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [companies, searchQuery, contacts]);

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteContact(deleteConfirmId);
      setContacts(loadContacts());
      setDeleteConfirmId(null);
      onContactDeleted?.();
    }
  };

  const handleAddCompany = () => {
    if (!newCompanyName.trim()) return;

    const company = createCompany({
      name: newCompanyName.trim(),
      domain: newCompanyDomain.trim() || null,
      city: newCompanyCity.trim() || null,
      state: newCompanyState.trim() || null,
      country: newCompanyCountry.trim() || null,
      notes: newCompanyNotes.trim() || null,
    });

    upsertCompany(company);
    setCompanies(getCompanies());
    resetAddCompanyForm();
  };

  const resetAddCompanyForm = () => {
    setShowAddCompany(false);
    setNewCompanyName("");
    setNewCompanyDomain("");
    setNewCompanyCity("");
    setNewCompanyState("");
    setNewCompanyCountry("");
    setNewCompanyNotes("");
  };

  const contactToDelete = deleteConfirmId ? contacts.find((c) => c.id === deleteConfirmId) : null;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy");
    } catch {
      return "";
    }
  };

  // UI helpers (does not change any business logic)
  const isNew = (dateStr: string) => {
    try {
      const d = new Date(dateStr).getTime();
      const days = (Date.now() - d) / (1000 * 60 * 60 * 24);
      return days <= 7;
    } catch {
      return false;
    }
  };

  const displayCompany = (c: StoredContact) => (c.company?.trim() ? c.company.trim() : "Unknown company");
  const displayName = (c: StoredContact) =>
    c.name?.trim() ? c.name.trim() : c.email?.trim() ? c.email.trim() : "Unknown";

  return (
    <>
      {/* Delete dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.name || "this contact"}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add company drawer */}
      <Drawer open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="text-xl font-semibold">Add Company</DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 pb-[env(safe-area-inset-bottom)] space-y-5">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-sm font-medium">
                  Company Name *
                </Label>
                <Input
                  id="company-name"
                  placeholder="Acme Corp"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="h-12 rounded-2xl"
                  data-testid="input-new-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-domain" className="text-sm font-medium">
                  Domain
                </Label>
                <Input
                  id="company-domain"
                  placeholder="acme.com"
                  value={newCompanyDomain}
                  onChange={(e) => setNewCompanyDomain(e.target.value)}
                  className="h-12 rounded-2xl"
                  data-testid="input-new-company-domain"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="company-city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input
                    id="company-city"
                    placeholder="Sydney"
                    value={newCompanyCity}
                    onChange={(e) => setNewCompanyCity(e.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-state" className="text-sm font-medium">
                    State
                  </Label>
                  <Input
                    id="company-state"
                    placeholder="NSW"
                    value={newCompanyState}
                    onChange={(e) => setNewCompanyState(e.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-country" className="text-sm font-medium">
                  Country
                </Label>
                <Input
                  id="company-country"
                  placeholder="Australia"
                  value={newCompanyCountry}
                  onChange={(e) => setNewCompanyCountry(e.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-notes" className="text-sm font-medium">
                  Notes
                </Label>
                <Textarea
                  id="company-notes"
                  placeholder="Notes about this company..."
                  value={newCompanyNotes}
                  onChange={(e) => setNewCompanyNotes(e.target.value)}
                  rows={4}
                  className="resize-none rounded-2xl"
                />
              </div>
            </div>
          </ScrollArea>

          <DrawerFooter className="border-t pt-4 flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="outline" onClick={resetAddCompanyForm} className="flex-1 rounded-2xl">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              onClick={handleAddCompany}
              disabled={!newCompanyName.trim()}
              className="flex-1 rounded-2xl"
              data-testid="button-save-company"
            >
              Save Company
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Main */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold" data-testid="contacts-hub-title">
            Relationships
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabMode)}>
            {/* Top controls */}
            <div className="sticky top-0 z-10 bg-background/60 backdrop-blur rounded-2xl">
              <TabsList className="w-full grid grid-cols-2 h-11 rounded-2xl">
                <TabsTrigger value="people" className="gap-2 text-base font-medium rounded-xl" data-testid="tab-people">
                  <User className="w-5 h-5" />
                  People
                </TabsTrigger>
                <TabsTrigger value="companies" className="gap-2 text-base font-medium rounded-xl" data-testid="tab-companies">
                  <Building2 className="w-5 h-5" />
                  Companies
                </TabsTrigger>
              </TabsList>

              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === "people" ? "Search by name, company…" : "Search companies…"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 rounded-2xl"
                  data-testid="input-contacts-search"
                />
              </div>
            </div>

            {/* People Tab */}
            <TabsContent value="people" className="mt-4 space-y-4">
              {/* Sub-view segmented pills */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  className={`px-3 py-1.5 rounded-full text-sm border transition whitespace-nowrap ${
                    peopleSubView === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                  onClick={() => setPeopleSubView("all")}
                  data-testid="filter-all"
                >
                  <span className="inline-flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    All
                  </span>
                </button>

                <button
                  className={`px-3 py-1.5 rounded-full text-sm border transition whitespace-nowrap ${
                    peopleSubView === "upcoming"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                  onClick={() => setPeopleSubView("upcoming")}
                  data-testid="filter-upcoming"
                >
                  <span className="inline-flex items-center">
                    <Bell className="w-4 h-4 mr-1" />
                    Upcoming
                  </span>
                </button>

                <button
                  className={`px-3 py-1.5 rounded-full text-sm border transition whitespace-nowrap ${
                    peopleSubView === "duplicates"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                  onClick={() => setPeopleSubView("duplicates")}
                  data-testid="filter-duplicates"
                >
                  <span className="inline-flex items-center">
                    <Merge className="w-4 h-4 mr-1" />
                    Duplicates
                  </span>
                </button>
              </div>

              {/* Sub-views */}
              {peopleSubView === "upcoming" && (
                <div className="min-h-[300px]">
                  <UpcomingView
                    onSelectContact={(id) => {
                      const contact = contacts.find((c) => c.id === id);
                      if (contact) onSelectContact(contact);
                    }}
                  />
                </div>
              )}

              {peopleSubView === "duplicates" && (
                <div className="min-h-[300px]">
                  <DuplicatesView onRefresh={() => setContacts(loadContacts())} />
                </div>
              )}

              {peopleSubView === "all" && (
                <>
                  {eventNames.length > 0 && (
                    <Select value={eventFilter} onValueChange={setEventFilter}>
                      <SelectTrigger className="rounded-2xl" data-testid="select-event-filter">
                        <SelectValue placeholder="All events" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All events</SelectItem>
                        {eventNames.map((event) => (
                          <SelectItem key={event} value={event}>
                            {event}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1" data-testid="contacts-list">
                    {filteredContacts.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground" data-testid="contacts-empty">
                        {contacts.length === 0 ? (
                          <p>No contacts saved yet. Scan a business card to get started!</p>
                        ) : (
                          <p>No contacts match your search.</p>
                        )}
                      </div>
                    ) : (
                      filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="rounded-2xl border bg-card hover:bg-muted/30 transition shadow-sm cursor-pointer"
                          onClick={() => onSelectContact(contact)}
                          data-testid={`contact-row-${contact.id}`}
                          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                        >
                          <div className="p-4 flex items-start gap-3">
                            {/* Avatar */}
                            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>

                            {/* Content – must be min-w-0 to allow truncation */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                {/* Left text stack */}
                                <div className="min-w-0">
                                  {/* Company-first */}
                                  <div className="font-semibold leading-5 truncate" title={displayCompany(contact)}>
                                    {displayCompany(contact)}
                                  </div>

                                  {/* Name + title */}
                                  <div className="text-sm text-muted-foreground mt-0.5 min-w-0 truncate" title={displayName(contact)}>
                                    <span className="font-medium text-foreground">{displayName(contact)}</span>
                                    {contact.title ? <span className="text-muted-foreground"> · {contact.title}</span> : null}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-xl opacity-70 hover:opacity-100"
                                        data-testid={`button-contact-actions-${contact.id}`}
                                      >
                                        <MoreHorizontal className="w-5 h-5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => onSelectContact(contact)}>Open</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setDeleteConfirmId(contact.id);
                                        }}
                                        data-testid={`button-delete-contact-${contact.id}`}
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              {/* Meta row – wraps safely */}
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                {isNew(contact.createdAt) && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    New
                                  </span>
                                )}

                                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Scanned {formatDate(contact.createdAt)}
                                </span>

                                {contact.eventName && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground inline-flex items-center gap-1 max-w-[220px]"
                                    data-testid={`contact-event-${contact.id}`}
                                    title={contact.eventName}
                                  >
                                    <Tag className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{contact.eventName}</span>
                                  </span>
                                )}

                                {(contact.company || contact.title) && (
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1 min-w-0">
                                    <Building className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[260px]">
                                      {[contact.company, contact.title].filter(Boolean).join(" · ")}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {filteredContacts.length > 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredCompanies.length} compan{filteredCompanies.length === 1 ? "y" : "ies"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCompany(true)}
                  className="gap-1 rounded-2xl"
                  data-testid="button-add-company"
                >
                  <Plus className="w-3 h-3" />
                  Add Company
                </Button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto pr-1" data-testid="companies-list">
                <CompanyGrid
                  companies={filteredCompanies}
                  getContactCount={(companyId) => getContactCountForCompany(companyId, contacts)}
                  getContactEmails={(companyId) => {
                    const companyContacts = contacts.filter((c) => c.companyId === companyId);
                    return companyContacts.map((c) => c.email).filter((e) => e && e.trim().length > 0);
                  }}
                  onSelectCompany={(companyId) => onSelectCompany?.(companyId)}
                  onAddCompany={() => setShowAddCompany(true)}
                  searchQuery={searchQuery}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
