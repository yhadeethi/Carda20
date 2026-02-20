import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  Link2,
  Link2Off,
  Upload,
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Check,
  Cloud,
} from "lucide-react";
import { SiSalesforce } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserEvent, Contact } from "@shared/schema";

interface SalesforceProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportView = "main" | "timeline-select";

interface TimelineEntry {
  id: number;
  type: string;
  summary: string;
  eventAt: string;
}

export function SalesforceProfile({ open, onOpenChange }: SalesforceProfileProps) {
  const { toast } = useToast();
  const [exportView, setExportView] = useState<ExportView>("main");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedTimelineIds, setSelectedTimelineIds] = useState<number[]>([]);

  const { data: salesforceStatus, isLoading: statusLoading } = useQuery<{
    connected: boolean;
    instanceUrl?: string | null;
  }>({
    queryKey: ["/api/salesforce/status"],
    enabled: open,
  });

  const { data: events = [] } = useQuery<UserEvent[]>({
    queryKey: ["/api/user-events"],
    enabled: open && !!salesforceStatus?.connected,
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: open && !!salesforceStatus?.connected,
  });

  const { data: timelineEvents = [] } = useQuery<TimelineEntry[]>({
    queryKey: [`/api/contacts/${selectedContactId}/timeline`],
    enabled: !!selectedContactId && exportView === "timeline-select",
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/salesforce/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salesforce/status"] });
      toast({ title: "Salesforce disconnected" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to disconnect", description: e.message, variant: "destructive" });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/salesforce/sync-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: `Contacts exported`,
        description: `${data.synced} synced, ${data.failed} failed out of ${data.total}`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    },
  });

  const exportEventMutation = useMutation({
    mutationFn: async (eventId: number | string) => {
      const res = await apiRequest("POST", `/api/salesforce/export-event/${eventId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Event exported" : "Export failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (e: any) => {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    },
  });

  const exportTimelineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContactId || selectedTimelineIds.length === 0) throw new Error("Select timeline entries");
      const res = await apiRequest("POST", "/api/salesforce/export-timeline", {
        contactId: selectedContactId,
        eventIds: selectedTimelineIds,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Timeline exported" : "Export failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      setExportView("main");
      setSelectedContactId(null);
      setSelectedTimelineIds([]);
    },
    onError: (e: any) => {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    },
  });

  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await apiRequest("POST", "/api/salesforce/connect");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Connection failed", description: "Could not get Salesforce authorization URL.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const toggleTimelineId = (id: number) => {
    setSelectedTimelineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllTimeline = () => {
    if (selectedTimelineIds.length === timelineEvents.length) {
      setSelectedTimelineIds([]);
    } else {
      setSelectedTimelineIds(timelineEvents.map((e) => e.id));
    }
  };

  const contactsWithEmail = contacts.filter((c: any) => c.email);
  const contactsForTimeline = contacts.filter((c: any) => c.email);

  const formatDate = (d: string | Date | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTimelineType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const instanceLabel = salesforceStatus?.instanceUrl
    ? new URL(salesforceStatus.instanceUrl).hostname.replace(".salesforce.com", "")
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[85vh]">
        <div className="p-4 pb-2">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SiSalesforce className="w-5 h-5 text-[#00A1E0]" />
              Salesforce Integration
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-80px)] px-4 pb-6 space-y-4">
          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !salesforceStatus?.connected ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#00A1E0]/10 flex items-center justify-center">
                    <SiSalesforce className="w-5 h-5 text-[#00A1E0]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Connect your Salesforce account</p>
                    <p className="text-xs text-muted-foreground">
                      Export contacts, events, and timeline to your CRM
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full gap-2"
                  data-testid="button-salesforce-connect"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {connecting ? "Connecting..." : "Connect Salesforce"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {exportView === "main" && (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Connected</p>
                            {instanceLabel && (
                              <p className="text-xs text-muted-foreground truncate">
                                {instanceLabel}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectMutation.mutate()}
                          disabled={disconnectMutation.isPending}
                          data-testid="button-salesforce-disconnect"
                        >
                          {disconnectMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Link2Off className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold tracking-tight px-1">Export to Salesforce</h3>

                    <Card className="hover-elevate">
                      <CardContent className="p-0">
                        <button
                          className="w-full p-4 flex items-center justify-between gap-3 text-left"
                          onClick={() => syncAllMutation.mutate()}
                          disabled={syncAllMutation.isPending}
                          data-testid="button-salesforce-export-contacts"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">All Contacts</p>
                              <p className="text-xs text-muted-foreground">
                                {contactsWithEmail.length} contacts with email
                              </p>
                            </div>
                          </div>
                          {syncAllMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                          ) : (
                            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                      </CardContent>
                    </Card>

                    {events.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-medium text-muted-foreground px-1 pt-2">Events</h4>
                        {events.slice(0, 10).map((event) => (
                          <Card key={event.id} className="hover-elevate">
                            <CardContent className="p-0">
                              <button
                                className="w-full p-3 flex items-center justify-between gap-3 text-left"
                                onClick={() => exportEventMutation.mutate(event.publicId ?? event.id)}
                                disabled={exportEventMutation.isPending}
                                data-testid={`button-salesforce-export-event-${event.publicId ?? event.id}`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <Calendar className="w-3.5 h-3.5 text-purple-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{event.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {event.startedAt ? formatDate(event.startedAt) : "No date"}
                                      {event.locationLabel ? ` · ${event.locationLabel}` : ""}
                                    </p>
                                  </div>
                                </div>
                                {exportEventMutation.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                )}
                              </button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {contactsForTimeline.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-medium text-muted-foreground px-1 pt-2">Timeline</h4>
                        <Card>
                          <CardContent className="p-0 divide-y divide-border/50">
                            {contactsForTimeline.slice(0, 15).map((contact: any) => (
                              <button
                                key={contact.id}
                                className="w-full p-3 flex items-center justify-between gap-3 text-left hover-elevate"
                                onClick={() => {
                                  setSelectedContactId(contact.id);
                                  setSelectedTimelineIds([]);
                                  setExportView("timeline-select");
                                }}
                                data-testid={`button-salesforce-timeline-${contact.id}`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {contact.fullName || contact.email}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {contact.companyName || contact.email}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                              </button>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </>
              )}

              {exportView === "timeline-select" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setExportView("main");
                        setSelectedContactId(null);
                        setSelectedTimelineIds([]);
                      }}
                      data-testid="button-sf-timeline-back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h3 className="text-sm font-semibold">Select Timeline Entries</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedTimelineIds.length} selected
                      </p>
                    </div>
                  </div>

                  {timelineEvents.length > 0 && (
                    <div className="flex items-center justify-between gap-2 px-1">
                      <button
                        className="text-xs text-primary font-medium"
                        onClick={selectAllTimeline}
                        data-testid="button-sf-timeline-select-all"
                      >
                        {selectedTimelineIds.length === timelineEvents.length ? "Deselect All" : "Select All"}
                      </button>
                      <Badge variant="secondary">
                        {timelineEvents.length} entries
                      </Badge>
                    </div>
                  )}

                  <Card>
                    <CardContent className="p-0 divide-y divide-border/50 max-h-[40vh] overflow-y-auto">
                      {timelineEvents.length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-sm text-muted-foreground">No timeline entries found</p>
                        </div>
                      ) : (
                        timelineEvents.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => toggleTimelineId(entry.id)}
                            className="flex items-start gap-3 p-3 cursor-pointer hover-elevate text-left w-full"
                            data-testid={`checkbox-sf-timeline-${entry.id}`}
                          >
                            <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                              selectedTimelineIds.includes(entry.id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input"
                            }`}>
                              {selectedTimelineIds.includes(entry.id) && (
                                <Check className="w-3 h-3" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-[10px]">
                                  {formatTimelineType(entry.type)}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDate(entry.eventAt)}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 line-clamp-2">{entry.summary}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {selectedTimelineIds.length > 0 && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => exportTimelineMutation.mutate()}
                      disabled={exportTimelineMutation.isPending}
                      data-testid="button-salesforce-export-timeline"
                    >
                      {exportTimelineMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Export {selectedTimelineIds.length} Entries
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
