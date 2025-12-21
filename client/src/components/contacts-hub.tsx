/**
 * Contacts Hub with People / Companies Split for Org Intelligence
 */

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
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
import { Search, Trash2, User, Building, Building2, Calendar, Tag, Users, Plus, Bell, Merge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export function ContactsHub({ onSelectContact, onBackToScan, refreshKey, onContactDeleted, onSelectCompany }: ContactsHubProps) {
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
    
    // Auto-generate companies from contacts
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
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query)
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
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.domain?.toLowerCase().includes(query)
      );
    }
    
    // Sort by contact count (most contacts first), then by name
    result.sort((a, b) => {
      const countA = getContactCountForCompany(a.id, contacts);
      const countB = getContactCountForCompany(b.id, contacts);
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });
    
    return result;
  }, [companies, searchQuery, contacts]);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

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

  const contactToDelete = deleteConfirmId ? contacts.find(c => c.id === deleteConfirmId) : null;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy");
    } catch {
      return "";
    }
  };

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
                <Label htmlFor="company-name" className="text-sm font-medium">Company Name *</Label>
                <Input
                  id="company-name"
                  placeholder="Acme Corp"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="h-12"
                  data-testid="input-new-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-domain" className="text-sm font-medium">Domain</Label>
                <Input
                  id="company-domain"
                  placeholder="acme.com"
                  value={newCompanyDomain}
                  onChange={(e) => setNewCompanyDomain(e.target.value)}
                  className="h-12"
                  data-testid="input-new-company-domain"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="company-city" className="text-sm font-medium">City</Label>
                  <Input
                    id="company-city"
                    placeholder="Sydney"
                    value={newCompanyCity}
                    onChange={(e) => setNewCompanyCity(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-state" className="text-sm font-medium">State</Label>
                  <Input
                    id="company-state"
                    placeholder="NSW"
                    value={newCompanyState}
                    onChange={(e) => setNewCompanyState(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-country" className="text-sm font-medium">Country</Label>
                <Input
                  id="company-country"
                  placeholder="Australia"
                  value={newCompanyCountry}
                  onChange={(e) => setNewCompanyCountry(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="company-notes"
                  placeholder="Notes about this company..."
                  value={newCompanyNotes}
                  onChange={(e) => setNewCompanyNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          </ScrollArea>
          <DrawerFooter className="border-t pt-4 flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="outline" onClick={resetAddCompanyForm} className="flex-1">
                Cancel
              </Button>
            </DrawerClose>
            <Button 
              onClick={handleAddCompany} 
              disabled={!newCompanyName.trim()} 
              className="flex-1"
              data-testid="button-save-company"
            >
              Save Company
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold" data-testid="contacts-hub-title">Network</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Network / Companies Segmented Control */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabMode)}>
            <TabsList className="w-full grid grid-cols-2 h-12">
              <TabsTrigger value="people" className="gap-2 text-base font-medium" data-testid="tab-people">
                <User className="w-5 h-5" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="companies" className="gap-2 text-base font-medium" data-testid="tab-companies">
                <Building2 className="w-5 h-5" />
                Companies
              </TabsTrigger>
            </TabsList>

            {/* Shared Search Bar */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "people" ? "Search by name or company..." : "Search companies..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-contacts-search"
              />
            </div>

            {/* People Tab */}
            <TabsContent value="people" className="mt-4 space-y-4">
              {/* Sub-view filter badges */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Badge
                  variant={peopleSubView === "all" ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setPeopleSubView("all")}
                  data-testid="filter-all"
                >
                  <Users className="w-3 h-3 mr-1" />
                  All
                </Badge>
                <Badge
                  variant={peopleSubView === "upcoming" ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setPeopleSubView("upcoming")}
                  data-testid="filter-upcoming"
                >
                  <Bell className="w-3 h-3 mr-1" />
                  Upcoming
                </Badge>
                <Badge
                  variant={peopleSubView === "duplicates" ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setPeopleSubView("duplicates")}
                  data-testid="filter-duplicates"
                >
                  <Merge className="w-3 h-3 mr-1" />
                  Duplicates
                </Badge>
              </div>

              {/* Sub-views */}
              {peopleSubView === "upcoming" && (
                <div className="min-h-[300px]">
                  <UpcomingView onSelectContact={(id) => {
                    const contact = contacts.find(c => c.id === id);
                    if (contact) onSelectContact(contact);
                  }} />
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
                      <SelectTrigger data-testid="select-event-filter">
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

                  <div className="max-h-[400px] overflow-y-auto space-y-2" data-testid="contacts-list">
                    {filteredContacts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="contacts-empty">
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
                          className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer group relative"
                          onClick={() => onSelectContact(contact)}
                          data-testid={`contact-row-${contact.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="font-medium truncate" data-testid={`contact-name-${contact.id}`}>
                                  {contact.name || contact.email || "Unknown"}
                                </span>
                              </div>
                              
                              {(contact.company || contact.title) && (
                                <div className="flex items-center gap-2 mt-1 min-w-0">
                                  <Building className="w-4 h-4 text-muted-foreground shrink-0 invisible" />
                                  <span className="text-sm text-muted-foreground truncate" data-testid={`contact-details-${contact.id}`}>
                                    {[contact.company, contact.title].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>Scanned on {formatDate(contact.createdAt)}</span>
                                </div>
                                
                                {contact.eventName && (
                                  <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full" data-testid={`contact-event-${contact.id}`}>
                                    <Tag className="w-3 h-3" />
                                    {contact.eventName}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDeleteClick(e, contact.id)}
                              data-testid={`button-delete-contact-${contact.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCompany(true)}
                  className="gap-1"
                  data-testid="button-add-company"
                >
                  <Plus className="w-3 h-3" />
                  Add Company
                </Button>
              </div>

              <div className="max-h-[450px] overflow-y-auto" data-testid="companies-list">
                <CompanyGrid
                  companies={filteredCompanies}
                  getContactCount={(companyId) => getContactCountForCompany(companyId, contacts)}
                  getContactEmails={(companyId) => {
                    const companyContacts = contacts.filter(c => c.companyId === companyId);
                    return companyContacts.map(c => c.email).filter(e => e && e.trim().length > 0);
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
