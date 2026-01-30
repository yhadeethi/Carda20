import { useMemo } from "react";
import {
  Bell,
  UserPlus,
  Building2,
  ChevronRight,
  Users,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";

type HomeScoreboardProps = {
  refreshKey: number;
  onCreateContact: () => void;
  onViewReminders: () => void;
  onViewPeople: () => void;
  onViewCompanies: () => void;
  onSelectContact?: (contact: UnifiedContact, action?: "followup") => void;
};

export function HomeScoreboard({
  refreshKey,
  onCreateContact,
  onViewReminders,
  onViewPeople,
  onViewCompanies,
  onSelectContact,
}: HomeScoreboardProps) {
  const { contacts } = useUnifiedContacts();
  const { counts, insights, dueFollowUps, newCaptures } = useScoreboard(contacts, refreshKey);

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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header - Apple Calendar style */}
      <div className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        <p className="text-base text-muted-foreground mt-0.5">{today.full}</p>
        <p className="text-sm text-muted-foreground/70 mt-1">{statsLine}</p>
      </div>

      {/* Reminders Section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">
          Reminders
        </h2>
        {counts.remindersCount > 0 ? (
          <button
            onClick={onViewReminders}
            className="w-full rounded-2xl glass p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                  <Bell className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {counts.remindersCount} active reminder{counts.remindersCount !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tap to view all
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
            </div>
          </button>
        ) : (
          <div className="rounded-2xl glass-subtle p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                <Bell className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">No reminders set</div>
                <div className="text-xs text-muted-foreground/70">Add from a contact</div>
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
          <div className="rounded-2xl glass divide-y divide-border/50 overflow-hidden">
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
          <div className="rounded-2xl glass-subtle p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-accent" />
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
          <div className="rounded-2xl glass divide-y divide-border/50 overflow-hidden">
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
          <div className="rounded-2xl glass-subtle p-4">
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
          Weekly activity
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Contacts Scanned */}
          <button
            onClick={onViewPeople}
            className="group rounded-2xl glass p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
                <Users className="w-5 h-5 text-primary transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{counts.recentScans}</div>
                <div className="text-xs text-muted-foreground">Contacts scanned</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary/50 group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Companies */}
          <button
            onClick={onViewCompanies}
            className="group rounded-2xl glass p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
                <Building2 className="w-5 h-5 text-secondary-foreground transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{insights.companiesCount}</div>
                <div className="text-xs text-muted-foreground">Companies</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary/50 group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>
      </section>

      {/* Create Contact Button - at the bottom */}
      <section className="pt-2">
        <Button
          onClick={onCreateContact}
          className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 active:scale-[0.98]"
          size="lg"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Create contact
        </Button>
        <p className="text-xs text-center text-muted-foreground/60 mt-2">
          Manual entry (not scan)
        </p>
      </section>
    </div>
  );
}
