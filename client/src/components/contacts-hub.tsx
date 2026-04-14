/**
 * Contacts Hub with People / Companies Split for Org Intelligence
 */

import { useState, useMemo, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

import { StoredContact, loadContacts, deleteContact, updateContact, getUniqueEventNames } from "@/lib/contactsStorage";
import {
  Company,
  getCompanies,
  upsertCompany,
  createCompany,
  deleteCompany,
  autoGenerateCompaniesFromContacts,
  getContactCountForCompany,
  resolveCompanyIdForContact,
} from "@/lib/companiesStorage";

import { Search, Plus, Bell, Merge, Users } from "lucide-react";
import { CompanyGrid } from "@/components/companies/CompanyGrid";
import { CompanyTile } from "@/components/companies/CompanyTile";
import { UpcomingView } from "@/components/upcoming-view";
import { DuplicatesView } from "@/components/duplicates-view";
import { RelationshipContactCard, StripeStatus } from "@/components/relationship/RelationshipContactCard";
import { loadContactsV2 } from "@/lib/contacts/storage";
import { ContactTask, ContactReminder } from "@/lib/contacts/types";

type TabMode = "people" | "companies";
type PeopleSubView = "all" | "upcoming" | "duplicates";

interface ContactsHubProps {
  onSelectContact: (contact: StoredContact) => void;
  onBackToScan: () => void;
  refreshKey?: number;
  onContactDeleted?: () => void;
  onSelectCompany?: (companyId: string) => void;
  initialTab?: TabMode;
}

export function ContactsHub({
  onSelectContact,
  onBackToScan,
  refreshKey,
  onContactDeleted,
  onSelectCompany,
  initialTab = "people",
}: ContactsHubProps) {
  const [activeTab, setActiveTab] = useState<TabMode>(initialTab);
  const reduceMotion = useReducedMotion();
  const [peopleSubView, setPeopleSubView] = useState<PeopleSubView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [contacts, setContacts] = useState<StoredContact[]>(() => loadContacts());
  const [companies, setCompanies] = useState<Company[]>(() => getCompanies());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteCompanyConfirmId, setDeleteCompanyConfirmId] = useState<string | null>(null);

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");
  const [newCompanyCity, setNewCompanyCity] = useState("");
  const [newCompanyState, setNewCompanyState] = useState("");
  const [newCompanyCountry, setNewCompanyCountry] = useState("");
  const [newCompanyNotes, setNewCompanyNotes] = useState("");

  const stripeStatusMap = useMemo<Map<string, StripeStatus>>(() => {
    const renderedIds = new Set(contacts.map((c) => c.id));
    const v2List = loadContactsV2().filter((v2) => renderedIds.has(v2.id));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const map = new Map<string, StripeStatus>();
    for (const v2 of v2List) {
      const hasOverdue =
        v2.tasks?.some((t: ContactTask) => !t.done && t.dueAt && new Date(t.dueAt) < today) ||
        v2.reminders?.some((r: ContactReminder) => !r.done && new Date(r.remindAt) < today);
      if (hasOverdue) { map.set(v2.id, "overdue"); continue; }

      const isDueToday =
        v2.tasks?.some(
          (t: ContactTask) => !t.done && t.dueAt && new Date(t.dueAt) >= today && new Date(t.dueAt) < tomorrow
        ) ||
        v2.reminders?.some(
          (r: ContactReminder) => !r.done && new Date(r.remindAt) >= today && new Date(r.remindAt) < tomorrow
        );
      if (isDueToday) { map.set(v2.id, "due-today"); continue; }

      if (v2.createdAt) {
        const days = (Date.now() - new Date(v2.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days <= 7) { map.set(v2.id, "new"); continue; }
      }

      map.set(v2.id, "default");
    }
    return map;
  }, [contacts]);

  useEffect(() => {
    const loadedContacts = loadContacts();
    setContacts(loadedContacts);

    const updatedCompanies = autoGenerateCompaniesFromContacts(loadedContacts);
    setCompanies(updatedCompanies);

    // Repair pass: link any contacts that are missing a companyId
    const unlinked = loadedContacts.filter((c) => !c.companyId);
    if (unlinked.length > 0) {
      let anyUpdated = false;
      unlinked.forEach((c) => {
        const resolvedId = resolveCompanyIdForContact({
          companyId: c.companyId,
          company: c.company,
          email: c.email,
          website: c.website,
        });
        if (resolvedId) {
          updateContact(c.id, { companyId: resolvedId });
          anyUpdated = true;
        }
      });
      if (anyUpdated) {
        setContacts(loadContacts());
      }
    }
  }, [refreshKey]);

  // Sync activeTab with initialTab when it changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const eventNames = useMemo(() => getUniqueEventNames(), [contacts]);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];

    if (eventFilter !== "all") {
      result = result.filter((c) => c.eventName === eventFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name?.toLowerCase().includes(query) || c.company?.toLowerCase().includes(query));
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [contacts, searchQuery, eventFilter]);

  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name?.toLowerCase().includes(query) || c.domain?.toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      const countA = getContactCountForCompany(a.id, contacts);
      const countB = getContactCountForCompany(b.id, contacts);
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });

    // Deduplicate by normalised name — keep entry with most contacts (display-only, does not mutate storage)
    const seen = new Map<string, Company>();
    for (const c of result) {
      const key = c.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, c);
        continue;
      }
      const existing = seen.get(key)!;
      if (getContactCountForCompany(c.id, contacts) > getContactCountForCompany(existing.id, contacts)) {
        seen.set(key, c);
      }
    }
    result = Array.from(seen.values());

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

  const confirmDeleteCompany = () => {
    if (deleteCompanyConfirmId) {
      deleteCompany(deleteCompanyConfirmId);
      setCompanies(getCompanies());
      setDeleteCompanyConfirmId(null);
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
  const companyToDelete = deleteCompanyConfirmId ? companies.find((c) => c.id === deleteCompanyConfirmId) : null;

  return (
    <>
      {/* Contact Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="backdrop-blur-xl bg-background/95">
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

      {/* Company Delete Confirmation */}
      <AlertDialog open={!!deleteCompanyConfirmId} onOpenChange={(open) => !open && setDeleteCompanyConfirmId(null)}>
        <AlertDialogContent className="rounded-2xl bg-card border border-card-border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">Delete company?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{companyToDelete?.name}</span>?
              {companyToDelete && getContactCountForCompany(companyToDelete.id, contacts) > 0 && (
                <span className="block mt-2 text-sm text-amber-600 dark:text-amber-500">
                  ⚠️ {getContactCountForCompany(companyToDelete.id, contacts)} contact
                  {getContactCountForCompany(companyToDelete.id, contacts) !== 1 ? "s are" : " is"} linked to this
                  company. They will not be deleted.
                </span>
              )}
              <span className="block mt-2">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2">
            <AlertDialogCancel
              data-testid="button-cancel-delete-company"
              className="flex-1 rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCompany}
              data-testid="button-confirm-delete-company"
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Company Drawer */}
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

      {/* Page */}
      <div className="pt-2 pb-32 w-full max-w-2xl mx-auto">
        <h1 className="text-[30px] font-extrabold tracking-[-1.1px] text-foreground mb-0.5">Network</h1>
        <p className="text-[13px] font-semibold text-muted-foreground/60 mb-4">
          {contacts.length} {contacts.length === 1 ? "person" : "people"} · {filteredCompanies.length}{" "}
          {filteredCompanies.length === 1 ? "company" : "companies"}
        </p>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabMode)}>
          {/* Unified header card — full width, no extra margin */}
          <div className="bg-white rounded-2xl border border-black/10 shadow-sm overflow-hidden mb-4">

            {/* Tab switcher — taller, bigger text, no count badges */}
            <TabsList className="relative flex h-16 w-full rounded-none bg-[#F2F2F7] p-1.5 gap-0">
              <motion.span
                className="pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.1875rem)] rounded-xl bg-white shadow-sm"
                animate={{ x: activeTab === "people" ? "0%" : "100%" }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 42, mass: 0.35 }
                }
              />
              <TabsTrigger
                value="people"
                className="relative flex-1 min-w-0 h-full rounded-xl text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60"
                data-testid="tab-people"
              >
                <span className="relative z-10">People</span>
              </TabsTrigger>

              <TabsTrigger
                value="companies"
                className="relative flex-1 min-w-0 h-full rounded-xl text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60"
                data-testid="tab-companies"
              >
                <span className="relative z-10">Companies</span>
              </TabsTrigger>
            </TabsList>

            {/* Search input */}
            <div className="border-t border-black/[0.08] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                placeholder={activeTab === "people" ? "Search by name or company..." : "Search companies..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 shadow-none rounded-none bg-transparent pl-10 pr-4 py-3.5 h-auto text-[15px] font-medium placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                data-testid="input-contacts-search"
              />
            </div>

            {/* Filter chips — People tab only, bigger and properly spaced */}
            {activeTab === "people" && (
              <div className="border-t border-black/[0.08] px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold border whitespace-nowrap transition-colors ${
                    peopleSubView === "all"
                      ? "bg-[#4B68F5] border-[#4B68F5] text-white"
                      : "bg-[#F2F2F7] border-black/10 text-muted-foreground"
                  }`}
                  onClick={() => setPeopleSubView("all")}
                  data-testid="filter-all"
                >
                  <Users className="w-3.5 h-3.5" />
                  All
                </button>

                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold border whitespace-nowrap transition-colors ${
                    peopleSubView === "upcoming"
                      ? "bg-[#4B68F5] border-[#4B68F5] text-white"
                      : "bg-[#F2F2F7] border-black/10 text-muted-foreground"
                  }`}
                  onClick={() => setPeopleSubView("upcoming")}
                  data-testid="filter-upcoming"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Upcoming
                </button>

                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold border whitespace-nowrap transition-colors ${
                    peopleSubView === "duplicates"
                      ? "bg-[#4B68F5] border-[#4B68F5] text-white"
                      : "bg-[#F2F2F7] border-black/10 text-muted-foreground"
                  }`}
                  onClick={() => setPeopleSubView("duplicates")}
                  data-testid="filter-duplicates"
                >
                  <Merge className="w-3.5 h-3.5" />
                  Dupes
                </button>
              </div>
            )}
          </div>

          {/* People Tab Content */}
          <TabsContent value="people" className="mt-0 space-y-0">
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
                    <SelectTrigger className="rounded-2xl mb-3" data-testid="select-event-filter">
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

                {filteredContacts.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-muted-foreground/60 px-1 mb-2">
                    {filteredContacts.length} {filteredContacts.length === 1 ? "person" : "people"}
                  </p>
                )}

                <div className="space-y-2" data-testid="contacts-list">
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
                      <RelationshipContactCard
                        key={contact.id}
                        contact={contact}
                        stripeStatus={stripeStatusMap.get(contact.id)}
                        onOpen={() => onSelectContact(contact)}
                        onDelete={() => setDeleteConfirmId(contact.id)}
                        onContactUpdated={() => {
                          setContacts(loadContacts());
                          const updatedCompanies = autoGenerateCompaniesFromContacts(loadContacts());
                          setCompanies(updatedCompanies);
                        }}
                      />
                    ))
                  )}
                </div>

                {filteredContacts.length > 0 && (
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
                  </p>
                )}
              </>
            )}
          </TabsContent>

          {/* Companies Tab Content — always vertical list, no grid */}
          <TabsContent value="companies" className="mt-0" data-testid="companies-list">
            {filteredCompanies.length === 0 && !searchQuery.trim() ? (
              /* Empty state — no companies */
              <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#4B68F5]/10 flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-6 h-6 text-[#4B68F5]" />
                </div>
                <div className="text-[15px] font-bold text-foreground">No companies yet</div>
                <p className="text-[13px] font-medium text-muted-foreground/70 mt-1 mb-5 max-w-xs mx-auto">
                  Companies are auto-created from scanned contacts, or add one manually.
                </p>
                <Button
                  onClick={() => setShowAddCompany(true)}
                  className="rounded-2xl bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] text-white font-bold border-0 h-12 px-6"
                  data-testid="button-add-company-empty"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Company
                </Button>
              </div>
            ) : filteredCompanies.length === 0 && searchQuery.trim() ? (
              /* Empty state — no search results */
              <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-8 text-center">
                <div className="text-[15px] font-bold text-foreground">No matching companies</div>
                <p className="text-[13px] font-medium text-muted-foreground/70 mt-1 max-w-xs mx-auto">
                  Try a shorter name or the domain.
                </p>
              </div>
            ) : (
              /* Company list — always vertical rows */
              <div className="space-y-2">
                {filteredCompanies.map((company) => (
                  <CompanyTile
                    key={company.id}
                    variant="list"
                    company={company}
                    contactCount={getContactCountForCompany(company.id, contacts)}
                    contactEmails={contacts
                      .filter((c) => c.companyId === company.id)
                      .map((c) => c.email)
                      .filter((e): e is string => !!e && e.trim().length > 0)}
                    onClick={() => onSelectCompany?.(company.id)}
                    onDelete={() => setDeleteCompanyConfirmId(company.id)}
                  />
                ))}

                {/* Inline Add Company row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-black/15 bg-transparent text-[14px] font-semibold text-muted-foreground hover:bg-white hover:border-[#4B68F5]/30 hover:text-[#4B68F5] transition-all active:opacity-70"
                  onClick={() => setShowAddCompany(true)}
                  data-testid="button-add-company"
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#4B68F5]/08 border border-dashed border-[#4B68F5]/25 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-[#4B68F5]" />
                  </div>
                  Add company
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
