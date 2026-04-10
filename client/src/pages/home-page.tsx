import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { Contact } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { logDebriefEvent } from "@/lib/debriefEvents";
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
import { VoiceDebriefRecorder } from "@/components/voice-debrief-recorder";
import { VoiceDebriefReviewSheet } from "@/components/voice-debrief-review";
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
import { CreditCard, Moon, Sun, Home, Camera, Users, Calendar, LogOut, User, UserPlus, RefreshCw, Settings, AlertTriangle, Plus, Mic, CheckCircle2 } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { SiHubspot, SiSalesforce } from "react-icons/si";
import { StoredContact, loadContacts, deleteContact } from "@/lib/contactsStorage";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";
import { motion, AnimatePresence } from "framer-motion";

type TabMode = "home" | "contacts" | "events";
type ViewMode = "home" | "contacts" | "contact-detail" | "company-detail" | "events" | "event-detail";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const { failedCount, retry: retrySyncFailures } = useSyncStatus();

  useTimelineSetup();

  const prevFailedCountRef = useRef(0);
  useEffect(() => {
    if (failedCount > prevFailedCountRef.current && failedCount > 0) {
      toast({
        title: "Sync issue",
        description: `${failedCount} item(s) failed to sync. Tap the warning icon to retry.`,
        variant: "destructive",
      });
    }
    prevFailedCountRef.current = failedCount;
  }, [failedCount, toast]);

  const [activeTab, setActiveTab] = useState<TabMode>("home");
  const [viewMode, setViewMode] = useState<ViewMode>("home");

  const [scanShowingContact, setScanShowingContact] = useState(false);
  // Bottom nav now shows on contact-detail since the floating Save to Phone button was removed.
  const showBottomNav = viewMode !== "event-detail" && !scanShowingContact;
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [contactInitialAction, setContactInitialAction] = useState<"followup" | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyDetailTab, setCompanyDetailTab] = useState<'contacts' | 'orgmap' | 'brief'>('orgmap');
  const [contactsHubTab, setContactsHubTab] = useState<'people' | 'companies'>('people');
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [currentEventName, setCurrentEventName] = useState<string | null>(null);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [contactsVersion, setContactsVersion] = useState(0);
  const [showCreateContactDrawer, setShowCreateContactDrawer] = useState(false);
  const [showHubSpotProfile, setShowHubSpotProfile] = useState(false);
  const [showSalesforceProfile, setShowSalesforceProfile] = useState(false);
  const [captureMenuOpen, setCaptureMenuOpen] = useState(false);
  const [captureSheetMode, setCaptureSheetMode] = useState<"scan" | "paste" | null>(null);
  const [debriefSheetOpen, setDebriefSheetOpen] = useState(false);
  const [debriefPhase, setDebriefPhase] = useState<"record" | "review" | "success">("record");
  const [debriefTranscript, setDebriefTranscript] = useState("");
  const [debriefSavedContactId, setDebriefSavedContactId] = useState<string | null>(null);
  const [debriefPreSelectedContactId, setDebriefPreSelectedContactId] = useState<string | null>(null);

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
    try {
      localStorage.setItem("carda_switch_to_email", email);
    } catch {}
    window.location.href = "/api/logout";
  };

  const handleAddAccount = () => {
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
    setCaptureMenuOpen(false);
    setCaptureSheetMode(null);
    setActiveTab(tab);
    if (tab === "home") setViewMode("home");
    else if (tab === "contacts") {
      setViewMode("contacts");
      setSelectedContact(null);
      setSelectedCompanyId(null);
    }
    else if (tab === "events") setViewMode("events");
    setContactInitialAction(null);
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

  const handleSelectCompany = (companyId: string, initialTab: 'contacts' | 'orgmap' | 'brief' = 'contacts') => {
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
    setViewMode("contacts");
    setActiveTab("contacts");
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

  const handleSelectUserEvent = (eventId: string) => {
    setCurrentEventId(eventId);
    setViewMode("event-detail");
    setActiveTab("events");
  };

  const handleBackToEvents = () => {
    setCurrentEventId(null);
    setViewMode("events");
    setActiveTab("events");
  };

  const handleScanAtUserEvent = (eventId: string) => {
    setCurrentEventId(eventId);
    setEventModeEnabled(true);
    setCaptureSheetMode("scan");
  };

  const handleContactSelectedFromEvent = (contact: Contact) => {
    const stored: StoredContact = {
      id: String(contact.id),
      createdAt: new Date().toISOString(),
      name: contact.fullName || "",
      company: contact.companyName || "",
      title: contact.jobTitle || "",
      email: contact.email || "",
      phone: contact.phone || "",
      website: contact.website || "",
      linkedinUrl: contact.linkedinUrl || "",
      address: "",
      eventName: null,
    };
    setSelectedContact(stored);
    setContactInitialAction(null);
    setViewMode("contact-detail");
  };

  const handleCaptureToggle = () => setCaptureMenuOpen(prev => !prev);

  const handleCaptureOption = (option: "scan" | "paste" | "debrief") => {
    setCaptureMenuOpen(false);
    if (option === "scan" || option === "paste") {
      setCaptureSheetMode(option);
    } else if (option === "debrief") {
      setDebriefPhase("record");
      setDebriefTranscript("");
      setDebriefSavedContactId(null);
      setDebriefPreSelectedContactId(null);
      setDebriefSheetOpen(true);
    }
  };

  const handleDebriefTranscriptReady = (transcript: string) => {
    setDebriefTranscript(transcript);
    setDebriefPhase("review");
  };

  const handleDebriefComplete = (contactId: string) => {
    logDebriefEvent(contactId);
    setDebriefSavedContactId(contactId);
    setDebriefPhase("success");
    refreshContacts();
  };

  const handleDebriefClose = () => {
    setDebriefSheetOpen(false);
    setDebriefPreSelectedContactId(null);
    if (debriefSavedContactId) {
      const contacts = loadContacts();
      const saved = contacts.find((c) => c.id === debriefSavedContactId);
      if (saved) {
        handleSelectContact(saved);
      }
    }
  };

  const handleDebriefCancel = () => {
    setDebriefSheetOpen(false);
    setDebriefPreSelectedContactId(null);
  };

  const handleStartDebriefForContact = useCallback((contactId: string) => {
    setDebriefPhase("record");
    setDebriefTranscript("");
    setDebriefSavedContactId(null);
    setDebriefPreSelectedContactId(contactId);
    setDebriefSheetOpen(true);
  }, []);

  const handleCaptureSheetClose = () => setCaptureSheetMode(null);

  // Called from CompanyDetail's sparse state CTA — opens scan sheet directly
  const handleScanForCompany = useCallback((_companyName: string) => {
    setShowCreateContactDrawer(true);
  }, []);

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
          {failedCount > 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                retrySyncFailures();
                toast({ title: "Retrying failed sync items", description: `${failedCount} item(s) queued for retry.` });
              }}
              className="relative text-destructive"
              data-testid="button-sync-retry"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1" data-testid="badge-sync-failures">
                {failedCount}
              </span>
            </Button>
          )}
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
                onStartScan={() => setCaptureSheetMode("scan")}
                onCreateContact={() => setShowCreateContactDrawer(true)}
                onViewPeople={handleViewPeople}
                onViewCompanies={handleViewCompanies}
                onSelectContact={handleSelectUnifiedContact}
                onSelectCompany={handleSelectCompany}
                onRefresh={refreshContacts}
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
                onStartDebrief={handleStartDebriefForContact}
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
                onScanForCompany={handleScanForCompany}
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

      {/* Bottom Navigation Bar — Liquid Glass */}
      {showBottomNav && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 pointer-events-none"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
          data-testid="nav-bottom"
        >
          {/* Left Pill: Scoreboard | Network */}
          <div className="pointer-events-auto relative inline-flex items-center h-[50px] rounded-full bg-white/[0.18] dark:bg-white/[0.06] backdrop-blur-[60px] saturate-[2] shadow-[0_0_0_0.5px_rgba(255,255,255,0.55),0_2px_20px_rgba(0,0,0,0.07),inset_0_0.5px_0_rgba(255,255,255,0.65)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.12),0_2px_20px_rgba(0,0,0,0.32),inset_0_0.5px_0_rgba(255,255,255,0.16)] p-1">
            {/* Sliding bubble indicator */}
            <motion.div
              className="absolute top-1 h-[42px] rounded-full bg-white/[0.38] dark:bg-white/[0.11] shadow-[0_0.5px_3px_rgba(0,0,0,0.07),inset_0_0.5px_0_rgba(255,255,255,0.72)] dark:shadow-[0_0.5px_3px_rgba(0,0,0,0.22),inset_0_0.5px_0_rgba(255,255,255,0.18)] pointer-events-none z-0"
              animate={{
                x: activeTab === "home" ? 0 : "100%",
              }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 30,
                mass: 0.8,
              }}
              style={{
                left: 4,
                width: "calc(50% - 4px)",
              }}
            />

            {/* Scoreboard tab */}
            <button
              onClick={() => handleTabChange("home")}
              className="relative z-[1] flex-1 flex flex-col items-center justify-center gap-[1px] h-[42px] min-w-[76px] px-4 rounded-full active:scale-[0.92] active:opacity-70 transition-transform duration-150"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              aria-label="Scoreboard"
              data-testid="nav-home"
            >
              <Home className={`w-[21px] h-[21px] transition-colors duration-250 ${
                activeTab === "home" ? "text-primary" : "text-foreground/[0.45]"
              }`} />
              <span className={`text-[10px] leading-tight transition-colors duration-250 ${
                activeTab === "home" ? "text-primary font-semibold" : "text-foreground/[0.45] font-medium"
              }`}>
                Scoreboard
              </span>
            </button>

            {/* Network tab */}
            <button
              onClick={() => handleTabChange("contacts")}
              className="relative z-[1] flex-1 flex flex-col items-center justify-center gap-[1px] h-[42px] min-w-[76px] px-4 rounded-full active:scale-[0.92] active:opacity-70 transition-transform duration-150"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              aria-label="Network"
              data-testid="nav-tab-contacts"
            >
              <Users className={`w-[21px] h-[21px] transition-colors duration-250 ${
                activeTab === "contacts" || viewMode === "company-detail"
                  ? "text-primary"
                  : "text-foreground/[0.45]"
              }`} />
              <span className={`text-[10px] leading-tight transition-colors duration-250 ${
                activeTab === "contacts" || viewMode === "company-detail"
                  ? "text-primary font-semibold"
                  : "text-foreground/[0.45] font-medium"
              }`}>
                Network
              </span>
            </button>
          </div>

          {/* Right Circle: Capture */}
          <button
            onClick={handleCaptureToggle}
            className={`pointer-events-auto h-[50px] w-[50px] rounded-full backdrop-blur-[60px] saturate-[2] transition-all duration-300 flex items-center justify-center active:scale-[0.9] active:opacity-70 ${
              captureMenuOpen
                ? "bg-white/[0.32] dark:bg-white/[0.10] shadow-[0_0_0_0.5px_rgba(255,255,255,0.55),0_2px_20px_rgba(0,0,0,0.07),inset_0_0.5px_0_rgba(255,255,255,0.65)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.12),0_2px_20px_rgba(0,0,0,0.32),inset_0_0.5px_0_rgba(255,255,255,0.16)]"
                : "bg-white/[0.18] dark:bg-white/[0.06] shadow-[0_0_0_0.5px_rgba(255,255,255,0.55),0_2px_20px_rgba(0,0,0,0.07),inset_0_0.5px_0_rgba(255,255,255,0.65)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.12),0_2px_20px_rgba(0,0,0,0.32),inset_0_0.5px_0_rgba(255,255,255,0.16)]"
            }`}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            aria-label="Capture"
            data-testid="nav-capture"
          >
            <Plus className={`w-[22px] h-[22px] transition-all duration-300 ${
              captureMenuOpen
                ? "rotate-45 text-foreground/[0.45]"
                : "text-primary"
            }`} />
          </button>
        </nav>
      )}

      {/* Capture Menu Overlay */}
      <AnimatePresence>
        {captureMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCaptureMenuOpen(false)}
            />
            <motion.div
              className="fixed bottom-20 right-4 z-[25] w-[220px]"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 dark:border-slate-700/50 overflow-hidden">
                <button
                  onClick={() => handleCaptureOption("scan")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-scan"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Scan Card</p>
                    <p className="text-[11px] text-muted-foreground">Photo of a business card</p>
                  </div>
                </button>

                <div className="border-t border-border/50" />

                <button
                  onClick={() => handleCaptureOption("paste")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-paste"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Paste Signature</p>
                    <p className="text-[11px] text-muted-foreground">Extract from email text</p>
                  </div>
                </button>

                <div className="border-t border-border/50" />

                <button
                  onClick={() => handleCaptureOption("debrief")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-debrief"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Voice Debrief</p>
                    <p className="text-[11px] text-muted-foreground">Record meeting notes</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Capture Bottom Sheet */}
      <AnimatePresence>
        {captureSheetMode && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCaptureSheetClose}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 max-h-[92vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <ScanTab
                onBackToContacts={handleCaptureSheetClose}
                onDeleteContact={handleDeleteContact}
                eventModeEnabled={eventModeEnabled}
                currentEventName={currentEventName}
                onEventModeChange={setEventModeEnabled}
                onEventNameChange={setCurrentEventName}
                onContactSaved={(contact) => {
                  handleCaptureSheetClose();
                  if (contact) handleSelectContact(contact);
                  refreshContacts();
                }}
                onContactUpdated={handleContactUpdated}
                onViewInOrgMap={(companyId) => {
                  handleCaptureSheetClose();
                  handleSelectCompany(companyId, 'orgmap');
                }}
                onShowingContactChange={() => {}}
                initialMode={captureSheetMode}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Voice Debrief Bottom Sheet */}
      <AnimatePresence>
        {debriefSheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={debriefPhase === "record" ? handleDebriefCancel : undefined}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 max-h-[92vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {debriefPhase === "record" && (
                <VoiceDebriefRecorder
                  onTranscriptReady={handleDebriefTranscriptReady}
                  onCancel={handleDebriefCancel}
                />
              )}
              {debriefPhase === "review" && (
                <VoiceDebriefReviewSheet
                  transcript={debriefTranscript}
                  onComplete={handleDebriefComplete}
                  onCancel={handleDebriefCancel}
                  preSelectedContactId={debriefPreSelectedContactId}
                />
              )}
              {debriefPhase === "success" && (
                <div className="px-5 pt-4 pb-8">
                  <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <h2 className="text-lg font-bold text-foreground">Debrief Saved</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Notes, tasks, and reminders have been added to the contact.
                      </p>
                    </div>
                    <button
                      onClick={handleDebriefClose}
                      className="mt-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-primary text-primary-foreground"
                      data-testid="button-view-contact-debrief"
                    >
                      View Contact
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
