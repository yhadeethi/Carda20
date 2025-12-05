import { useState, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";
import { ScanTab } from "@/components/scan-tab";
import { ContactsHub } from "@/components/contacts-hub";
import { MyQRModal } from "@/components/my-qr-modal";
import { Button } from "@/components/ui/button";
import { CreditCard, Moon, Sun, Camera, Users, Calendar } from "lucide-react";
import { StoredContact, loadContacts, deleteContact } from "@/lib/contactsStorage";
import { motion, AnimatePresence } from "framer-motion";

type TabMode = "scan" | "contacts" | "events";
type ViewMode = "scan" | "contacts" | "contact-detail" | "events";

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabMode>("scan");
  const [viewMode, setViewMode] = useState<ViewMode>("scan");
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [currentEventName, setCurrentEventName] = useState<string | null>(null);
  const [contactsVersion, setContactsVersion] = useState(0);

  const refreshContacts = useCallback(() => {
    setContactsVersion((v) => v + 1);
  }, []);

  const handleLogoClick = () => {
    setActiveTab("scan");
    setViewMode("scan");
    setSelectedContact(null);
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    setViewMode(tab);
    setSelectedContact(null);
  };

  const handleSelectContact = (contact: StoredContact) => {
    setSelectedContact(contact);
    setViewMode("contact-detail");
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
    setViewMode("contacts");
    setActiveTab("contacts");
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
    { id: "contacts" as TabMode, label: "Contacts", icon: Users },
    { id: "events" as TabMode, label: "Events", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
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
        </div>
      </header>

      <main className="flex-1 overflow-hidden pb-20">
        <AnimatePresence mode="wait">
          {viewMode === "scan" && (
            <motion.div
              key="scan"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full overflow-y-auto"
            >
              <ScanTab
                eventModeEnabled={eventModeEnabled}
                currentEventName={currentEventName}
                onEventModeChange={setEventModeEnabled}
                onEventNameChange={setCurrentEventName}
                onContactSaved={refreshContacts}
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
              className="h-full overflow-y-auto"
            >
              <div className="p-4 max-w-2xl mx-auto">
                <ContactsHub
                  onSelectContact={handleSelectContact}
                  onBackToScan={handleBackToScan}
                  refreshKey={contactsVersion}
                  onContactDeleted={refreshContacts}
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
              className="h-full overflow-y-auto"
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
              className="h-full overflow-y-auto"
            >
              <div className="p-4 max-w-2xl mx-auto">
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Calendar className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-3">Events Hub</h2>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                    Coming soon: Discover renewable energy, mining, and construction industry events across Australia. 
                    Tag contacts at conferences and trade shows for easy follow-up.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar - Liquid Glass Style */}
      <nav 
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-2 rounded-3xl px-2 py-2 backdrop-blur-xl bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10 shadow-lg"
        data-testid="nav-bottom"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id || (viewMode === "contact-detail" && tab.id === "contacts");
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-2xl transition-all duration-200 ${
                isActive
                  ? "bg-white/25 dark:bg-white/15 text-foreground"
                  : "text-foreground/60 hover:text-foreground/90 hover:bg-white/10"
              }`}
              data-testid={`nav-tab-${tab.id}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
