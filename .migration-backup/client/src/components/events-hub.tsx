import { useMemo, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { WheelPickerPopover } from "@/components/ui/wheel-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sun,
  Pickaxe,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Pin,
  PinOff,
  Check,
  X,
  HelpCircle,
  ChevronDown,
  StickyNote,
  Sparkles,
  Shield,
  Bell,
  BellOff,
  Camera,
  Users,
  CalendarPlus,
  Filter,
  RotateCcw,
} from "lucide-react";
import {
  EventItem,
  EventIndustryId,
  INDUSTRIES,
  getEventsByIndustry,
  sortEventsByDate,
} from "@/lib/eventsData";
import {
  setEventPinned,
  setEventAttending,
  setEventNote,
  setEventReminder,
  EventUserPrefs,
  getAllEventPrefs,
} from "@/lib/eventsStorage";
import { loadContacts } from "@/lib/contactsStorage";
import { buildIcsEvent, downloadIcsFile } from "@/lib/calendar/ics";

const industryIcons: Record<EventIndustryId, typeof Sun> = {
  renewable: Sun,
  mining: Pickaxe,
  construction: Building2,
};

interface EventCardProps {
  event: EventItem;
  prefs: EventUserPrefs;
  onPrefsChange: () => void;
  contactCount: number;
  onScanHere?: (eventName: string) => void;
  density?: "normal" | "compact";
}

