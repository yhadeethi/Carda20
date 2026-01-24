import { useMemo, useEffect } from "react";
import { Bell, TrendingUp, UserPlus, AlertCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useUnifiedContacts } from "@/hooks/useUnifiedContacts";

type HomeScoreboardProps = {
  refreshKey: number;
  onCreateContact: () => void;
  onViewReminders: () => void;
  onViewCompanies: () => void;
  onViewDataQuality: () => void;
};

export function HomeScoreboard({
  refreshKey,
  onCreateContact,
  onViewReminders,
  onViewCompanies,
  onViewDataQuality,
}: HomeScoreboardProps) {
  const { contacts, refreshLocal } = useUnifiedContacts();

  useEffect(() => {
    refreshLocal();
  }, [refreshKey, refreshLocal]);

  const { counts, insights } = useScoreboard(contacts, refreshKey);

  // Format today's date
  const today = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header with date */}
      <div>
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Reminders Section - only show if there are reminders */}
      {counts.remindersCount > 0 && (
        <button
          onClick={onViewReminders}
          className="w-full rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 text-left hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  You have {counts.remindersCount} reminder{counts.remindersCount !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  Tap to view
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {counts.remindersCount}
            </div>
          </div>
        </button>
      )}

      {/* Network Overview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Network Overview</h2>
          <Button variant="ghost" size="sm" onClick={onViewCompanies}>
            View all
          </Button>
        </div>
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-6">
            <button
              onClick={onViewCompanies}
              className="text-center group"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                {insights.companiesCount}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Companies
              </div>
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-muted-foreground">
                0
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Industries
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                Coming soon
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Recent Activity</h2>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Contacts Scanned</div>
                <div className="text-xs text-muted-foreground">Last 7 days</div>
              </div>
            </div>
            <div className="text-2xl font-bold">
              {counts.recentScans}
            </div>
          </div>
        </Card>
      </div>

      {/* Data Quality - only show if there are issues */}
      {insights.missingFieldsCount > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Data Quality</h2>
          <button
            onClick={onViewDataQuality}
            className="w-full"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <Card className="p-4 text-left hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Missing Information</div>
                    <div className="text-xs text-muted-foreground">
                      {insights.missingFieldsCount} field{insights.missingFieldsCount !== 1 ? 's' : ''} need attention
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {insights.missingFieldsCount}
                </div>
              </div>

              {insights.dataQualityBreakdown && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {insights.dataQualityBreakdown.missingCompany > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Missing company:</span>
                      <span className="font-medium">{insights.dataQualityBreakdown.missingCompany}</span>
                    </div>
                  )}
                  {insights.dataQualityBreakdown.missingTitle > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Missing title:</span>
                      <span className="font-medium">{insights.dataQualityBreakdown.missingTitle}</span>
                    </div>
                  )}
                  {insights.dataQualityBreakdown.missingEmail > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Missing email:</span>
                      <span className="font-medium">{insights.dataQualityBreakdown.missingEmail}</span>
                    </div>
                  )}
                  {insights.dataQualityBreakdown.missingPhone > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Missing phone:</span>
                      <span className="font-medium">{insights.dataQualityBreakdown.missingPhone}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </button>
        </div>
      )}

      {/* Quick Create Contact */}
      <div className="pt-2">
        <Button
          onClick={onCreateContact}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Create Contact
        </Button>
      </div>
    </div>
  );
}
