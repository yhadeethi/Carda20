import { useMemo } from "react";
import {
  Bell,
  TrendingUp,
  UserPlus,
  AlertCircle,
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
  onViewCompanies: () => void;
  onViewDataQuality: () => void;
  onSelectContact?: (contact: UnifiedContact, action?: "followup") => void;
};

export function HomeScoreboard({
  refreshKey,
  onCreateContact,
  onViewReminders,
  onViewCompanies,
  onViewDataQuality,
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Reminders
        </h2>
        {counts.remindersCount > 0 ? (
          <button
            onClick={onViewReminders}
            className="w-full rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Bell className="w-5 h-5 text-white" />
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
          <div
            className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Follow-ups
          </h2>
          {dueFollowUps.length > 3 && (
            <button
              onClick={onViewCompanies}
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
                    Follow up with {contact.firstName} {contact.lastName}
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent captures
          </h2>
          {newCaptures.length > 3 && (
            <button
              onClick={onViewCompanies}
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
                    {contact.firstName} {contact.lastName}
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

      {/* Weekly Activity - Side by side cards */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Weekly activity
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Contacts Scanned */}
          <button
            onClick={onViewCompanies}
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </div>
            <div className="text-3xl font-bold tracking-tight">{counts.recentScans}</div>
            <div className="text-xs text-muted-foreground mt-1">Contacts scanned</div>
          </button>

          {/* New Companies */}
          <button
            onClick={onViewCompanies}
            className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-purple-500" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </div>
            <div className="text-3xl font-bold tracking-tight">{insights.companiesCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Companies</div>
          </button>
        </div>
      </section>

      {/* Data Quality */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Data quality
        </h2>
        {insights.missingFieldsCount > 0 ? (
          <button
            onClick={onViewDataQuality}
            className="w-full rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/5 hover:border-orange-500/20 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {insights.missingFieldsCount} field{insights.missingFieldsCount !== 1 ? 's' : ''} need attention
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tap to review contacts
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
            </div>

            {insights.dataQualityBreakdown && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 pt-4 border-t border-border/30 text-xs">
                {insights.dataQualityBreakdown.missingCompany > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing company</span>
                    <span className="font-medium tabular-nums">{insights.dataQualityBreakdown.missingCompany}</span>
                  </div>
                )}
                {insights.dataQualityBreakdown.missingTitle > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing title</span>
                    <span className="font-medium tabular-nums">{insights.dataQualityBreakdown.missingTitle}</span>
                  </div>
                )}
                {insights.dataQualityBreakdown.missingEmail > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing email</span>
                    <span className="font-medium tabular-nums">{insights.dataQualityBreakdown.missingEmail}</span>
                  </div>
                )}
                {insights.dataQualityBreakdown.missingPhone > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing phone</span>
                    <span className="font-medium tabular-nums">{insights.dataQualityBreakdown.missingPhone}</span>
                  </div>
                )}
              </div>
            )}
          </button>
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
                <div className="text-sm font-medium text-green-600 dark:text-green-400">All good</div>
                <div className="text-xs text-muted-foreground/70">Your contacts are complete</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Create Contact Button - at the bottom */}
      <section className="pt-2">
        <Button
          onClick={onCreateContact}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 active:scale-[0.98]"
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
