import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Search,
  Sparkles,
  Users,
  CheckCircle2,
  Check,
  CheckSquare,
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
import { useTasksAndReminders } from "@/hooks/useTasksAndReminders";
import { completeReminder } from "@/lib/contacts/storage";
import { getCompanies } from "@/lib/companiesStorage";
import { RecentCompanies } from "@/components/home/RecentCompanies";

type HomeScoreboardProps = {
  refreshKey: number;
  onStartScan: () => void;
  onCreateContact: () => void;
  onViewPeople: () => void;
  onViewCompanies: () => void;
  onSelectContact?: (contact: UnifiedContact, action?: "followup") => void;
  onSelectCompany?: (companyId: string, tab?: "contacts" | "orgmap" | "notes") => void;
  onRefresh?: () => void;
  onSelectContactById?: (id: string) => void;
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

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
  onSelectContactById,
}: HomeScoreboardProps) {
  const { contacts } = useUnifiedContacts();
  const {
    counts,
    dueFollowUps,
    newCaptures,
    activeReminders,
    weeklyCapturesSeries,
    recentCompanies,
    suggestedCompany,
  } = useScoreboard(contacts, refreshKey);

  const {
    overdueTasks,
    todayTasks,
    upcomingTasks,
    todayReminders,
    upcomingReminders,
    totalDueCount,
    refresh: refreshTasks,
  } = useTasksAndReminders();

  const [inboxOpen, setInboxOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<"reminders" | "followups">("reminders");
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);

  // Refresh task/reminder data when refreshKey changes
  useEffect(() => {
    refreshTasks();
  }, [refreshKey, refreshTasks]);

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

  // Bell badge includes task due count (overdue + today tasks/reminders)
  const notificationCount = counts.remindersCount + counts.dueFollowUps + totalDueCount;

  const statsLine = useMemo(() => {
    const parts: string[] = [];
    if (counts.remindersCount > 0) parts.push(`${counts.remindersCount} reminder${counts.remindersCount !== 1 ? "s" : ""}`);
    if (counts.dueFollowUps > 0) parts.push(`${counts.dueFollowUps} follow-up${counts.dueFollowUps !== 1 ? "s" : ""}`);
    if (counts.recentScans > 0) parts.push(`${counts.recentScans} scanned (7d)`);
    return parts.length ? parts.join(" · ") : "No activity yet";
  }, [counts]);

  const companiesForSearch = useMemo(() => {
    try {
      return getCompanies();
    } catch {
      return [];
    }
  }, [refreshKey]);

  // Upcoming this week: merge tasks and reminders, group by day
  const upcomingByDay = useMemo(() => {
    const items: Array<{ dateStr: string; label: string; dayKey: string; contactId: string; contactName: string; type: "task" | "reminder" }> = [];
    for (const { task, contact } of upcomingTasks) {
      items.push({ dateStr: task.dueAt!, label: task.title, dayKey: getDayLabel(task.dueAt!), contactId: contact.id, contactName: contact.fullName, type: "task" });
    }
    for (const { reminder, contact } of upcomingReminders) {
      items.push({ dateStr: reminder.remindAt, label: reminder.label, dayKey: getDayLabel(reminder.remindAt), contactId: contact.id, contactName: contact.fullName, type: "reminder" });
    }
    items.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

    // Group by dayKey
    const grouped: Array<{ dayKey: string; items: typeof items }> = [];
    for (const item of items) {
      const existing = grouped.find((g) => g.dayKey === item.dayKey);
      if (existing) {
        existing.items.push(item);
      } else {
        grouped.push({ dayKey: item.dayKey, items: [item] });
      }
    }
    return grouped;
  }, [upcomingTasks, upcomingReminders]);

  const hasAnythingDue = overdueTasks.length > 0 || todayTasks.length > 0 || todayReminders.length > 0;
  const hasOverdue = overdueTasks.length > 0;
  const dueTodayCount = overdueTasks.length + todayTasks.length + todayReminders.length;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          <p className="text-base text-muted-foreground mt-0.5">{today.full}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{statsLine}</p>
        </div>
        <button
          onClick={() => {
            setInboxTab("reminders");
            setInboxOpen(true);
          }}
          className="relative rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-2.5 hover:bg-card/90 transition-colors"
          style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
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
        className="w-full rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-200 hover:bg-card/90"
        style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Search</div>
              <div className="text-xs text-muted-foreground truncate">Contacts or companies</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground/70 border border-border/60 rounded-lg px-2 py-1 shrink-0">
            ⌘K
          </div>
        </div>
      </button>

      {/* Due Today / Overdue section */}
      {hasAnythingDue ? (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className={`text-sm font-medium ${hasOverdue ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
              {hasOverdue ? "Overdue" : "Due Today"}
            </h2>
            <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">
              {dueTodayCount}
            </span>
          </div>
          <div
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 divide-y divide-border/50 overflow-hidden"
            style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
          >
            {[...overdueTasks, ...todayTasks].slice(0, 5).map(({ task, contact }) => (
              <button
                key={task.id}
                onClick={() => onSelectContactById?.(contact.id)}
                className="w-full p-3 text-left flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <CheckSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{task.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{contact.fullName}</div>
                </div>
                {task.dueAt && (
                  <span className={`text-xs shrink-0 font-medium ${new Date(task.dueAt).getTime() < Date.now() ? "text-red-400 dark:text-red-400" : "text-muted-foreground"}`}>
                    {formatRelativeDay(task.dueAt)}
                  </span>
                )}
              </button>
            ))}
            {todayReminders.slice(0, 5).map(({ reminder, contact }) => (
              <button
                key={reminder.id}
                onClick={() => onSelectContactById?.(contact.id)}
                className="w-full p-3 text-left flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <Bell className="w-4 h-4 shrink-0 text-orange-500 dark:text-orange-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{reminder.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{contact.fullName}</div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatRelativeDay(reminder.remindAt)}</span>
              </button>
            ))}
            {dueTodayCount > 5 && (
              <button
                onClick={() => { setInboxTab("reminders"); setInboxOpen(true); }}
                className="w-full p-3 text-center text-xs font-medium text-primary hover:bg-muted/20 transition-colors"
              >
                View all {dueTodayCount} items
              </button>
            )}
          </div>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground/60 px-1">All clear for today ✓</p>
      )}

      {/* Upcoming This Week */}
      {upcomingByDay.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-medium text-muted-foreground">Upcoming this week</h2>
            {upcomingByDay.length > 1 && (
              <button
                onClick={() => setUpcomingExpanded(!upcomingExpanded)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {upcomingExpanded ? "Show less" : `Show all`}
              </button>
            )}
          </div>
          <div
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 overflow-hidden"
            style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
          >
            {(upcomingExpanded ? upcomingByDay : upcomingByDay.slice(0, 2)).map((group, gi) => (
              <div key={group.dayKey} className={gi > 0 ? "border-t border-border/50" : ""}>
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.dayKey}</span>
                </div>
                {group.items.map((item, ii) => (
                  <button
                    key={`${item.contactId}-${item.label}-${ii}`}
                    onClick={() => onSelectContactById?.(item.contactId)}
                    className="w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  >
                    {item.type === "task" ? (
                      <CheckSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Bell className="w-3.5 h-3.5 shrink-0 text-orange-500 dark:text-orange-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.contactName}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weekly chart */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Weekly captures</h2>
        <div
          className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4"
          style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCapturesSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(value: any) => [value, "captures"]}
                  labelFormatter={(label: any) => String(label)}
                />
                <Bar dataKey="captures" radius={[8, 8, 8, 8]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground/70">Tap scan to keep the streak going.</div>
        </div>
      </section>

      {/* Recent companies (two-tap: suggested + recent list) */}
      {onSelectCompany && (
        <RecentCompanies
          companies={recentCompanies}
          suggestedCompany={suggestedCompany}
          onSelectCompany={onSelectCompany}
          onViewAllCompanies={onViewCompanies}
        />
      )}

      {/* Recent captures — only shown when there ARE recent captures */}
      {newCaptures.length > 0 && (
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
          <div
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 divide-y divide-border/50 overflow-hidden"
            style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
          >
            {newCaptures.slice(0, 3).map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact?.(contact)}
                className="w-full p-4 text-left transition-all duration-200 hover:bg-muted/30 active:bg-muted/50 flex items-center justify-between group"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{contact.name || "Unknown contact"}</div>
                  <div className="text-xs text-muted-foreground truncate">{contact.company || "No company"}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Primary actions */}
      <section className="pt-2 space-y-3">
        <Button
          onClick={onStartScan}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 active:scale-[0.98]"
          size="lg"
        >
          <Users className="w-5 h-5 mr-2" />
          Scan a business card
        </Button>
        <Button
          onClick={onCreateContact}
          variant="secondary"
          className="w-full h-12 rounded-2xl"
          size="lg"
        >
          Create contact
        </Button>
      </section>

      {/* Inbox drawer */}
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
                            refreshTasks();
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

      {/* Search command dialog */}
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
