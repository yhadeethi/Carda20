// Home scoreboard with recent companies
import { useMemo, useState, useCallback } from "react";
import {
  Bell,
  UserPlus,
  Building2,
  ChevronRight,
  Users,
  Sparkles,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";

interface CompanyOverview {
  id: string;
  name: string;
  domain?: string;
  contactCount: number;
  lastActivity?: string;
}

type HomeScoreboardProps = {
  refreshKey: number;
  onCreateContact: () => void;
  onViewReminders: () => void;
  onViewPeople: () => void;
  onViewCompanies: () => void;
  onSelectContact?: (contact: UnifiedContact, action?: "followup") => void;
  onSelectCompany?: (companyId: string) => void;
};

export function HomeScoreboard({
  refreshKey,
  onCreateContact,
  onViewReminders,
  onViewPeople,
  onViewCompanies,
  onSelectContact,
  onSelectCompany,
}: HomeScoreboardProps) {
  const { contacts } = useUnifiedContacts();
  const { counts, insights, dueFollowUps, newCaptures } = useScoreboard(contacts, refreshKey);

  // Selected company for inline overview
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Compute recent companies from contacts
  const recentCompanies = useMemo(() => {
    const companyMap = new Map<string, CompanyOverview>();

    contacts.forEach((contact) => {
      const companyName = contact.company?.trim();
      if (!companyName) return;

      const companyId = contact.companyId || companyName.toLowerCase().replace(/\s+/g, '-');
      const existing = companyMap.get(companyId);

      if (existing) {
        existing.contactCount++;
        // Update last activity if this contact is newer
        if (contact.createdAt && (!existing.lastActivity || contact.createdAt > existing.lastActivity)) {
          existing.lastActivity = contact.createdAt;
        }
      } else {
        // Extract domain from email
        let domain: string | undefined;
        if (contact.email) {
          const match = contact.email.match(/@([^@]+)$/);
          if (match && !match[1].includes('gmail') && !match[1].includes('yahoo') && !match[1].includes('hotmail')) {
            domain = match[1];
          }
        }

        companyMap.set(companyId, {
          id: companyId,
          name: companyName,
          domain,
          contactCount: 1,
          lastActivity: contact.createdAt,
        });
      }
    });

    // Sort by last activity and take top 5
    return Array.from(companyMap.values())
      .sort((a, b) => {
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      })
      .slice(0, 5);
  }, [contacts]);

  // Get selected company overview
  const selectedCompanyOverview = useMemo(() => {
    if (!selectedCompanyId) return null;
    return recentCompanies.find((c) => c.id === selectedCompanyId) || null;
  }, [selectedCompanyId, recentCompanies]);

  // Handle company chip click
  const handleCompanyClick = useCallback((companyId: string) => {
    if (selectedCompanyId === companyId) {
      // Second tap - navigate to company page
      onSelectCompany?.(companyId);
      setSelectedCompanyId(null);
    } else {
      // First tap - select and show overview
      setSelectedCompanyId(companyId);
    }
  }, [selectedCompanyId, onSelectCompany]);

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
          Weekly activity
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Contacts Scanned */}
          <button
            onClick={onViewPeople}
            className="group rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/30 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-500/20">
                <Users className="w-5 h-5 text-blue-500 transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{counts.recentScans}</div>
                <div className="text-xs text-muted-foreground">Contacts scanned</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 transition-all duration-200 group-hover:text-blue-500/50 group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Companies */}
          <button
            onClick={onViewCompanies}
            className="group rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4 text-left transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/30 hover:bg-card/90 active:scale-[0.98]"
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-purple-500/20">
                <Building2 className="w-5 h-5 text-purple-500 transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{insights.companiesCount}</div>
                <div className="text-xs text-muted-foreground">Companies</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 transition-all duration-200 group-hover:text-purple-500/50 group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>
      </section>

      {/* Recent Companies Section */}
      {recentCompanies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent companies
            </h2>
            <button
              onClick={onViewCompanies}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all
            </button>
          </div>

          {/* Company Chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {recentCompanies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleCompanyClick(company.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all duration-200 active:scale-95 ${
                  selectedCompanyId === company.id
                    ? "bg-primary/10 border-primary/30 text-primary ring-2 ring-primary/20"
                    : "bg-card/80 border-border/50 text-foreground hover:bg-card hover:border-primary/20"
                }`}
                style={{
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)"
                }}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{company.name}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-full">
                  {company.contactCount}
                </Badge>
              </button>
            ))}
          </div>

          {/* Inline Company Overview Panel */}
          {selectedCompanyOverview && (
            <div
              className="rounded-2xl bg-card/80 backdrop-blur-xl border border-primary/20 p-4 transition-all duration-300"
              style={{
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)"
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-base">{selectedCompanyOverview.name}</h3>
                  {selectedCompanyOverview.domain && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Globe className="w-3 h-3" />
                      <span>{selectedCompanyOverview.domain}</span>
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0">
                  <Users className="w-3 h-3 mr-1" />
                  {selectedCompanyOverview.contactCount} contact{selectedCompanyOverview.contactCount !== 1 ? 's' : ''}
                </Badge>
              </div>

              {selectedCompanyOverview.lastActivity && (
                <p className="text-xs text-muted-foreground mb-3">
                  Last activity: {formatRelativeTime(selectedCompanyOverview.lastActivity)}
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  onSelectCompany?.(selectedCompanyOverview.id);
                  setSelectedCompanyId(null);
                }}
              >
                View company
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>

              <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
                Tap company chip again to open
              </p>
            </div>
          )}
        </section>
      )}

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
