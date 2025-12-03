import { useState, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";
import { ScanTab } from "@/components/scan-tab";
import { ContactsHub } from "@/components/contacts-hub";
import { MyQRModal } from "@/components/my-qr-modal";
import { Button } from "@/components/ui/button";
import { CreditCard, Moon, Sun, Users } from "lucide-react";
import { StoredContact, loadContacts } from "@/lib/contactsStorage";

type ViewMode = "scan" | "contacts" | "contact-detail";

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>("scan");
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [currentEventName, setCurrentEventName] = useState<string | null>(null);
  const [contactsVersion, setContactsVersion] = useState(0);

  const refreshContacts = useCallback(() => {
    setContactsVersion((v) => v + 1);
  }, []);

  const handleLogoClick = () => {
    setViewMode("scan");
    setSelectedContact(null);
  };

  const handleContactsClick = () => {
    setViewMode("contacts");
    setSelectedContact(null);
  };

  const handleSelectContact = (contact: StoredContact) => {
    setSelectedContact(contact);
    setViewMode("contact-detail");
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
    setViewMode("contacts");
  };

  const handleBackToScan = () => {
    setViewMode("scan");
    setSelectedContact(null);
  };

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
          <Button
            size="icon"
            variant={viewMode === "contacts" || viewMode === "contact-detail" ? "secondary" : "ghost"}
            onClick={handleContactsClick}
            data-testid="button-contacts"
          >
            <Users className="w-4 h-4" />
          </Button>
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

      <main className="flex-1 overflow-y-auto">
        {viewMode === "scan" && (
          <ScanTab
            eventModeEnabled={eventModeEnabled}
            currentEventName={currentEventName}
            onEventModeChange={setEventModeEnabled}
            onEventNameChange={setCurrentEventName}
            onContactSaved={refreshContacts}
          />
        )}
        {viewMode === "contacts" && (
          <div className="p-4 max-w-2xl mx-auto">
            <ContactsHub
              onSelectContact={handleSelectContact}
              onBackToScan={handleBackToScan}
              refreshKey={contactsVersion}
            />
          </div>
        )}
        {viewMode === "contact-detail" && selectedContact && (
          <ScanTab
            viewingContact={selectedContact}
            onBackToContacts={handleBackToContacts}
            eventModeEnabled={eventModeEnabled}
            currentEventName={currentEventName}
            onEventModeChange={setEventModeEnabled}
            onEventNameChange={setCurrentEventName}
            onContactSaved={refreshContacts}
          />
        )}
      </main>
    </div>
  );
}
