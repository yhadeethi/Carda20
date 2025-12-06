import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import {
  EventItem,
  EventIndustryId,
  INDUSTRIES,
  getEventsByIndustry,
  sortEventsByDate,
} from "@/lib/eventsData";
import {
  getEventPrefs,
  setEventPinned,
  setEventAttending,
  setEventNote,
  EventUserPrefs,
  getAllEventPrefs,
} from "@/lib/eventsStorage";

const industryIcons: Record<EventIndustryId, typeof Sun> = {
  renewable: Sun,
  mining: Pickaxe,
  construction: Building2,
};

interface EventCardProps {
  event: EventItem;
  prefs: EventUserPrefs;
  onPrefsChange: () => void;
}

function EventCard({ event, prefs, onPrefsChange }: EventCardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(prefs.note);

  useEffect(() => {
    if (noteOpen) {
      setNoteText(prefs.note);
    }
  }, [noteOpen, prefs.note]);

  const handleTogglePin = () => {
    setEventPinned(event.id, !prefs.pinned);
    onPrefsChange();
  };

  const handleSetAttending = (status: 'yes' | 'no' | 'maybe' | null) => {
    setEventAttending(event.id, status);
    onPrefsChange();
  };

  const handleSaveNote = () => {
    setEventNote(event.id, noteText);
    onPrefsChange();
    setNoteOpen(false);
  };

  const attendingLabel = {
    yes: 'Attending',
    no: 'Not Attending',
    maybe: 'Maybe',
    null: 'Set Status',
  };

  const attendingIcon = {
    yes: <Check className="w-3 h-3" />,
    no: <X className="w-3 h-3" />,
    maybe: <HelpCircle className="w-3 h-3" />,
    null: null,
  };

  return (
    <Card className={`relative ${prefs.pinned ? 'ring-2 ring-primary/50' : ''}`} data-testid={`event-card-${event.id}`}>
      {prefs.pinned && (
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
          <Pin className="w-3 h-3" />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight">
              {event.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{event.city}, {event.state}</span>
              {event.venue && (
                <span className="hidden sm:inline truncate">• {event.venue}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {event.source === 'curated' ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <Shield className="w-2.5 h-2.5" />
                Verified
              </Badge>
            ) : event.source === 'ai' ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium">{event.dateRangeLabel}</span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {event.description}
        </p>

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {prefs.note && (
          <div className="bg-muted/50 rounded-md p-2 text-xs text-muted-foreground" data-testid={`event-note-preview-${event.id}`}>
            <div className="flex items-center gap-1 font-medium mb-0.5">
              <StickyNote className="w-3 h-3" />
              Your note:
            </div>
            <p className="line-clamp-2">{prefs.note}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={prefs.pinned ? "default" : "outline"}
            onClick={handleTogglePin}
            className="h-8 text-xs gap-1"
            data-testid={`event-pin-${event.id}`}
          >
            {prefs.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            {prefs.pinned ? 'Unpin' : 'Pin'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={prefs.attending === 'yes' ? "default" : "outline"}
                className="h-8 text-xs gap-1"
                data-testid={`event-attending-${event.id}`}
              >
                {attendingIcon[prefs.attending || 'null']}
                {attendingLabel[prefs.attending || 'null']}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onClick={() => handleSetAttending('yes')}
                data-testid={`event-attending-yes-${event.id}`}
              >
                <Check className="w-4 h-4 mr-2" />
                Attending
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleSetAttending('maybe')}
                data-testid={`event-attending-maybe-${event.id}`}
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Maybe
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleSetAttending('no')}
                data-testid={`event-attending-no-${event.id}`}
              >
                <X className="w-4 h-4 mr-2" />
                Not Attending
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleSetAttending(null)}
                data-testid={`event-attending-clear-${event.id}`}
              >
                Clear Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1"
                data-testid={`event-note-${event.id}`}
              >
                <StickyNote className="w-3 h-3" />
                {prefs.note ? 'Edit Note' : 'Add Note'}
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

          {event.websiteUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 ml-auto"
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

        {event.reliabilityNote && (
          <p className="text-[10px] text-muted-foreground/70 italic" data-testid={`event-reliability-${event.id}`}>
            {event.reliabilityNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function EventsHub() {
  const [selectedIndustry, setSelectedIndustry] = useState<EventIndustryId>('renewable');
  const [allPrefs, setAllPrefs] = useState(() => getAllEventPrefs());

  const refreshPrefs = useCallback(() => {
    setAllPrefs(getAllEventPrefs());
  }, []);

  const getSortedEventsForIndustry = useCallback((industryId: EventIndustryId) => {
    const events = sortEventsByDate(getEventsByIndustry(industryId));
    const pinnedEvents = events.filter((e) => allPrefs[e.id]?.pinned);
    const unpinnedEvents = events.filter((e) => !allPrefs[e.id]?.pinned);
    return [...pinnedEvents, ...unpinnedEvents];
  }, [allPrefs]);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold" data-testid="events-hub-title">
          Events Hub
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover industry events across Australia. Pin events and track your attendance.
        </p>
      </div>

      <Tabs value={selectedIndustry} onValueChange={(v) => setSelectedIndustry(v as EventIndustryId)}>
        <TabsList className="w-full grid grid-cols-3">
          {INDUSTRIES.map((industry) => {
            const Icon = industryIcons[industry.id];
            return (
              <TabsTrigger
                key={industry.id}
                value={industry.id}
                className="gap-1.5 text-xs"
                data-testid={`industry-tab-${industry.id}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{industry.label}</span>
                <span className="sm:hidden">
                  {industry.id === 'renewable' ? 'Energy' : industry.id === 'mining' ? 'Mining' : 'Build'}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {INDUSTRIES.map((industry) => {
          const industryEvents = getSortedEventsForIndustry(industry.id);
          return (
            <TabsContent key={industry.id} value={industry.id} className="mt-4 space-y-4">
              {industryEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No events found for {industry.label}</p>
                </div>
              ) : (
                industryEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    prefs={allPrefs[event.id] || { pinned: false, attending: null, note: '' }}
                    onPrefsChange={refreshPrefs}
                  />
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground">
          More events coming soon. Data refreshed periodically.
        </p>
      </div>
    </div>
  );
}
