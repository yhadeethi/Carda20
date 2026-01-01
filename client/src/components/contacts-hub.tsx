/**
 * Contacts Hub with People / Companies Split for Org Intelligence
 */

import { useState, useMemo, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

import { StoredContact, loadContacts, deleteContact, getUniqueEventNames } from "@/lib/contactsStorage";
import {
  Company,
  getCompanies,
  upsertCompany,
  createCompany,
  autoGenerateCompaniesFromContacts,
  getContactCountForCompany,
} from "@/lib/companiesStorage";

import { Search, Plus, Bell, Merge, Users } from "lucide-react";
import { CompanyGrid } from "@/components/companies/CompanyGrid";
import { UpcomingView } from "@/components/upcoming-view";
import { DuplicatesView } from "@/components/duplicates-view";

import { RelationshipContactCard } from "@/components/relationship/RelationshipContactCard";

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
  const reduceMotion = useReducedMotion();
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

  return (
    <>
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

      <Card className="glass">
        <CardHeader className="pb-2">
          
          <p className="text-sm text-muted-foreground">
            All your scanned contacts in one place. Search by name or company.
          </p>
        </CardHeader>


        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabMode)}>
            <TabsList className="relative flex h-14 w-full rounded-full bg-muted p-1 ring-1 ring-border/50">
              <motion.span
                className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm"
                animate={{ x: activeTab === "people" ? "0%" : "100%" }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 42, mass: 0.35 }
                }
              />

              <TabsTrigger
                value="people"
                className="relative flex-1 min-w-0 h-12 rounded-full px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                data-testid="tab-people"
              >
                <span className="relative z-10 flex w-full min-w-0 items-center justify-center">
                  <span className="min-w-0 truncate">People</span>
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="companies"
                className="relative flex-1 min-w-0 h-12 rounded-full px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                data-testid="tab-companies"
              >
                <span className="relative z-10 flex w-full min-w-0 items-center justify-center">
                  <span className="min-w-0 truncate">Companies</span>
                </span>
              </TabsTrigger>
            </TabsList>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "people" ? "Search by name or company..." : "Search companies..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-2xl h-11"
                data-testid="input-contacts-search"
              />
            </div>

            {/* People Tab */}
            <TabsContent value="people" className="mt-4 space-y-4">
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

                  <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1" data-testid="contacts-list">
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
                          onOpen={() => onSelectContact(contact)}
                          onDelete={() => setDeleteConfirmId(contact.id)}
                        />
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
              <div className="flex justify-end">
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

              <div className="max-h-[50vh] overflow-y-auto pr-1" data-testid="companies-list">
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