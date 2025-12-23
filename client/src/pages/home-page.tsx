import { useState, useCallback, useEffect, useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useScrollDirectionNav } from "@/hooks/use-scroll-direction-nav";
import { useAuth } from "@/hooks/useAuth";
import { ScanTab } from "@/components/scan-tab";
import { ContactsHub } from "@/components/contacts-hub";
import { EventsHub } from "@/components/events-hub";
import { CompanyDetail } from "@/components/company-detail";
import { MyQRModal } from "@/components/my-qr-modal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, Moon, Sun, Camera, Users, Calendar, LogOut, User, UserPlus, RefreshCw } from "lucide-react";
import { StoredContact, loadContacts, deleteContact } from "@/lib/contactsStorage";
import { motion, AnimatePresence } from "framer-motion";

type TabMode = "scan" | "contacts" | "events";
type ViewMode = "scan" | "contacts" | "contact-detail" | "company-detail" | "events";

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
  const [activeTab, setActiveTab] = useState<TabMode>("scan");
  const [viewMode, setViewMode] = useState<ViewMode>("scan");
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyDetailTab, setCompanyDetailTab] = useState<'contacts' | 'orgmap' | 'notes'>('orgmap');
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [currentEventName, setCurrentEventName] = useState<string | null>(null);
  const [contactsVersion, setContactsVersion] = useState(0);

  const refreshContacts = useCallback(() => {
    setContactsVersion((v) => v + 1);
  }, []);

  const recentAccounts = useMemo(() => loadRecentAccounts(), []);
  const otherAccounts = useMemo(() => {
    const currentEmail = (user as any)?.email;
    return recentAccounts.filter(a => a.email !== currentEmail);
  }, [recentAccounts, user]);

  useEffect(() => {
    const email = (user as any)?.email;
    if (email) {
      saveRecentAccount(email);
    }
  }, [user]);

  const handleSwitchAccount = () => {
    window.location.href = "/api/logout";
  };

  const handleAddAccount = () => {
    window.location.href = "/api/logout";
  };

  const handleLogoClick = () => {
    setActiveTab("scan");
    setViewMode("scan");
    setSelectedContact(null);
    setSelectedCompanyId(null);
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    setViewMode(tab);
    setSelectedContact(null);
    setSelectedCompanyId(null);
  };

  const handleSelectContact = (contact: StoredContact) => {
    setSelectedContact(contact);
    setViewMode("contact-detail");
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
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
    setViewMode("contact-detail");
  };

  const handleBackToScan = () => {
    setViewMode("scan");
    setActiveTab("scan");
    setSelectedContact(null);
  };

  const handleDeleteContact = useCallback((id: string) => {
    deleteContact(id);
    refreshContacts();
    setSelectedContact(null);
    setViewMode("contacts");
    setActiveTab("contacts");
  }, [refreshContacts]);

  const tabs = [
    { id: "scan" as TabMode, label: "Scan", icon: Camera },
    { id: "contacts" as TabMode, label: "Network", icon: Users },
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
                  <AvatarImage src={(user as any)?.profileImageUrl} alt="Profile" />
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium" data-testid="text-user-name">
                  {(user as any)?.firstName || (user as any)?.fullName || 'User'}
                </p>
                {(user as any)?.email && (
                  <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                    {(user as any)?.email}
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
                      onClick={handleSwitchAccount}
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
              <ScanTab
                viewingContact={selectedContact}
                onBackToContacts={handleBackToContacts}
                onDeleteContact={handleDeleteContact}
                eventModeEnabled={eventModeEnabled}
                currentEventName={currentEventName}
                onEventModeChange={setEventModeEnabled}
                onEventNameChange={setCurrentEventName}
                onContactSaved={refreshContacts}
                onViewInOrgMap={(companyId) => handleSelectCompany(companyId, 'orgmap')}
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
              <EventsHub />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar - iOS Photos style morph on scroll */}
      <nav 
        className={`fixed inset-x-0 bottom-0 z-30 flex justify-center transition-all duration-300 ease-out ${
          isHidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div 
          className={`inline-flex items-center rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xl transition-all duration-300 ease-out ${
            isCompact 
              ? "gap-4 px-4 py-2" 
              : "gap-6 px-5 py-3"
          }`}
          data-testid="nav-bottom"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id || ((viewMode === "contact-detail" || viewMode === "company-detail") && tab.id === "contacts");
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
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                data-testid={`nav-tab-${tab.id}`}
              >
                <Icon className={`transition-all duration-200 ${isCompact ? "w-5 h-5" : "w-5 h-5"}`} />
                <span 
                  className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${
                    isCompact 
                      ? "max-h-0 opacity-0 scale-y-0" 
                      : "max-h-4 opacity-100 scale-y-100"
                  } text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}
                  style={{ transformOrigin: 'top' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
