import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Play,
  Upload,
  MapPin,
  Calendar,
  Clock,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Camera,
  Plus,
  ChevronRight,
  ChevronLeft,
  StickyNote,
  Tag,
  X,
  Loader2,
  Sparkles,
  FileText,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listUserEvents,
  getUserEvent,
  createEventWithLocation,
  updateUserEvent,
  deleteUserEvent,
  finalizeDraftEvent,
  getEventContacts,
  type UserEvent,
  type UserEventContact,
} from "@/lib/userEventsApi";
import {
  getActiveEventId,
  setActiveEventId,
  getCapturesForEvent,
} from "@/lib/eventCaptureQueue";
import { loadContacts, type StoredContact } from "@/lib/contactsStorage";
import { parseIcsFile, type IcsEvent } from "@/lib/calendar/ics";

// Types
type ViewMode = "list" | "detail" | "create" | "edit";

interface EventsHubProps {
  onScanAtEvent?: (eventName: string, eventId?: number) => void;
  onSelectContact?: (contact: StoredContact) => void;
}

// Helper functions
function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatEventDate(dateStr);
}

// Event Card Component
function EventCard({
  event,
  contactCount,
  onOpen,
  onScan,
  onEdit,
  onDelete,
  isActive,
}: {
  event: UserEvent;
  contactCount: number;
  onOpen: () => void;
  onScan: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isActive: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <button
        onClick={onOpen}
        className={`w-full text-left rounded-2xl bg-card/80 backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:bg-card/90 active:scale-[0.98] ${
          isActive ? "border-primary/50 ring-2 ring-primary/20" : "border-border/50"
        }`}
        style={{
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                {event.isDraft === 1 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                    Draft
                  </Badge>
                )}
                {isActive && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-green-500">
                    Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{getRelativeDate(event.startAt)}</span>
                {event.locationLabel && (
                  <>
                    <span className="opacity-50">•</span>
                    <MapPin className="w-3 h-3" />
                    <span>{event.locationLabel}</span>
                  </>
                )}
              </div>
              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {event.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 rounded-full"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {event.tags.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{event.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {contactCount > 0 && (
                <Badge variant="secondary" className="h-8 px-2.5 gap-1.5 rounded-full">
                  <Users className="w-3 h-3" />
                  {contactCount}
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onScan(); }}>
                    <Camera className="w-4 h-4 mr-2" />
                    Scan at event
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            </div>
          </div>
        </div>
      </button>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{event.title}" and remove all contact associations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Start Event Modal
function StartEventModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: UserEvent) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const today = new Date();
  const defaultTitle = `Event — ${today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleCreate = async () => {
    const eventTitle = title.trim() || defaultTitle;
    setIsCreating(true);

    try {
      const event = await createEventWithLocation(eventTitle, {
        notes: notes.trim() || undefined,
        tags,
        requestLocation: true,
      });

      setActiveEventId(event.id);
      toast({ title: "Event started", description: `"${event.title}" is now active` });
      onCreated(event);
      onOpenChange(false);

      // Reset form
      setTitle("");
      setNotes("");
      setTags([]);
    } catch (e) {
      toast({
        title: "Failed to create event",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 flex flex-col">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle>Start Event</DialogTitle>
          <DialogDescription>
            Create a new event to capture contacts at.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder={defaultTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder="Add notes about this event..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Tags</label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 p-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Event
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Import ICS Modal
function ImportIcsModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (event: UserEvent) => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedEvents, setParsedEvents] = useState<IcsEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<IcsEvent | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    try {
      const events = await parseIcsFile(f);
      setParsedEvents(events);
      if (events.length === 1) {
        setSelectedEvent(events[0]);
      }
    } catch (err) {
      toast({
        title: "Failed to parse calendar file",
        description: err instanceof Error ? err.message : "Invalid .ics file",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedEvent) return;
    setIsImporting(true);

    try {
      const event = await createEventWithLocation(selectedEvent.title, {
        notes: selectedEvent.description,
        tags: [],
        requestLocation: false,
      });

      // Update with ICS data
      if (selectedEvent.startDate || selectedEvent.location) {
        await updateUserEvent(event.id, {
          startAt: selectedEvent.startDate,
          endAt: selectedEvent.endDate || undefined,
          locationLabel: selectedEvent.location,
        });
      }

      toast({ title: "Event imported", description: `"${event.title}" created from calendar` });
      onImported(event);
      onOpenChange(false);

      // Reset
      setFile(null);
      setParsedEvents([]);
      setSelectedEvent(null);
    } catch (e) {
      toast({
        title: "Failed to import event",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 flex flex-col">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle>Import from Calendar</DialogTitle>
          <DialogDescription>
            Import an event from a .ics calendar file.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Calendar File (.ics)</label>
            <Input
              type="file"
              accept=".ics,.ical"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>

          {parsedEvents.length > 0 && (
            <div>
              <label className="text-sm font-medium">Select Event</label>
              <div className="mt-1 space-y-2 max-h-48 overflow-y-auto">
                {parsedEvents.map((evt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEvent(evt)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedEvent === evt
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{evt.title}</div>
                    {evt.startDate && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatEventDate(evt.startDate)}
                        {evt.location && ` • ${evt.location}`}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 p-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!selectedEvent || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Event Detail View
function EventDetailView({
  event,
  contacts,
  allContacts,
  onBack,
  onScan,
  onEdit,
  onSelectContact,
}: {
  event: UserEvent;
  contacts: UserEventContact[];
  allContacts: StoredContact[];
  onBack: () => void;
  onScan: () => void;
  onEdit: () => void;
  onSelectContact?: (contact: StoredContact) => void;
}) {
  // Map contact IDs to actual contact data
  const eventContacts = useMemo(() => {
    return contacts
      .map((ec) => {
        if (ec.contactIdV1) {
          return allContacts.find((c) => c.id === ec.contactIdV1);
        }
        return null;
      })
      .filter(Boolean) as StoredContact[];
  }, [contacts, allContacts]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{event.title}</h2>
          <p className="text-sm text-muted-foreground">
            {formatEventDate(event.startAt)}
            {event.endAt && ` — ${formatEventDate(event.endAt)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="rounded-full">
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
      </div>

      {/* Quick Info */}
      <div
        className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 space-y-3"
        style={{
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        {event.locationLabel && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{event.locationLabel}</span>
          </div>
        )}
        {event.tags && event.tags.length > 0 && (
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {event.notes && (
          <div className="flex items-start gap-2 text-sm">
            <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground">{event.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={onScan} className="flex-1 rounded-full h-11">
          <Camera className="w-4 h-4 mr-2" />
          Capture Cards
        </Button>
      </div>

      {/* Contacts */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
          Contacts ({eventContacts.length})
        </h3>
        {eventContacts.length > 0 ? (
          <div
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 divide-y divide-border/50 overflow-hidden"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            {eventContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact?.(contact)}
                className="w-full p-4 text-left transition-all duration-200 hover:bg-muted/30 active:bg-muted/50 flex items-center justify-between group"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{contact.name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {contact.company || "No company"}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70" />
              </button>
            ))}
          </div>
        ) : (
          <div
            className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4 text-center"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No contacts captured yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Tap "Capture Cards" to start scanning
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Events Hub Component
export function EventsHub({ onScanAtEvent, onSelectContact }: EventsHubProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const activeEventId = getActiveEventId();
  const allContacts = useMemo(() => loadContacts(), []);

  // Fetch events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/user-events"],
    queryFn: () => listUserEvents(50),
    refetchOnWindowFocus: true,
  });

  // Fetch selected event details
  const { data: selectedEvent } = useQuery({
    queryKey: ["/api/user-events", selectedEventId],
    queryFn: () => (selectedEventId ? getUserEvent(selectedEventId) : null),
    enabled: !!selectedEventId,
  });

  // Fetch event contacts
  const { data: eventContacts = [] } = useQuery({
    queryKey: ["/api/user-events", selectedEventId, "contacts"],
    queryFn: () => (selectedEventId ? getEventContacts(selectedEventId) : []),
    enabled: !!selectedEventId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteUserEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
      toast({ title: "Event deleted" });
      if (selectedEventId === activeEventId) {
        setActiveEventId(null);
      }
      setSelectedEventId(null);
      setViewMode("list");
    },
    onError: (e) => {
      toast({
        title: "Failed to delete event",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Get contact count for an event from localStorage (for display)
  const getContactCountForEvent = useCallback((eventId: number) => {
    // Check captures in queue
    const captures = getCapturesForEvent(eventId);
    return captures.filter((c) => c.status === "synced" || c.status === "saved").length;
  }, []);

  // Handlers
  const handleOpenEvent = (eventId: number) => {
    setSelectedEventId(eventId);
    setViewMode("detail");
  };

  const handleScanAtEvent = (event: UserEvent) => {
    setActiveEventId(event.id);
    onScanAtEvent?.(event.title, event.id);
  };

  const handleEventCreated = (event: UserEvent) => {
    queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
    setSelectedEventId(event.id);
    setViewMode("detail");
  };

  const handleEditEvent = (event: UserEvent) => {
    setSelectedEventId(event.id);
    setShowEditModal(true);
  };

  const handleDeleteEvent = (eventId: number) => {
    deleteMutation.mutate(eventId);
  };

  const handleBack = () => {
    setSelectedEventId(null);
    setViewMode("list");
  };

  // Draft event (active)
  const draftEvent = events.find((e) => e.isDraft === 1);
  const activeEvent = activeEventId ? events.find((e) => e.id === activeEventId) : null;
  const continueEvent = activeEvent || draftEvent;

  // Non-draft events sorted by date
  const recentEvents = events.filter((e) => e.isDraft !== 1);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
      {/* Detail View */}
      {viewMode === "detail" && selectedEvent && (
        <EventDetailView
          event={selectedEvent}
          contacts={eventContacts}
          allContacts={allContacts}
          onBack={handleBack}
          onScan={() => handleScanAtEvent(selectedEvent)}
          onEdit={() => handleEditEvent(selectedEvent)}
          onSelectContact={onSelectContact}
        />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Header */}
          <div className="pt-2">
            <h1 className="text-2xl font-bold tracking-tight">Events</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Capture contacts at events, conferences, and meetings.
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowStartModal(true)}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Event
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="h-12 px-4 rounded-2xl"
            >
              <Upload className="w-5 h-5" />
            </Button>
          </div>

          {/* Continue Event Card */}
          {continueEvent && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">
                {continueEvent.isDraft === 1 ? "Draft Event" : "Active Event"}
              </h2>
              <button
                onClick={() => handleOpenEvent(continueEvent.id)}
                className="w-full rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4 text-left transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <h3 className="font-semibold text-sm truncate">{continueEvent.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {continueEvent.isDraft === 1
                        ? "Tap to finalize and add details"
                        : "Tap to continue capturing contacts"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScanAtEvent(continueEvent);
                    }}
                  >
                    <Camera className="w-4 h-4 mr-1" />
                    Scan
                  </Button>
                </div>
              </button>
            </section>
          )}

          {/* Recent Events */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">
              Recent Events
            </h2>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : recentEvents.length > 0 ? (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    contactCount={getContactCountForEvent(event.id)}
                    onOpen={() => handleOpenEvent(event.id)}
                    onScan={() => handleScanAtEvent(event)}
                    onEdit={() => handleEditEvent(event)}
                    onDelete={() => handleDeleteEvent(event.id)}
                    isActive={event.id === activeEventId}
                  />
                ))}
              </div>
            ) : (
              <div
                className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-6 text-center"
                style={{
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                }}
              >
                <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No events yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Start your first event to begin capturing contacts
                </p>
              </div>
            )}
          </section>

          {/* Footer hint */}
          <p className="text-xs text-center text-muted-foreground/60 pt-4">
            Contacts captured at events appear in Relationships.
          </p>
        </>
      )}

      {/* Modals */}
      <StartEventModal
        open={showStartModal}
        onOpenChange={setShowStartModal}
        onCreated={handleEventCreated}
      />
      <ImportIcsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImported={handleEventCreated}
      />
      {showEditModal && selectedEvent && (
        <EditEventModal
          event={selectedEvent}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}

// Edit Event Modal
function EditEventModal({
  event,
  open,
  onOpenChange,
  onSaved,
}: {
  event: UserEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(event.title);
  const [notes, setNotes] = useState(event.notes || "");
  const [locationLabel, setLocationLabel] = useState(event.locationLabel || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(event.tags || []);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (event.isDraft === 1) {
        await finalizeDraftEvent(event.id, {
          title: title.trim(),
          notes: notes.trim() || undefined,
          tags,
          locationLabel: locationLabel.trim() || undefined,
        });
      } else {
        await updateUserEvent(event.id, {
          title: title.trim(),
          notes: notes.trim() || undefined,
          tags,
          locationLabel: locationLabel.trim() || undefined,
        });
      }

      toast({ title: "Event saved" });
      onSaved();
    } catch (e) {
      toast({
        title: "Failed to save event",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 flex flex-col">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle>{event.isDraft === 1 ? "Finalize Event" : "Edit Event"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Location</label>
            <Input
              placeholder="e.g., Sydney Convention Centre"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Tags</label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 p-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {event.isDraft === 1 ? "Finalize" : "Save"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
