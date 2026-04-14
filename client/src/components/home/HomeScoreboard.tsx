import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Camera,
  ChevronRight,
  Flame,
  Search,
  Sparkles,
  CheckCircle2,
  Check,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";
import { useScoreboard } from "@/hooks/useScoreboard";
import { completeReminder, completeTask } from "@/lib/contacts/storage";
import { Checkbox } from "@/components/ui/checkbox";
import { getCompanies } from "@/lib/companiesStorage";
import { CalendarTeaser } from "@/components/home/CalendarTeaser";

type HomeScoreboardProps = {
  refreshKey: number;
  onStartScan: () => void;
  onCreateContact: () => void;
  onViewPeople: () => void;
  onViewCompanies: () => void;
  onSelectContact?: (contact: UnifiedContact, action?: "followup") => void;
  onSelectCompany?: (companyId: string, tab?: "contacts" | "orgmap" | "notes") => void;
  onRefresh?: () => void;
};

function formatRelativeDay(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  return `In ${diffDays}d`;
}

function getTaskAccentColor(dueAt?: string | null): string {
  if (!dueAt) return "bg-blue-400";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(dueAt);
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  if (dueStart < todayStart) return "bg-red-500";
  if (dueStart === todayStart) return "bg-amber-400";
  return "bg-blue-400";
}

