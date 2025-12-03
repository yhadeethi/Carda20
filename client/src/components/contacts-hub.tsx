import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoredContact, loadContacts, deleteContact, getUniqueEventNames } from "@/lib/contactsStorage";
import { Search, Trash2, ArrowLeft, User, Building, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";

interface ContactsHubProps {
  onSelectContact: (contact: StoredContact) => void;
  onBackToScan: () => void;
}

export function ContactsHub({ onSelectContact, onBackToScan }: ContactsHubProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [contacts, setContacts] = useState<StoredContact[]>(() => loadContacts());
  
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

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteContact(id);
    setContacts(loadContacts());
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy");
    } catch {
      return "";
    }
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl font-semibold" data-testid="contacts-hub-title">Contacts</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToScan}
            className="gap-1 text-muted-foreground"
            data-testid="button-back-to-scan"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Scan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-contacts-search"
          />
        </div>

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
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => handleDelete(e, contact.id)}
                    data-testid={`button-delete-contact-${contact.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
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
      </CardContent>
    </Card>
  );
}