function EventCard({
  event,
  prefs,
  onPrefsChange,
  contactCount,
  onScanHere,
  density = "normal",
}: EventCardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(prefs.note);

  const handleToggleReminder = () => {
    setEventReminder(event.id, !prefs.reminderSet);
    onPrefsChange();
  };

  const handleScanHere = () => {
    onScanHere?.(event.name);
  };

  const handleAddToCalendar = () => {
    if (!event.startDateIso) return;

    const startIso = `${event.startDateIso}T09:00:00`;
    const endIso = `${(event.endDateIso || event.startDateIso)}T17:00:00`;

    const location = [event.venue, `${event.city}, ${event.state}`]
      .filter(Boolean)
      .join(" · ");

    const descriptionLines = [
      event.description,
      "",
      `Industry: ${
        INDUSTRIES.find((i) => i.id === event.industryId)?.label || event.industryId
      }`,
      event.websiteUrl ? `Website: ${event.websiteUrl}` : "",
      "",
      "Created with Carda",
    ].filter(Boolean);

    const ics = buildIcsEvent({
      title: event.name,
      description: descriptionLines.join("\n"),
      location: location || undefined,
      startIso: new Date(startIso).toISOString(),
      endIso: new Date(endIso).toISOString(),
    });

    downloadIcsFile(ics, `${event.name}`);
  };

  useEffect(() => {
    if (noteOpen) setNoteText(prefs.note);
  }, [noteOpen, prefs.note]);

  const handleTogglePin = () => {
    setEventPinned(event.id, !prefs.pinned);
    onPrefsChange();
  };

  const handleSetAttending = (status: "yes" | "no" | "maybe" | null) => {
    setEventAttending(event.id, status);
    onPrefsChange();
  };

  const handleSaveNote = () => {
    setEventNote(event.id, noteText);
    onPrefsChange();
    setNoteOpen(false);
  };

  const getAttendanceLabel = (status: "yes" | "no" | "maybe" | null) => {
    if (!status) return "Attendance";
    const statusLabels = { yes: "Going", no: "Not going", maybe: "Maybe" };
    return `Attendance: ${statusLabels[status]}`;
  };

  const attendingIcon = {
    yes: <Check className="w-3 h-3" />,
    no: <X className="w-3 h-3" />,
    maybe: <HelpCircle className="w-3 h-3" />,
    null: null,
  } as const;

  return (
    <Card
      className={`relative ${prefs.pinned ? "ring-2 ring-primary/50" : ""}`}
      data-testid={`event-card-${event.id}`}
    >
      {prefs.pinned && (
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
          <Pin className="w-3 h-3" />
        </div>
      )}

      <CardHeader className={density === "compact" ? "pb-1" : "pb-2"}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight">
              {event.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {event.city}, {event.state}
              </span>
              {event.venue && <span className="hidden sm:inline truncate">• {event.venue}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {event.source === "curated" ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <Shield className="w-2.5 h-2.5" />
                Verified
              </Badge>
            ) : event.source === "ai" ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className={density === "compact" ? "space-y-2" : "space-y-3"}>
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium">{event.dateRangeLabel}</span>
        </div>

        {density === "normal" && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {event.description}
          </p>
        )}

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 rounded-full">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {prefs.note && (
          <div
            className="bg-muted/50 rounded-md p-2 text-xs text-muted-foreground"
            data-testid={`event-note-preview-${event.id}`}
          >
            <div className="flex items-center gap-1 font-medium mb-0.5">
              <StickyNote className="w-3 h-3" />
              Your note:
            </div>
            <p className="line-clamp-2">{prefs.note}</p>
          </div>
        )}

        <div className={density === "compact" ? "flex flex-wrap items-center gap-2 pt-0" : "flex flex-wrap items-center gap-2 pt-1"}>
          <Button
            size="sm"
            variant={prefs.pinned ? "default" : "outline"}
            onClick={handleTogglePin}
            className="h-8 text-xs gap-1 rounded-full"
            data-testid={`event-pin-${event.id}`}
          >
            {prefs.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            {prefs.pinned ? "Unpin" : "Pin"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={prefs.attending === "yes" ? "default" : "outline"}
                className="h-8 text-xs gap-1 rounded-full"
                data-testid={`event-attending-${event.id}`}
              >
                {attendingIcon[prefs.attending || "null"]}
                {getAttendanceLabel(prefs.attending)}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleSetAttending("yes")} data-testid={`event-attending-yes-${event.id}`}>
                <Check className="w-4 h-4 mr-2" />
                Going
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetAttending("maybe")} data-testid={`event-attending-maybe-${event.id}`}>
                <HelpCircle className="w-4 h-4 mr-2" />
                Maybe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetAttending("no")} data-testid={`event-attending-no-${event.id}`}>
                <X className="w-4 h-4 mr-2" />
                Not going
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetAttending(null)} data-testid={`event-attending-clear-${event.id}`}>
                Not set
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant={prefs.reminderSet ? "default" : "outline"}
            onClick={handleToggleReminder}
            className="h-8 text-xs gap-1 rounded-full"
            data-testid={`event-reminder-${event.id}`}
          >
            {prefs.reminderSet ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
            {prefs.reminderSet ? "Reminder On" : "Remind Me"}
          </Button>

          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 rounded-full"
                data-testid={`event-note-${event.id}`}
              >
                <StickyNote className="w-3 h-3" />
                {prefs.note ? "Edit Note" : "Add Note"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Note for {event.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="Add your notes about this event..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  data-testid="event-note-input"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNoteOpen(false)} data-testid="event-note-cancel">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveNote} data-testid="event-note-save">
                    Save Note
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {event.startDateIso && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 rounded-full"
              onClick={handleAddToCalendar}
              data-testid={`event-calendar-${event.id}`}
            >
              <CalendarPlus className="w-3 h-3" />
              Add to calendar
            </Button>
          )}

          {event.websiteUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 rounded-full"
              asChild
              data-testid={`event-website-${event.id}`}
            >
              <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3" />
                Website
              </a>
            </Button>
          )}
        </div>

        {prefs.attending === "yes" && onScanHere && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={handleScanHere}
              className="flex-1 h-9 gap-2 rounded-full"
              data-testid={`event-scan-here-${event.id}`}
            >
              <Camera className="w-4 h-4" />
              Scan at this Event
            </Button>
            {contactCount > 0 && (
              <Badge
                variant="secondary"
                className="h-9 px-3 text-sm gap-1.5 rounded-full"
                data-testid={`event-contact-count-${event.id}`}
              >
                <Users className="w-3.5 h-3.5" />
                {contactCount} contact{contactCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {contactCount > 0 && prefs.attending !== "yes" && (
          <div className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground" data-testid={`event-contact-count-${event.id}`}>
            <Users className="w-3 h-3" />
            You met {contactCount} contact{contactCount !== 1 ? "s" : ""} at this event
          </div>
        )}

        {event.source === "curated" && (
          <p className="text-[10px] text-muted-foreground/70 mt-2" data-testid={`event-reliability-${event.id}`}>
            Verified from official website
          </p>
        )}
        {event.source === "ai" && (
          <p className="text-[10px] text-muted-foreground/70 italic mt-2" data-testid={`event-reliability-${event.id}`}>
            AI-suggested — please verify details on the official site.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface EventsHubProps {
  onScanAtEvent?: (eventName: string) => void;
}

type MySubView = "all" | "pinned" | "going" | "maybe";

export function EventsHub({ onScanAtEvent }: EventsHubProps) {
  const [topMode, setTopMode] = useState<"my" | "discover">("my");
  const [selectedIndustry, setSelectedIndustry] = useState<EventIndustryId>("renewable");
  const [mySubView, setMySubView] = useState<MySubView>("all");

  const [allPrefs, setAllPrefs] = useState(() => getAllEventPrefs());
  const [contacts] = useState(() => loadContacts());

  const [monthFilter, setMonthFilter] = useState<string>("all");

  const refreshPrefs = useCallback(() => {
    setAllPrefs(getAllEventPrefs());
  }, []);

  const getContactCountForEvent = useCallback(
    (eventName: string) => contacts.filter((c) => c.eventName === eventName).length,
    [contacts]
  );

  const allEvents = useMemo(() => {
    return sortEventsByDate([
      ...getEventsByIndustry("renewable"),
      ...getEventsByIndustry("mining"),
      ...getEventsByIndustry("construction"),
    ]);
  }, []);

  const monthOptions = useMemo(() => {
    const months = new Map<string, string>();
    allEvents.forEach((e) => {
      if (!e.startDateIso) return;
      const d = new Date(e.startDateIso + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString(undefined, { month: "long", year: "numeric" });
      months.set(key, label);
    });
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [allEvents]);
  const monthWheelOptions = useMemo(
    () => [{ value: "all", label: "All months" }, ...monthOptions],
    [monthOptions]
  );

  // Filters (month only)
  const applyFilters = useCallback(
    (events: EventItem[]) => {
      return events.filter((e) => {
        if (monthFilter !== "all" && e.startDateIso) {
          const d = new Date(e.startDateIso + "T00:00:00");
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (key !== monthFilter) return false;
        }
        return true;
      });
    },
    [monthFilter]
  );

  const myEventsAll = useMemo(() => {
    const interacted = allEvents.filter((e) => {
      const p = allPrefs[e.id];
      if (!p) return false;
      return !!(p.pinned || p.attending || p.reminderSet || (p.note && p.note.trim().length > 0));
    });
    return applyFilters(interacted);
  }, [allEvents, allPrefs, applyFilters]);

  const myPinned = useMemo(() => myEventsAll.filter((e) => allPrefs[e.id]?.pinned), [myEventsAll, allPrefs]);
  const myGoing = useMemo(() => myEventsAll.filter((e) => allPrefs[e.id]?.attending === "yes"), [myEventsAll, allPrefs]);
  const myMaybe = useMemo(() => myEventsAll.filter((e) => allPrefs[e.id]?.attending === "maybe"), [myEventsAll, allPrefs]);

  const myEvents = useMemo(() => {
    if (mySubView === "pinned") return myPinned;
    if (mySubView === "going") return myGoing;
    if (mySubView === "maybe") return myMaybe;
    return myEventsAll;
  }, [mySubView, myPinned, myGoing, myMaybe, myEventsAll]);

  const getSortedEventsForIndustry = useCallback(
    (industryId: EventIndustryId) => {
      const events = sortEventsByDate(getEventsByIndustry(industryId));
      const pinnedEvents = events.filter((e) => allPrefs[e.id]?.pinned);
      const unpinnedEvents = events.filter((e) => !allPrefs[e.id]?.pinned);
      return applyFilters([...pinnedEvents, ...unpinnedEvents]);
    },
    [allPrefs, applyFilters]
  );

  const selectedIndustryLabel =
    INDUSTRIES.find((i) => i.id === selectedIndustry)?.label || "Industry";
  const SelectedIndustryIcon = industryIcons[selectedIndustry] || Sun;

  const monthLabel =
    monthFilter === "all"
      ? "All months"
      : monthOptions.find((m) => m.value === monthFilter)?.label || "Month";

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Discover industry events near you, Pin key ones, or add them to your calendar.
        </p>
      </div>


      {/* Top mode pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Badge
          variant={topMode === "my" ? "default" : "outline"}
          className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
          onClick={() => setTopMode("my")}
          data-testid="events-pill-my"
        >
          <Pin className="w-3 h-3 mr-1" />
          My
        </Badge>
        <Badge
          variant={topMode === "discover" ? "default" : "outline"}
          className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
          onClick={() => setTopMode("discover")}
          data-testid="events-pill-discover"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Discover
        </Badge>

        {/* Month filter pill (wheel) */}
        <WheelPickerPopover
          options={monthWheelOptions}

          value={monthFilter}
          onChange={setMonthFilter}
          title="Select Month"
          trigger={
            <Badge
              variant="outline"
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1 flex items-center gap-1"
              data-testid="events-filter-month"
            >
              <Filter className="w-3 h-3" />
              {monthLabel}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Badge>
          }
        />

        {/* Clear month (only when active) */}
        {monthFilter !== "all" && (
          <Badge
            variant="secondary"
            className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
            onClick={() => setMonthFilter("all")}
            data-testid="events-filter-clear-month"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear
          </Badge>
        )}
      </div>

      {/* MY MODE */}
      {topMode === "my" && (
        <>
          {/* My sub-view pills (like Relationships) */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Badge
              variant={mySubView === "all" ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
              onClick={() => setMySubView("all")}
              data-testid="events-my-all"
            >
              All
              <span className="ml-2 text-[11px] opacity-80">{myEventsAll.length}</span>
            </Badge>
            <Badge
              variant={mySubView === "pinned" ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
              onClick={() => setMySubView("pinned")}
              data-testid="events-my-pinned"
            >
              Pinned
              <span className="ml-2 text-[11px] opacity-80">{myPinned.length}</span>
            </Badge>
            <Badge
              variant={mySubView === "going" ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
              onClick={() => setMySubView("going")}
              data-testid="events-my-going"
            >
              Going
              <span className="ml-2 text-[11px] opacity-80">{myGoing.length}</span>
            </Badge>
            <Badge
              variant={mySubView === "maybe" ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1"
              onClick={() => setMySubView("maybe")}
              data-testid="events-my-maybe"
            >
              Maybe
              <span className="ml-2 text-[11px] opacity-80">{myMaybe.length}</span>
            </Badge>
          </div>

          {myEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No saved events yet</p>
              <p className="text-xs mt-1">
                Pin events, set attendance, or add a note to build your plan.
              </p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => setTopMode("discover")} className="rounded-full">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Discover events
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {myEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  prefs={
                    allPrefs[event.id] || {
                      pinned: false,
                      attending: null,
                      note: "",
                      reminderSet: false,
                      reminderDismissed: false,
                    }
                  }
                  onPrefsChange={refreshPrefs}
                  contactCount={getContactCountForEvent(event.name)}
                  onScanHere={onScanAtEvent}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* DISCOVER MODE */}
      {topMode === "discover" && (
        <>
          {/* Industry filter dropdown (modern) */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Filter</div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 rounded-full gap-2"
                  data-testid="events-industry-filter"
                >
                  <SelectedIndustryIcon className="w-4 h-4" />
                  <span className="truncate max-w-[160px]">{selectedIndustryLabel}</span>
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {INDUSTRIES.map((industry) => {
                  const Icon = industryIcons[industry.id];
                  const active = industry.id === selectedIndustry;
                  return (
                    <DropdownMenuItem
                      key={industry.id}
                      onClick={() => setSelectedIndustry(industry.id)}
                      data-testid={`events-industry-${industry.id}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      <span className="flex-1">{industry.label}</span>
                      {active ? <Check className="w-4 h-4 opacity-70" /> : null}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMonthFilter("all")} data-testid="events-industry-clear-filters">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear month filter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Events list */}
          {(() => {
            const industryEvents = getSortedEventsForIndustry(selectedIndustry);
            if (industryEvents.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No events found</p>
                  <p className="text-xs mt-1">Try clearing the month filter.</p>
                  {monthFilter !== "all" && (
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => setMonthFilter("all")} className="rounded-full">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Clear month filter
                      </Button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {industryEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    prefs={
                      allPrefs[event.id] || {
                        pinned: false,
                        attending: null,
                        note: "",
                        reminderSet: false,
                        reminderDismissed: false,
                      }
                    }
                    onPrefsChange={refreshPrefs}
                    contactCount={getContactCountForEvent(event.name)}
                    onScanHere={onScanAtEvent}
                  />
                ))}
              </div>
            );
          })()}
        </>
      )}

      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground">More events coming soon. Data refreshed periodically.</p>
      </div>
    </div>
  );
}