export function HomeScoreboard({
  refreshKey,
  onStartScan,
  onCreateContact,
  onViewPeople,
  onViewCompanies,
  onSelectContact,
  onSelectCompany,
  onRefresh,
}: HomeScoreboardProps) {
  const { contacts } = useUnifiedContacts();
  const {
    counts,
    dueFollowUps,
    newCaptures,
    activeReminders,
    pendingTasks,
    weeklyCapturesSeries,
  } = useScoreboard(contacts, refreshKey);

  const [inboxOpen, setInboxOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<"reminders" | "followups">("reminders");

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
    const day = now.getDate();
    const month = now.toLocaleDateString("en-US", { month: "short" });
    return { full: `${weekday} ${day} ${month}` };
  }, [refreshKey]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning.";
    if (h < 17) return "Good afternoon.";
    return "Good evening.";
  }, [refreshKey]);

  const notificationCount = counts.remindersCount + counts.dueFollowUps;

  const statsLine = useMemo(() => {
    const parts: string[] = [];
    if (counts.remindersCount > 0) parts.push(`${counts.remindersCount} reminder${counts.remindersCount !== 1 ? "s" : ""}`);
    if (counts.dueFollowUps > 0) parts.push(`${counts.dueFollowUps} follow-up${counts.dueFollowUps !== 1 ? "s" : ""}`);
    if (counts.recentScans > 0) parts.push(`${counts.recentScans} scanned (7d)`);
    return parts.length ? parts.join(" · ") : "";
  }, [counts]);

  const companiesForSearch = useMemo(() => {
    try {
      return getCompanies();
    } catch {
      return [];
    }
  }, [refreshKey]);

  const weeklyTotal = useMemo(
    () => weeklyCapturesSeries.reduce((sum, d) => sum + d.captures, 0),
    [weeklyCapturesSeries]
  );

  return (
    <div className="px-4 pt-2 pb-32 max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="pt-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{today.full}</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight mt-0.5">{greeting}</h1>
          {statsLine && (
            <p className="text-sm text-muted-foreground/70 mt-1">{statsLine}</p>
          )}
        </div>
        <button
          onClick={() => {
            setInboxTab("reminders");
            setInboxOpen(true);
          }}
          className="relative rounded-2xl border border-black/10 bg-white p-2.5 shadow-sm hover:bg-gray-50 transition-colors mt-1"
          aria-label="Open inbox"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </button>
      </div>

      {/* Search bar */}
      <button
        onClick={() => setSearchOpen(true)}
        className="w-full flex items-center gap-2 bg-white border border-black/10 rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:bg-gray-50/80 transition-colors"
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      >
        <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        <span className="flex-1 text-sm text-muted-foreground/50 text-left">
          Search contacts or companies…
        </span>
        <div className="text-xs text-muted-foreground/40 border border-black/10 rounded-md px-1.5 py-0.5 shrink-0">
          ⌘K
        </div>
      </button>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-black/10 p-3 shadow-sm">
          <div className="text-[11px] text-muted-foreground/60 mb-1 font-medium">Contacts</div>
          <div className="text-xl font-bold bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] bg-clip-text text-transparent">{contacts.length}</div>
        </div>
        <button
          onClick={() => { setInboxTab("followups"); setInboxOpen(true); }}
          className="bg-white rounded-xl border border-black/10 p-3 shadow-sm text-left hover:bg-gray-50/80 transition-colors active:scale-[0.98]"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="text-[11px] text-muted-foreground/60 mb-1 font-medium">Follow-ups</div>
          <div className={`text-xl font-bold ${counts.dueFollowUps > 0 ? "text-amber-500" : "text-muted-foreground/30"}`}>
            {counts.dueFollowUps}
          </div>
        </button>
        <div className="bg-white rounded-xl border border-black/10 p-3 shadow-sm">
          <div className="text-[11px] text-muted-foreground/60 mb-1 font-medium">Scanned 7d</div>
          <div className={`text-xl font-bold ${counts.recentScans > 0 ? "text-emerald-500" : "text-muted-foreground/30"}`}>
            {counts.recentScans}
          </div>
        </div>
      </div>

      {/* Calendar briefing */}
      <section>
        <CalendarTeaser meetings={[]} />
      </section>

      {/* Up next: pending tasks */}
      {pendingTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Up next</h2>
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-stretch bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden"
                data-testid={`home-task-row-${task.id}`}
              >
                <div className={`w-[3px] shrink-0 ${getTaskAccentColor(task.dueAt)}`} />
                <div className="flex items-start gap-3 p-3 flex-1 min-w-0">
                  <Checkbox
                    checked={false}
                    onCheckedChange={async () => {
                      await completeTask(task.contactId, task.id);
                      onRefresh?.();
                    }}
                    className="mt-0.5 shrink-0"
                    data-testid={`home-checkbox-task-${task.id}`}
                  />
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      const c = contacts.find((ct) => ct.id === task.contactId);
                      if (c) onSelectContact?.(c);
                    }}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  >
                    <div className="text-sm font-medium truncate">{task.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">{task.contactName}</span>
                      {task.dueAt && (
                        <>
                          <span className="text-xs text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground/70">
                            {formatRelativeDay(task.dueAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weekly chart */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-medium text-muted-foreground">Weekly captures</h2>
          {weeklyTotal > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5">
              <Flame className="w-3 h-3 text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600">{weeklyTotal} this week</span>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white border border-black/10 shadow-sm p-4">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCapturesSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4B68F5" />
                    <stop offset="100%" stopColor="#7B5CF0" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(value: any) => [value, "captures"]}
                  labelFormatter={(label: any) => String(label)}
                />
                <Bar dataKey="captures" radius={[8, 8, 8, 8]} fill="url(#barGradient)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground/70">Tap scan to keep the streak going.</div>
        </div>
      </section>

      {/* Recent captures */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-medium text-muted-foreground">Recent captures</h2>
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
          <div className="space-y-2">
            {newCaptures.slice(0, 3).map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact?.(contact)}
                className="w-full bg-white rounded-xl border border-black/10 shadow-sm p-3 text-left transition-all duration-200 hover:bg-gray-50/80 active:scale-[0.99] flex items-center justify-between gap-2"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{contact.name || "Unknown contact"}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4B68F5]/10 border border-[#4B68F5]/20 shrink-0">
                      <span className="bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] bg-clip-text text-transparent">New</span>
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {contact.company || "No company"}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-black/10 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center">
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

      {/* Primary actions */}
      <section className="pt-2 space-y-3">
        <Button
          onClick={onStartScan}
          variant="gradient"
          className="w-full rounded-2xl"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          Scan a business card
        </Button>
        <Button
          onClick={onCreateContact}
          variant="outline"
          className="w-full h-12 rounded-2xl bg-white border-black/10 text-foreground hover:bg-gray-50 shadow-sm"
          size="lg"
        >
          Create contact
        </Button>
      </section>

      {/* Inbox drawer — internals unchanged */}
      <Sheet open={inboxOpen} onOpenChange={setInboxOpen}>
        <SheetContent side="bottom" className="p-0">
          <div className="p-4 pb-2">
            <SheetHeader>
              <SheetTitle>Inbox</SheetTitle>
            </SheetHeader>
          </div>
          <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]">
            <Tabs value={inboxTab} onValueChange={(v) => setInboxTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="reminders" className="flex-1">
                  Reminders ({counts.remindersCount})
                </TabsTrigger>
                <TabsTrigger value="followups" className="flex-1">
                  Follow-ups ({counts.dueFollowUps})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reminders" className="mt-3">
                {activeReminders.length > 0 ? (
                  <div className="rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
                    {activeReminders.slice(0, 20).map(({ contact, reminder }) => (
                      <div key={`${contact.id}:${reminder.id}`} className="p-4 flex items-center justify-between gap-3">
                        <button
                          onClick={() => {
                            setInboxOpen(false);
                            onSelectContact?.(contact);
                          }}
                          className="text-left min-w-0 flex-1"
                        >
                          <div className="text-sm font-semibold truncate">{contact.name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {reminder.label} · {formatRelativeDay(reminder.remindAt)}
                          </div>
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          onClick={async () => {
                            await completeReminder(contact.id, reminder.id);
                            onRefresh?.();
                          }}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Done
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-card/60 border border-border/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">No reminders</div>
                        <div className="text-xs text-muted-foreground/70">Add from a contact</div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="followups" className="mt-3">
                {dueFollowUps.length > 0 ? (
                  <div className="rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
                    {dueFollowUps.slice(0, 20).map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setInboxOpen(false);
                          onSelectContact?.(contact, "followup");
                        }}
                        className="w-full p-4 text-left hover:bg-muted/30 transition-colors flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{contact.name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">{contact.company || "No company"}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-card/60 border border-border/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">No follow-ups due</div>
                        <div className="text-xs text-muted-foreground/70">You're caught up</div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Search command dialog — internals unchanged */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search contacts or companies…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Contacts">
            {contacts.slice(0, 200).map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.company} ${c.email}`}
                onSelect={() => {
                  setSearchOpen(false);
                  onSelectContact?.(c);
                }}
              >
                <span className="font-medium">{c.name || "Unknown"}</span>
                <span className="ml-2 text-xs text-muted-foreground truncate">{c.company || ""}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Companies">
            {companiesForSearch.slice(0, 200).map((co) => (
              <CommandItem
                key={co.id}
                value={`${co.name} ${co.domain || ""}`}
                onSelect={() => {
                  setSearchOpen(false);
                  if (onSelectCompany) onSelectCompany(co.id, "contacts");
                  else onViewCompanies();
                }}
              >
                <span className="font-medium">{co.name}</span>
                {co.domain && <span className="ml-2 text-xs text-muted-foreground truncate">{co.domain}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
