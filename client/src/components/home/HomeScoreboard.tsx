import { useMemo, useEffect } from "react";
import { Building2, Briefcase, Copy, TrendingUp, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";

type HomeScoreboardProps = {
  refreshKey: number;
  onCreateContact: () => void;
  onViewReminders: () => void;
  onViewCompanies: () => void;
  onViewDataQuality: () => void;
  onSelectContact: (contact: UnifiedContact) => void;
};

function initials(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function HomeScoreboard({
  refreshKey,
  onCreateContact,
  onViewReminders,
  onViewCompanies,
  onViewDataQuality,
  onSelectContact,
}: HomeScoreboardProps) {
  const { contacts, refreshLocal } = useUnifiedContacts();

  useEffect(() => {
    refreshLocal();
  }, [refreshKey, refreshLocal]);

  const { counts, insights, reminders, newCaptures, duplicates } = useScoreboard(contacts, refreshKey);

  // Format today's date - "Today, Mon 12 Jan"
  const today = useMemo(() => {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' });
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    const date = now.getDate();
    return `Today, ${day} ${date} ${month}`;
  }, []);

  // Calculate fixes count
  const fixesCount = insights.dataQualityBreakdown
    ? insights.dataQualityBreakdown.missingCompany + insights.dataQualityBreakdown.missingTitle
    : 0;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold">{today}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {counts.remindersCount} reminder{counts.remindersCount !== 1 ? 's' : ''} • {counts.newCaptures} capture{counts.newCaptures !== 1 ? 's' : ''} • {fixesCount} fix{fixesCount !== 1 ? 'es' : ''}
        </p>
      </div>

      {/* Reminders Section */}
      {reminders && reminders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Reminders</h2>
            <button
              onClick={onViewReminders}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all &gt;
            </button>
          </div>
          <div className="space-y-3">
            {reminders.slice(0, 2).map((reminder) => (
              <Card key={reminder.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-sm font-medium text-muted-foreground shrink-0">
                      {reminder.time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{reminder.label}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="text-[10px]">
                            {initials(reminder.contactName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground truncate">{reminder.contactName}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => reminder.contact && onSelectContact(reminder.contact)}
                  >
                    {reminder.done ? 'Done' : 'Open'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Activity */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Weekly activity</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Contacts scanned</div>
            <div className="text-4xl font-bold mb-1">{counts.recentScans}</div>
            <div className="text-xs text-muted-foreground">Last 7 days</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">New companies</div>
            <div className="text-4xl font-bold mb-1">{insights.newCompaniesCount || 0}</div>
            <div className="text-xs text-muted-foreground">Last 7 days</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Industries engaged</div>
            <div className="text-4xl font-bold mb-1">0</div>
            <div className="text-xs text-muted-foreground">Last 30 days</div>
          </Card>
        </div>
      </div>

      {/* Fix Now Section */}
      {fixesCount > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Fix now</h2>
          <div className="space-y-3">
            {insights.dataQualityBreakdown && insights.dataQualityBreakdown.missingCompany > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {insights.dataQualityBreakdown.missingCompany} contact{insights.dataQualityBreakdown.missingCompany !== 1 ? 's' : ''} missing company
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Last 7 days</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={onViewDataQuality}
                  >
                    Fix
                  </Button>
                </div>
              </Card>
            )}

            {insights.dataQualityBreakdown && insights.dataQualityBreakdown.missingTitle > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {insights.dataQualityBreakdown.missingTitle} contact{insights.dataQualityBreakdown.missingTitle !== 1 ? 's' : ''} missing role
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Last 7 days</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={onViewDataQuality}
                  >
                    Fix
                  </Button>
                </div>
              </Card>
            )}

            {duplicates && duplicates.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                      <Copy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''} detected
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Last 30 days</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={onViewDataQuality}
                  >
                    Review
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Create Contact Button */}
      <div className="pt-2">
        <Button
          onClick={onCreateContact}
          className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-base"
          size="lg"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Create contact
        </Button>
      </div>
    </div>
  );
}
