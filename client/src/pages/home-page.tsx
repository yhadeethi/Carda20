import { useState, useCallback, useEffect, useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useScrollDirectionNav } from "@/hooks/use-scroll-direction-nav";
import { useAuth } from "@/hooks/useAuth";
import { useTimelineSetup } from "@/hooks/useTimelineSetup";
import { useToast } from "@/hooks/use-toast";
import { ScanTab } from "@/components/scan-tab";
import { RelationshipDetailView } from "@/components/relationship/RelationshipDetailView";
import { ContactsHub } from "@/components/contacts-hub";
import { EventsHub } from "@/components/events-hub";
import { EventsTab } from "@/components/events/EventsTab";
import { EventDetail } from "@/components/events/EventDetail";
import { CompanyDetail } from "@/components/company-detail";
import { MyQRModal } from "@/components/my-qr-modal";
import { HomeScoreboard } from "@/components/home/HomeScoreboard";
import { CreateContactDrawer } from "@/components/create-contact-drawer";
import { HubSpotProfile } from "@/components/hubspot/HubSpotProfile";
import { SalesforceProfile } from "@/components/salesforce/SalesforceProfile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, Moon, Sun, Home, Camera, Users, Calendar, LogOut, User, UserPlus, RefreshCw, Settings } from "lucide-react";
import { SiHubspot, SiSalesforce } from "react-icons/si";
import { StoredContact, loadContacts, deleteContact } from "@/lib/contactsStorage";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";
import { motion, AnimatePresence } from "framer-motion";

type TabMode = "home" | "scan" | "contacts" | "events";
type ViewMode = "home" | "scan" | "contacts" | "contact-detail" | "company-detail" | "events" | "event-detail";

interface RecentAccount {
  email: string;
  lastUsedAt: string;
}

const RECENT_ACCOUNTS_KEY = "carda_recent_accounts_v1";

