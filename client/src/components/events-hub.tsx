import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  MapPin,
  Play,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useUserEvents } from "@/hooks/useUserEvents";
import {
  getActiveUserEventId,
  setActiveUserEventId,
  type UserEvent,
} from "@/lib/userEventsApi";

import { getLocationTag } from "@/lib/geoTag";
import { parseIcsEvents, type ParsedIcsEvent } from "@/lib/calendar/parseIcs";
import { processImageData } from "@/lib/batchProcessor";
import { saveUnifiedContactFromParsed } from "@/lib/contacts/saveUnifiedContact";
import { createThumbnail } from "@/lib/batchScanStorage";
import { compressImageForOCR, CompressionError } from "@/lib/imageUtils";

type View = "list" | "active" | "import";

interface EventsHubProps {
  onContactsCreated?: () => void;
}

type CaptureItem = {
  id: string;
  thumbnail: string;
  status: "queued" | "processing" | "saved" | "failed";
  label?: string;
  error?: string;
};

function formatWhen(startAt?: string | null): string {
  if (!startAt) return "";
  const d = new Date(startAt);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function EventsHub({ onContactsCreated }: EventsHubProps) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);

  const { events, isLoading, createEvent, updateEvent, deleteEvent, isCreating } = useUserEvents();

  const [view, setView] = useState<View>("list");
  const [activeEventId, setActiveEventId] = useState<string | null>(() => getActiveUserEventId());

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartAt, setNewEventStartAt] = useState<string>("");
  const [newEventTags, setNewEventTags] = useState<string>("");
  const [newEventNotes, setNewEventNotes] = useState<string>("");

  const [imported, setImported] = useState<ParsedIcsEvent[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());

  const [captureItems, setCaptureItems] = useState<CaptureItem[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTags, setEditTags] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [events]);

  const activeEvent: UserEvent | null = useMemo(() => {
    if (!activeEventId) return null;
    return sortedEvents.find((e) => e.id === activeEventId) || null;
  }, [sortedEvents, activeEventId]);

  // If active event was deleted (or on another device), clear it.
  useEffect(() => {
    if (activeEventId && !activeEvent) {
      setActiveUserEventId(null);
      setActiveEventId(null);
    }
  }, [activeEventId, activeEvent]);

  // ===== Create Event =====
  const openCreate = () => {
    const today = new Date();
    const fallback = `Event — ${today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    setNewEventTitle(fallback);
    setNewEventStartAt("");
    setNewEventTags("");
    setNewEventNotes("");
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    const title = newEventTitle.trim();
    if (!title) return;

    try {
      // Location tagging is best-effort, never blocking.
      const loc = await getLocationTag();
      const ev = await createEvent({
        title,
        startAt: newEventStartAt || null,
        locationTag: loc?.tag || null,
        coords: loc?.coords || null,
        tags: splitTags(newEventTags),
        notes: newEventNotes.trim() || null,
        source: "manual",
      });

      setActiveUserEventId(ev.id);
      setActiveEventId(ev.id);
      setView("active");
      setShowCreateDialog(false);

      toast({
        title: "Event started",
        description: loc?.tag ? `Auto-tagged: ${loc.tag}` : undefined,
      });
    } catch (e: any) {
      toast({
        title: "Could not start event",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    }
  };

  // ===== Import from Calendar (.ics) =====
  const openImport = () => {
    setImported([]);
    setSelectedImportIds(new Set());
    setView("import");
  };

  const handlePickIcs = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseIcsEvents(text);
      setImported(parsed);
      setSelectedImportIds(new Set(parsed.map((p) => p.id)));
      if (parsed.length === 0) {
        toast({
          title: "No events found",
          description: "That .ics file didn't contain readable events.",
        });
      }
    } catch {
      toast({
        title: "Import failed",
        description: "Could not read that .ics file.",
        variant: "destructive",
      });
    }
  };

  const handleCreateFromImport = async () => {
    if (imported.length === 0) return;
    const selected = imported.filter((p) => selectedImportIds.has(p.id));
    if (selected.length === 0) return;

    try {
      const loc = await getLocationTag();
      let created = 0;

      for (const p of selected) {
        await createEvent({
          title: p.title,
          startAt: p.startAt || null,
          locationTag: p.location || loc?.tag || null,
          coords: loc?.coords || null,
          tags: [],
          notes: null,
          source: "calendar",
          calendarMeta: { location: p.location || null },
        });
        created++;
      }

      setView("list");
      toast({ title: `Imported ${created} event${created !== 1 ? "s" : ""}` });
    } catch (e: any) {
      toast({
        title: "Import failed",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    }
  };

  // ===== Active Event: Capture + background extraction =====
  const handleStartCapture = () => {
    if (!activeEvent) return;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!activeEvent || !files || files.length === 0) return;

    setIsCapturing(true);
    try {
      const newItems: CaptureItem[] = [];

      for (const rawFile of Array.from(files)) {
        let fileToRead = rawFile;
        try {
          const compressed = await compressImageForOCR(rawFile);
          fileToRead = compressed.file;
        } catch (err) {
          // Best-effort. If compression fails, continue with the original.
          if (err instanceof CompressionError) {
            toast({
              title: err.type === "still_too_large" ? "Image too large" : "Image processing failed",
              description: err.message || "Try a different photo.",
              variant: "destructive",
            });
            continue;
          }
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileToRead);
        });

        const thumb = await createThumbnail(base64);

        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          thumbnail: thumb,
          status: "queued",
        });

        // Kick off processing in the background.
        void processOne(base64, activeEvent, thumb);
      }

      if (newItems.length > 0) {
        setCaptureItems((prev) => [...newItems, ...prev].slice(0, 80));
        toast({ title: `Added ${newItems.length} card${newItems.length !== 1 ? "s" : ""}` });
      }
    } catch (e) {
      toast({ title: "Could not add photos", description: "Try again.", variant: "destructive" });
    } finally {
      setIsCapturing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processOne = async (imageData: string, ev: UserEvent, thumb: string) => {
    const itemId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Replace the queued item we just inserted that matches the thumb (best effort)
    setCaptureItems((prev) => {
      const idx = prev.findIndex((p) => p.thumbnail === thumb && p.status === "queued");
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], id: itemId, status: "processing" };
      return next;
    });

    setIsProcessing(true);
    try {
      const result = await processImageData(imageData);

      if (result?.contact) {
        const saved = saveUnifiedContactFromParsed(result.contact, {
          eventName: ev.title,
          source: "event",
          eventMeta: {
            eventId: ev.id,
            eventTitle: ev.title,
            locationTag: ev.locationTag,
          },
        });

        if (saved.v2?.id) {
          onContactsCreated?.();
        }
      }

      setCaptureItems((prev) =>
        prev.map((p) => (p.id === itemId ? { ...p, status: "saved", label: result?.contact?.fullName || "Saved" } : p)),
      );
    } catch (e: any) {
      setCaptureItems((prev) =>
        prev.map((p) =>
          p.id === itemId ? { ...p, status: "failed", error: e?.message || "Failed" } : p,
        ),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopEvent = () => {
    setActiveUserEventId(null);
    setActiveEventId(null);
    setView("list");
    setCaptureItems([]);
  };

  const handleOpenEdit = () => {
    if (!activeEvent) return;
    setEditTags(activeEvent.tags.join(", "));
    setEditNotes(activeEvent.notes || "");
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!activeEvent) return;

    try {
      await updateEvent(activeEvent.id, {
        tags: splitTags(editTags),
        notes: editNotes.trim() || null,
      });
      setShowEditDialog(false);
      toast({ title: "Updated" });
    } catch {
      toast({ title: "Could not update", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      if (activeEventId === id) handleStopEvent();
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Could not delete", variant: "destructive" });
    }
  };

  // ===== UI =====

  const glass = "bg-white/7 dark:bg-white/5 border-white/15 dark:border-white/10 backdrop-blur-xl";
  const subtle = "text-muted-foreground";

  return (
    <div className="space-y-4" data-testid="events-hub">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        ref={icsInputRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePickIcs(f);
          if (icsInputRef.current) icsInputRef.current.value = "";
        }}
      />

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className={glass}>
          <DialogHeader>
            <DialogTitle>Start Event</DialogTitle>
            <DialogDescription className={subtle}>
              Create an event and capture cards fast — extraction runs in the background.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Title</div>
              <Input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="e.g., All Energy Australia 2026" />
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-medium">Start time (optional)</div>
              <Input
                value={newEventStartAt}
                onChange={(e) => setNewEventStartAt(e.target.value)}
                placeholder="2026-02-12T09:00:00+10:00"
              />
              <div className="text-xs text-muted-foreground">
                Tip: leave blank if you don’t care. Import from calendar if you do.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-medium">Tags (comma separated)</div>
              <Input value={newEventTags} onChange={(e) => setNewEventTags(e.target.value)} placeholder="solar, battery, leads" />
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-medium">Notes</div>
              <Textarea value={newEventNotes} onChange={(e) => setNewEventNotes(e.target.value)} placeholder="What am I trying to achieve at this event?" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className={glass}>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription className={subtle}>Update tags and notes. (Location tag is auto.)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Tags</div>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="comma, tags" />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Notes</div>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openCreate} className="rounded-full">
          <Play className="w-4 h-4 mr-2" />
          Start Event
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            openImport();
            icsInputRef.current?.click();
          }}
          className="rounded-full"
        >
          <CalendarPlus className="w-4 h-4 mr-2" />
          Import from Calendar
        </Button>

        {activeEvent && (
          <Badge variant="secondary" className="ml-auto rounded-full px-3 py-1">
            Active
          </Badge>
        )}
      </div>

      {/* Import view */}
      {view === "import" && (
        <Card className={glass}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Import Preview</div>
              <Button variant="ghost" size="sm" onClick={() => setView("list")} className="rounded-full">
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>

            {imported.length === 0 ? (
              <div className="text-sm text-muted-foreground">Pick a .ics file…</div>
            ) : (
              <>
                <ScrollArea className="h-[220px]">
                  <div className="space-y-2 pr-2">
                    {imported.map((ev) => {
                      const selected = selectedImportIds.has(ev.id);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => {
                            setSelectedImportIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(ev.id)) next.delete(ev.id);
                              else next.add(ev.id);
                              return next;
                            });
                          }}
                          className={`w-full text-left rounded-xl border p-3 transition ${selected ? "border-primary/40 bg-primary/5" : "border-white/10 bg-white/5"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{ev.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {formatWhen(ev.startAt)}{ev.location ? ` • ${ev.location}` : ""}
                              </div>
                            </div>
                            <Badge variant={selected ? "default" : "secondary"} className="rounded-full">
                              {selected ? "Selected" : "Off"}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => icsInputRef.current?.click()} className="rounded-full">
                    <Upload className="w-4 h-4 mr-2" />
                    Pick another .ics
                  </Button>
                  <Button onClick={handleCreateFromImport} disabled={isCreating} className="rounded-full ml-auto">
                    {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Create {selectedImportIds.size}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active view */}
      {activeEvent && view !== "import" && (
        <Card className={glass}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{activeEvent.title}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {activeEvent.locationTag && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {activeEvent.locationTag}
                    </span>
                  )}
                  {activeEvent.startAt && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarPlus className="w-3.5 h-3.5" />
                      {formatWhen(activeEvent.startAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleOpenEdit} className="rounded-full">
                  Edit
                </Button>
                <Button variant="ghost" onClick={handleStopEvent} className="rounded-full text-muted-foreground">
                  Stop
                </Button>
              </div>
            </div>

            {activeEvent.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeEvent.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="rounded-full">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            {!!activeEvent.notes && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="whitespace-pre-wrap">{activeEvent.notes}</div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleStartCapture} disabled={isCapturing} className="rounded-full">
                {isCapturing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Capture Cards
              </Button>
              <Button variant="outline" onClick={() => setCaptureItems([])} className="rounded-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear List
              </Button>

              {isProcessing && (
                <Badge variant="secondary" className="ml-auto rounded-full">
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Extracting…
                </Badge>
              )}
            </div>

            {captureItems.length > 0 && (
              <ScrollArea className="h-[260px]">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pr-2">
                  {captureItems.map((it) => (
                    <div key={it.id} className="relative rounded-lg overflow-hidden border border-white/10 bg-white/5">
                      <img src={it.thumbnail} alt="" className="w-full h-20 object-cover" />
                      <div className="p-1.5">
                        <div className="text-[10px] truncate">
                          {it.status === "saved" ? it.label || "Saved" : it.status === "failed" ? "Failed" : it.status}
                        </div>
                      </div>

                      <div className="absolute top-1 right-1">
                        {it.status === "saved" ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : it.status === "failed" ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {(!activeEvent || view === "list") && view !== "import" && (
        <Card className={glass}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Your Events</div>
              {isLoading && (
                <Badge variant="secondary" className="rounded-full">
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Loading…
                </Badge>
              )}
            </div>

            {sortedEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No events yet. Start one and batch-capture cards.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedEvents.slice(0, 20).map((ev) => {
                  const isActive = ev.id === activeEventId;
                  return (
                    <div key={ev.id} className={`rounded-xl border p-3 ${isActive ? "border-primary/40 bg-primary/5" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button
                          className="min-w-0 text-left"
                          onClick={() => {
                            setActiveUserEventId(ev.id);
                            setActiveEventId(ev.id);
                            setView("active");
                            setCaptureItems([]);
                          }}
                        >
                          <div className="font-medium truncate">{ev.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {ev.locationTag ? `${ev.locationTag} • ` : ""}
                            {ev.startAt ? formatWhen(ev.startAt) : "No time set"}
                          </div>
                        </button>

                        <div className="flex items-center gap-2">
                          {isActive && <Badge className="rounded-full">Active</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(ev.id)}
                            className="rounded-full text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {ev.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ev.tags.slice(0, 6).map((t) => (
                            <Badge key={t} variant="secondary" className="rounded-full">
                              {t}
                            </Badge>
                          ))}
                          {ev.tags.length > 6 && (
                            <Badge variant="secondary" className="rounded-full">
                              +{ev.tags.length - 6}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
