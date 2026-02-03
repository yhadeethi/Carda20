import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Search,
  Sparkles,
  Users,
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
    weeklyCapturesSeries,
    recentCompanies,
    suggestedCompany,
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

  const notificationCount = counts.remindersCount + counts.dueFollowUps;

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
        ) : (
          <div
            className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4"
            style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
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
                        <div className="text-xs text-muted-foreground/70">You’re caught up</div>
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