function loadRecentAccounts(): RecentAccount[] {
  try {
    const stored = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentAccount(email: string): void {
  try {
    const accounts = loadRecentAccounts().filter(a => a.email !== email);
    accounts.unshift({ email, lastUsedAt: new Date().toISOString() });
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 5)));
  } catch {}
}

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const { isHidden, isCompact } = useScrollDirectionNav();
  const { user } = useAuth();
  const { toast } = useToast();

  // Setup timeline data sync and migration
  useTimelineSetup();

  const [activeTab, setActiveTab] = useState<TabMode>("home");
  const [viewMode, setViewMode] = useState<ViewMode>("home");

  const [scanShowingContact, setScanShowingContact] = useState(false);
  const showBottomNav = viewMode !== "contact-detail" && viewMode !== "event-detail" && !scanShowingContact;
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [contactInitialAction, setContactInitialAction] = useState<"followup" | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyDetailTab, setCompanyDetailTab] = useState<'contacts' | 'orgmap' | 'notes'>('orgmap');
  const [contactsHubTab, setContactsHubTab] = useState<'people' | 'companies'>('people');
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [currentEventName, setCurrentEventName] = useState<string | null>(null);
  const [currentEventId, setCurrentEventId] = useState<number | null>(null);
  const [contactsVersion, setContactsVersion] = useState(0);
  const [showCreateContactDrawer, setShowCreateContactDrawer] = useState(false);
  const [showHubSpotProfile, setShowHubSpotProfile] = useState(false);
  const [showSalesforceProfile, setShowSalesforceProfile] = useState(false);

  const refreshContacts = useCallback(() => {
    setContactsVersion((v) => v + 1);
  }, []);

  const recentAccounts = useMemo(() => loadRecentAccounts(), []);
  const otherAccounts = useMemo(() => {
    const currentEmail = user?.email;
    return recentAccounts.filter(a => a.email !== currentEmail);
  }, [recentAccounts, user]);

  useEffect(() => {
    const email = user?.email;
    if (email) {
      saveRecentAccount(email);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hubspotParam = params.get("hubspot");
    if (hubspotParam === "connected") {
      setShowHubSpotProfile(true);
      toast({ title: "HubSpot connected", description: "Your HubSpot account has been linked successfully." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (hubspotParam === "error") {
      toast({ title: "HubSpot connection failed", description: "There was a problem connecting your HubSpot account. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }

    const salesforceParam = params.get("salesforce");
    if (salesforceParam === "connected") {
      setShowSalesforceProfile(true);
      toast({ title: "Salesforce connected", description: "Your Salesforce account has been linked successfully." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (salesforceParam === "error") {
      toast({ title: "Salesforce connection failed", description: "There was a problem connecting your Salesforce account. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const handleSwitchAccount = (email: string) => {
    // Replit auth does not support true multi-session switching in-app.
    // We store the target email so the UI can show intent post-login.
    try {
      localStorage.setItem("carda_switch_to_email", email);
    } catch {}
    window.location.href = "/api/logout";
  };

  const handleAddAccount = () => {
    // Triggers sign-out so the user can sign in with another account.
    try {
      localStorage.setItem("carda_add_account", "1");
    } catch {}
    window.location.href = "/api/logout";
  };

  const handleLogoClick = () => {
    setActiveTab("home");
    setViewMode("home");
    setSelectedContact(null);
    setContactInitialAction(null);
    setSelectedCompanyId(null);
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    setViewMode(tab);
    setSelectedContact(null);
    setContactInitialAction(null);
    setSelectedCompanyId(null);
  };

  const handleViewPeople = () => {
    setContactsHubTab('people');
    setActiveTab('contacts');
    setViewMode('contacts');
    setSelectedContact(null);
    setContactInitialAction(null);
    setSelectedCompanyId(null);
  };

  const handleViewCompanies = () => {
    setContactsHubTab('companies');
    setActiveTab('contacts');
    setViewMode('contacts');
    setSelectedContact(null);
    setContactInitialAction(null);
    setSelectedCompanyId(null);
  };

  const handleSelectContact = (contact: StoredContact) => {
    setSelectedContact(contact);
    setContactInitialAction(null);
    setViewMode("contact-detail");
  };

  const handleSelectContactWithAction = (contact: StoredContact, action?: "followup") => {
    setSelectedContact(contact);
    setContactInitialAction(action || null);
    setViewMode("contact-detail");
  };

  const handleSelectUnifiedContact = useCallback((contact: UnifiedContact, action?: "followup") => {
    setSelectedContact(contact);
    setContactInitialAction(action || null);
    setViewMode("contact-detail");
  }, []);

  const handleBackToContacts = () => {
    setSelectedContact(null);
    setContactInitialAction(null);
    setSelectedCompanyId(null);
    setViewMode("contacts");
    setActiveTab("contacts");
  };

  const handleSelectCompany = (companyId: string, initialTab: 'contacts' | 'orgmap' | 'notes' = 'contacts') => {
    setSelectedCompanyId(companyId);
    setCompanyDetailTab(initialTab);
    setViewMode("company-detail");
    setActiveTab("contacts");
  };

  const handleBackToCompanies = () => {
    setSelectedCompanyId(null);
    setViewMode("contacts");
    setActiveTab("contacts");
  };

  const handleContactSelectedFromCompany = (contact: StoredContact) => {
    setSelectedContact(contact);
    setContactInitialAction(null);
    setViewMode("contact-detail");
  };

  const handleBackToScan = () => {
    setViewMode("scan");
    setActiveTab("scan");
    setSelectedContact(null);
    setContactInitialAction(null);
  };

  const handleDeleteContact = useCallback((id: string) => {
    deleteContact(id);
    refreshContacts();
    setSelectedContact(null);
    setContactInitialAction(null);
    setViewMode("contacts");
    setActiveTab("contacts");
  }, [refreshContacts]);

  const handleContactUpdated = useCallback((contactId: string) => {
    const freshContact = loadContacts().find(c => c.id === contactId);
    if (freshContact) {
      setSelectedContact(freshContact);
    }
    refreshContacts();
  }, [refreshContacts]);

  const handleSelectUserEvent = (eventId: number) => {
    setCurrentEventId(eventId);
    setViewMode("event-detail");
    setActiveTab("events");
  };

  const handleBackToEvents = () => {
    setCurrentEventId(null);
    setViewMode("events");
    setActiveTab("events");
  };

  const handleScanAtUserEvent = (eventId: number) => {
    setCurrentEventId(eventId);
    setEventModeEnabled(true);
    setActiveTab("scan");
    setViewMode("scan");
  };

  const handleContactSelectedFromEvent = (contact: StoredContact) => {
    setSelectedContact(contact);
    setContactInitialAction(null);
    setViewMode("contact-detail");
  };

  const tabs = [
    { id: "scan" as TabMode, label: "Scan", icon: Camera },
    { id: "contacts" as TabMode, label: "Relationships", icon: Users },
    { id: "events" as TabMode, label: "Events", icon: Calendar },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <button 
          className="flex items-center gap-2 hover-elevate rounded-lg px-2 py-1 -ml-2"
          onClick={handleLogoClick}
          data-testid="button-logo"
        >
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Carda</span>
        </button>
        <div className="flex items-center gap-1">
          <MyQRModal />
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl ?? undefined} alt="Profile" />
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium" data-testid="text-user-name">
                  {user?.firstName || user?.fullName || 'User'}
                </p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                    {user?.email}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              {otherAccounts.length > 0 && (
                <>
                  <div className="px-2 py-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Recent Accounts</p>
                  </div>
                  {otherAccounts.slice(0, 3).map((account) => (
                    <DropdownMenuItem
                      key={account.email}
                      onClick={() => handleSwitchAccount(account.email)}
                      className="flex items-center gap-2 cursor-pointer"
                      data-testid={`button-switch-account-${account.email}`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="truncate text-sm">{account.email}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleAddAccount} className="flex items-center gap-2 cursor-pointer" data-testid="button-add-account">
                <UserPlus className="w-4 h-4" />
                Add Account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowHubSpotProfile(true)} className="flex items-center gap-2 cursor-pointer" data-testid="button-hubspot-menu">
                <SiHubspot className="w-4 h-4 text-[#FF7A59]" />
                HubSpot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSalesforceProfile(true)} className="flex items-center gap-2 cursor-pointer" data-testid="button-salesforce-menu">
                <SiSalesforce className="w-4 h-4 text-[#00A1E0]" />
                Salesforce
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/logout" className="flex items-center gap-2 cursor-pointer" data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-[calc(96px+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {viewMode === "home" && (
            <motion.div
              key="home"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <HomeScoreboard
                refreshKey={contactsVersion}
                onStartScan={() => {
                  setActiveTab('scan');
                  setViewMode('scan');
                }}
                onCreateContact={() => setShowCreateContactDrawer(true)}
                onViewPeople={handleViewPeople}
                onViewCompanies={handleViewCompanies}
                onSelectContact={handleSelectUnifiedContact}
                onSelectCompany={handleSelectCompany}
                onRefresh={refreshContacts}
              />
            </motion.div>
          )}
          {viewMode === "scan" && (
            <motion.div
              key="scan"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <ScanTab
                eventModeEnabled={eventModeEnabled}
                currentEventName={currentEventName}
                onEventModeChange={setEventModeEnabled}
                onEventNameChange={setCurrentEventName}
                onContactSaved={refreshContacts}
                onViewInOrgMap={(companyId) => handleSelectCompany(companyId, 'orgmap')}
                onShowingContactChange={setScanShowingContact}
              />
            </motion.div>
          )}
          {viewMode === "contacts" && (
            <motion.div
              key="contacts"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="p-4 max-w-2xl mx-auto">
                <ContactsHub
                  onSelectContact={handleSelectContact}
                  onBackToScan={handleBackToScan}
                  refreshKey={contactsVersion}
                  onContactDeleted={refreshContacts}
                  onSelectCompany={handleSelectCompany}
                  initialTab={contactsHubTab}
                />
              </div>
            </motion.div>
          )}
          {viewMode === "contact-detail" && selectedContact && (
            <motion.div
              key="contact-detail"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <RelationshipDetailView
                contact={selectedContact}
                onBack={handleBackToContacts}
                onDelete={handleDeleteContact}
                onContactUpdated={handleContactUpdated}
                onViewInOrgMap={(companyId) => handleSelectCompany(companyId, "orgmap")}
                initialAction={contactInitialAction || undefined}
              />
            </motion.div>
          )}
          {viewMode === "company-detail" && selectedCompanyId && (
            <motion.div
              key="company-detail"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <CompanyDetail
                companyId={selectedCompanyId}
                onBack={handleBackToCompanies}
                onSelectContact={handleContactSelectedFromCompany}
                initialTab={companyDetailTab}
              />
            </motion.div>
          )}
          {viewMode === "events" && (
            <motion.div
              key="events"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <EventsTab
                onSelectEvent={handleSelectUserEvent}
                onContinueEvent={handleSelectUserEvent}
              />
            </motion.div>
          )}
          {viewMode === "event-detail" && currentEventId && (
            <motion.div
              key="event-detail"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <EventDetail
                eventId={currentEventId}
                onBack={handleBackToEvents}
                onScanAtEvent={handleScanAtUserEvent}
                onSelectContact={handleContactSelectedFromEvent}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar - iOS Photos inspired (Home circle + pill group) */}
      {showBottomNav && (
        <nav
          className={`fixed inset-x-0 bottom-0 z-30 flex justify-center transition-all duration-300 ease-out ${
            isHidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          data-testid="nav-bottom"
        >
          <div className="flex items-center gap-3">
            {/* Home (standalone circle) */}
            <button
              onClick={() => handleTabChange("home")}
              className={`h-12 w-12 rounded-full backdrop-blur-sm shadow-xl border transition-all duration-200 flex items-center justify-center ${
                activeTab === "home" ? "bg-white/95 dark:bg-slate-900/95 text-foreground" : "bg-white/80 dark:bg-slate-900/80 text-foreground/60 hover:text-foreground"
              }`}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              aria-label="Home"
              data-testid="nav-home"
            >
              <Home className="w-5 h-5" />
            </button>

            {/* Pill group */}
            <div
              className={`inline-flex items-center h-12 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xl border transition-all duration-300 ease-out ${
                isCompact ? "gap-4 px-4" : "gap-6 px-5"
              }`}
            >
              {tabs.map((tab) => {
                const isActive =
                  activeTab === tab.id || (viewMode === "company-detail" && tab.id === "contacts");
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex flex-col items-center justify-center transition-all duration-200 ${
                      isCompact ? "gap-0" : "gap-0.5"
                    } ${
                      isActive
                        ? "text-foreground"
                        : "text-foreground/50 hover:text-foreground/80"
                    }`}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    data-testid={`nav-tab-${tab.id}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span
                      className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${
                        isCompact ? "max-h-0 opacity-0 scale-y-0" : "max-h-4 opacity-100 scale-y-100"
                      } text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}
                      style={{ transformOrigin: "top" }}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Create Contact Drawer */}
      <CreateContactDrawer
        open={showCreateContactDrawer}
        onOpenChange={setShowCreateContactDrawer}
        onContactCreated={refreshContacts}
      />

      {/* HubSpot Integration */}
      <HubSpotProfile
        open={showHubSpotProfile}
        onOpenChange={setShowHubSpotProfile}
      />

      {/* Salesforce Integration */}
      <SalesforceProfile
        open={showSalesforceProfile}
        onOpenChange={setShowSalesforceProfile}
      />
    </div>
  );
}
