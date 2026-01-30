import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Search,
  UserPlus,
  Building2,
  ChevronRight,
  Users,
  Sparkles,
  CheckCircle2,
  Clock,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";
import { completeReminder } from "@/lib/contacts/storage";
import { getCompanies } from "@/lib/companiesStorage";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

type HomeScoreboardProps = {
  refreshKey: number;
  onRefresh?: () => void;
  onScan: () => void;
  onCreateContact: () => void;
  onViewPeople: () => void;
  onViewCompanies: () => void;
  onSelectCompany?: (companyId: string) => void;
  onSelectContact?: (contact: UnifiedContact, action?: "followup") => void;
};

export function HomeScoreboard({
  refreshKey,
  onRefresh,
  onScan,
  onCreateContact,
  onViewPeople,
  onViewCompanies,
  onSelectCompany,
  onSelectContact,
}: HomeScoreboardProps) {
  const { contacts } = useUnifiedContacts();
  const { counts, insights, dueFollowUps, newCaptures, weeklyCapturesSeries } = useScoreboard(contacts, refreshKey);

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<"reminders" | "followups">("reminders");
  const [commandOpen, setCommandOpen] = useState(false);
  const [localBump, setLocalBump] = useState(0);

  const inboxCount = counts.remindersCount + counts.dueFollowUps;

  type ReminderRow = {
    contactId: string;
    contactName: string;
    reminderId: string;
    label: string;
    remindAt: string;
    isOverdue: boolean;
  };

  const reminders = useMemo<ReminderRow[]>(() => {
    const now = new Date();
    const rows: ReminderRow[] = [];
    for (const c of contacts) {
      const name = c.name || "Unknown";
      for (const r of c.reminders || []) {
        if (r.done) continue;
        const at = new Date(r.remindAt);
        rows.push({
          contactId: c.id,
          contactName: name,
          reminderId: r.id,
          label: r.label,
          remindAt: r.remindAt,
          isOverdue: !Number.isNaN(at.getTime()) && at.getTime() < now.getTime(),
        });
      }
    }

    rows.sort((a, b) => {
      const ta = new Date(a.remindAt).getTime();
      const tb = new Date(b.remindAt).getTime();
      return ta - tb;
    });

    return rows.slice(0, 50);
  }, [contacts, refreshKey, localBump]);

  const contactById = useMemo(() => {
    const m = new Map<string, UnifiedContact>();
    contacts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contacts]);

  const companies = useMemo(() => {
    try {
      return getCompanies();
    } catch {
      return [];
    }
  }, [refreshKey, localBump]);

  // Format today's date - Apple style
  const today = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
    const day = now.getDate();
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    return { weekday, day, month, full: `${weekday} ${day} ${month}` };
  }, []);

  // Stats summary
  const statsLine = useMemo(() => {
    const parts: string[] = [];
    if (counts.remindersCount > 0) {
      parts.push(`${counts.remindersCount} reminder${counts.remindersCount !== 1 ? 's' : ''}`);
    }
    if (counts.dueFollowUps > 0) {
      parts.push(`${counts.dueFollowUps} follow-up${counts.dueFollowUps !== 1 ? 's' : ''}`);
    }
    if (counts.recentScans > 0) {
      parts.push(`${counts.recentScans} scanned (7d)`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'No activity yet';
  }, [counts]);

  // Format relative time
  const formatRelativeTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const openInbox = (tab: "reminders" | "followups") => {
    setInboxTab(tab);
    setInboxOpen(true);
  };

  const handleCompleteReminder = async (contactId: string, reminderId: string) => {
    try {
      await completeReminder(contactId, reminderId);
    } finally {
      // Ensure UI refresh in the same tab (localStorage storage events won't fire here)
      setLocalBump((v) => v + 1);
      onRefresh?.();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isCmdK) return;
      e.preventDefault();
      setCommandOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header - Apple Calendar style */}
      <div className="pt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Today</h1>
            <p className="text-base text-muted-foreground mt-0.5">{today.full}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">{statsLine}</p>
          </div>

          <button
            onClick={() => openInbox(inboxTab)}
            className="relative h-10 w-10 rounded-full bg-card/80 backdrop-blur-xl border border-border/50 flex items-center justify-center hover:bg-card/90 transition"
            aria-label="Notifications"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <Bell className="w-5 h-5 text-foreground/80" />
            {inboxCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center justify-center shadow">
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick search */}
        <button
          onClick={() => setCommandOpen(true)}
          className="w-full mt-4 rounded-2xl bg-card/70 backdrop-blur-xl border border-border/40 px-4 py-3 text-left flex items-center gap-3 hover:bg-card/80 transition"
          style={{
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
          data-testid="home-search"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search contacts or companies…</span>
          <span className="ml-auto text-xs text-muted-foreground/60">⌘K</span>
        </button>
      </div>

      {/* Inbox Preview */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Inbox</h2>
        {inboxCount > 0 ? (
          <button
            onClick={() => openInbox(counts.remindersCount > 0 ? "reminders" : "followups")}
            className="w-full rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {counts.remindersCount} reminder{counts.remindersCount !== 1 ? "s" : ""} · {counts.dueFollowUps} follow-up{counts.dueFollowUps !== 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {reminders[0]
                      ? `Next: ${reminders[0].label} (${reminders[0].contactName})`
                      : "Tap to view"}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
            </div>
          </button>
        ) : (
          <div
            className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Nothing due</div>
                <div className="text-xs text-muted-foreground/70">Reminders and follow-ups will show up here</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Follow-ups Section */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            Follow-ups
          </h2>
          {dueFollowUps.length > 3 && (
            <button
              onClick={onViewPeople}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all
            </button>
          )}
        </div>

        {dueFollowUps.length > 0 ? (
          <div
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 divide-y divide-border/50 overflow-hidden"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            {dueFollowUps.slice(0, 3).map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact?.(contact, "followup")}
                className="w-full p-4 text-left transition-all duration-200 hover:bg-muted/30 active:bg-muted/50 flex items-center justify-between group"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {contact.name || 'Unknown contact'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {contact.company || 'No company'}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0 ml-2" />
              </button>
            ))}
          </div>
        ) : (
          <div
            className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">All caught up</div>
                <div className="text-xs text-muted-foreground/70">No pending follow-ups</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recent Captures Section */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            Recent captures
          </h2>
          {newCaptures.length > 3 && (
            <button
              onClick={onViewPeople}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all
            </button>
          )}
        </div>

        {newCaptures.length > 0 ? (
          <div
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 divide-y divide-border/50 overflow-hidden"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            {newCaptures.slice(0, 3).map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact?.(contact)}
                className="w-full p-4 text-left transition-all duration-200 hover:bg-muted/30 active:bg-muted/50 flex items-center justify-between group"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {contact.name || 'Unknown contact'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {contact.company || 'No company'} · {formatRelativeTime(contact.createdAt)}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0 ml-2" />
              </button>
            ))}
          </div>
        ) : (
          <div
            className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">No recent captures</div>
                <div className="text-xs text-muted-foreground/70">Scan a business card to get started</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Weekly Activity */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">
          Weekly captures
        </h2>
        <div
          className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4"
          style={{
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-semibold">{counts.recentScans} captures (7d)</div>
            </div>
            <button
              onClick={onViewPeople}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View
            </button>
          </div>

          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCapturesSeries} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                  formatter={(value: unknown) => [value as number, "Captures"]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={onViewCompanies}
              className="group rounded-2xl bg-card/70 border border-border/40 p-3 text-left hover:bg-card/80 transition"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Companies</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">{insights.companiesCount}</div>
            </button>

            <button
              onClick={() => openInbox("followups")}
              className="group rounded-2xl bg-card/70 border border-border/40 p-3 text-left hover:bg-card/80 transition"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Due follow-ups</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">{counts.dueFollowUps}</div>
            </button>
          </div>
        </div>
      </section>

      {/* Primary action */}
      <section className="pt-2">
        <Button
          onClick={onScan}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 active:scale-[0.98]"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          Scan a business card
        </Button>

        <div className="mt-3">
          <Button
            onClick={onCreateContact}
            variant="secondary"
            className="w-full h-11 rounded-2xl"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Create contact
          </Button>
          <p className="text-xs text-center text-muted-foreground/60 mt-2">Manual entry</p>
        </div>
      </section>

      {/* Notifications drawer */}
      <Drawer open={inboxOpen} onOpenChange={setInboxOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Inbox</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-4">
            <Tabs value={inboxTab} onValueChange={(v) => setInboxTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="reminders" className="flex-1">
                  Reminders ({counts.remindersCount})
                </TabsTrigger>
                <TabsTrigger value="followups" className="flex-1">
                  Follow-ups ({counts.dueFollowUps})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reminders" className="mt-4">
                {reminders.length === 0 ? (
                  <div className="rounded-2xl bg-muted/30 border border-border/30 p-4 text-sm text-muted-foreground">
                    No active reminders.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((item) => {
                      const contact = contactById.get(item.contactId);
                      return (
                        <div
                          key={`${item.contactId}:${item.reminderId}`}
                          className="rounded-2xl bg-card/80 border border-border/40 p-3 flex items-center gap-3"
                        >
                          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Bell className="w-5 h-5 text-blue-500" />
                          </div>
                          <button
                            className="flex-1 min-w-0 text-left"
                            onClick={() => {
                              if (contact) onSelectContact?.(contact);
                              setInboxOpen(false);
                            }}
                            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                          >
                            <div className="text-sm font-semibold truncate">{item.label}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.contactName} · {new Date(item.remindAt).toLocaleString()}{item.isOverdue ? " · Overdue" : ""}
                            </div>
                          </button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCompleteReminder(item.contactId, item.reminderId)}
                          >
                            Done
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="followups" className="mt-4">
                {dueFollowUps.length === 0 ? (
                  <div className="rounded-2xl bg-muted/30 border border-border/30 p-4 text-sm text-muted-foreground">
                    No follow-ups due.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dueFollowUps.map((contact) => (
                      <div
                        key={contact.id}
                        className="rounded-2xl bg-card/80 border border-border/40 p-3 flex items-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-green-600" />
                        </div>
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => {
                            onSelectContact?.(contact, "followup");
                            setInboxOpen(false);
                          }}
                          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                        >
                          <div className="text-sm font-semibold truncate">{contact.name || "Unknown contact"}</div>
                          <div className="text-xs text-muted-foreground truncate">{contact.company || "No company"}</div>
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Command palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search contacts or companies…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          <CommandGroup heading="Contacts">
            {contacts.slice(0, 250).map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.company} ${c.email}`}
                onSelect={() => {
                  setCommandOpen(false);
                  onSelectContact?.(c);
                }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.company || "No company"}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Companies">
            {companies.slice(0, 250).map((co) => (
              <CommandItem
                key={co.id}
                value={`${co.name} ${co.domain || ""}`}
                onSelect={() => {
                  setCommandOpen(false);
                  if (onSelectCompany) {
                    onSelectCompany(co.id);
                  } else {
                    onViewCompanies();
                  }
                }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{co.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{co.domain || ""}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
