import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Plus,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  Loader2,
  Zap,
  Tag,
  X,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserEvent, Contact } from "@shared/schema";

interface EventsTabProps {
  onSelectEvent: (eventId: number) => void;
  onContinueEvent?: (eventId: number) => void;
}

export function EventsTab({ onSelectEvent, onContinueEvent }: EventsTabProps) {
  const { toast } = useToast();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventTags, setNewEventTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");
  const [newEventLink, setNewEventLink] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState<string | null>(null);
  const [longitude, setLongitude] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const { data: events = [], isLoading } = useQuery<UserEvent[]>({
    queryKey: ["/api/user-events"],
  });

  const { data: activeEvent } = useQuery<UserEvent | null>({
    queryKey: ["/api/user-events/active"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: { title: string; tags?: string[]; notes?: string; eventLink?: string; locationLabel?: string; latitude?: string | null; longitude?: string | null }) => {
      const response = await apiRequest("POST", "/api/user-events", data);
      return response.json() as Promise<UserEvent>;
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-events/active"] });
      setShowCreateDrawer(false);
      resetForm();
      toast({ title: "Event started", description: `"${event.title}" is now active` });
      onSelectEvent(event.id);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create event", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewEventTitle("");
    setNewEventTags([]);
    setTagInput("");
    setNewEventNotes("");
    setNewEventLink("");
    setLocationLabel("");
    setLatitude(null);
    setLongitude(null);
  };

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toString());
        setLongitude(lng.toString());
        const sydneyBounds = { minLat: -34.2, maxLat: -33.4, minLng: 150.5, maxLng: 151.5 };
        if (lat >= sydneyBounds.minLat && lat <= sydneyBounds.maxLat && lng >= sydneyBounds.minLng && lng <= sydneyBounds.maxLng) {
          setLocationLabel("Sydney, NSW");
        } else {
          setLocationLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setLocationLoading(false);
        toast({ title: "Location detected" });
      },
      (error) => {
        setLocationLoading(false);
        toast({ title: "Location access denied", description: error.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [toast]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !newEventTags.includes(tag)) {
      setNewEventTags([...newEventTags, tag]);
      setTagInput("");
    }
  }, [tagInput, newEventTags]);

  const handleRemoveTag = (tag: string) => {
    setNewEventTags(newEventTags.filter((t) => t !== tag));
  };

  const handleCreateEvent = () => {
    if (!newEventTitle.trim()) {
      toast({ title: "Title required", description: "Please enter an event name", variant: "destructive" });
      return;
    }
    createEventMutation.mutate({
      title: newEventTitle.trim(),
      tags: newEventTags.length > 0 ? newEventTags : undefined,
      notes: newEventNotes.trim() || undefined,
      eventLink: newEventLink.trim() || undefined,
      locationLabel: locationLabel.trim() || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
    });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-events-title">
          Events
        </h1>
        <p className="text-sm text-muted-foreground">
          Create events to capture contacts at networking meetups, conferences, and more.
        </p>
      </div>

      {activeEvent && (
        <Card className="border-primary/50 bg-primary/5" data-testid="card-active-event">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="default" className="gap-1">
                <Zap className="w-3 h-3" />
                Active Event
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(activeEvent.startedAt)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <h3 className="text-lg font-semibold">{activeEvent.title}</h3>
            {activeEvent.tags && activeEvent.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {activeEvent.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => onContinueEvent?.(activeEvent.id) || onSelectEvent(activeEvent.id)}
              data-testid="button-continue-event"
            >
              <Users className="w-4 h-4" />
              Continue Capturing
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Drawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer}>
        <DrawerTrigger asChild>
          <Button className="w-full gap-2" size="lg" data-testid="button-start-event">
            <Plus className="w-5 h-5" />
            Start Event
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Start New Event</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Name *</label>
              <Input
                placeholder="e.g., Tech Meetup Sydney 2026"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                data-testid="input-event-title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  data-testid="input-event-tag"
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newEventTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {newEventTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Add notes about this event..."
                value={newEventNotes}
                onChange={(e) => setNewEventNotes(e.target.value)}
                rows={3}
                data-testid="input-event-notes"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Sydney Convention Centre"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  data-testid="input-event-location"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={detectLocation}
                  disabled={locationLoading}
                  data-testid="button-detect-location"
                >
                  {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                </Button>
              </div>
              {latitude && longitude && (
                <p className="text-xs text-muted-foreground">
                  Coordinates: {parseFloat(latitude).toFixed(4)}, {parseFloat(longitude).toFixed(4)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event Link (optional)</label>
              <Input
                placeholder="https://..."
                value={newEventLink}
                onChange={(e) => setNewEventLink(e.target.value)}
                data-testid="input-event-link"
              />
            </div>
          </div>
          <DrawerFooter className="pt-4">
            <Button
              onClick={handleCreateEvent}
              disabled={createEventMutation.isPending}
              className="gap-2"
              data-testid="button-create-event"
            >
              {createEventMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Start Event
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {events.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">
            Recent Events
          </h2>
          <div className="space-y-2">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onSelect={() => onSelectEvent(event.id)}
                isActive={activeEvent?.id === event.id}
              />
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && !activeEvent && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No events yet</p>
          <p className="text-sm mt-1">
            Start an event to capture contacts at your next meetup or conference.
          </p>
        </div>
      )}
    </div>
  );
}

interface EventRowProps {
  event: UserEvent;
  onSelect: () => void;
  isActive?: boolean;
}

function EventRow({ event, onSelect, isActive }: EventRowProps) {
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/user-events", event.id, "contacts"],
    enabled: false,
  });

  const contactCount = contacts.length;

  return (
    <Card
      className={`cursor-pointer hover-elevate transition-all ${isActive ? "ring-2 ring-primary/50" : ""}`}
      onClick={onSelect}
      data-testid={`card-event-${event.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{event.title}</h3>
              {event.isActive === 1 && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                  Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(event.startedAt || event.createdAt!).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {event.locationLabel && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {event.locationLabel}
                </span>
              )}
              {contactCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {contactCount}
                </span>
              )}
            </div>
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {event.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {tag}
                  </Badge>
                ))}
                {event.tags.length > 3 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    +{event.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
