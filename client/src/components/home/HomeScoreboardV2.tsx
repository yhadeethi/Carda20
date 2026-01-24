import { useMemo } from "react";
import { Building2, Bell, TrendingUp, UserPlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";

type HomeScoreboardV2Props = {
  refreshKey: number;
  onCreateContact: () => void;
  onViewReminders: () => void;
  onViewCompanies: () => void;
  onViewDataQuality: () => void;
};

// Helper function to get unique companies from contacts
function getCompanyStats(contacts: UnifiedContact[]) {
  const companies = new Set<string>();
  const industries = new Set<string>();

  contacts.forEach(contact => {
    if (contact.company?.trim()) {
      companies.add(contact.company.trim());
    }
    // Assuming industry might be stored in contact metadata
    // You may need to adjust this based on your data structure
  });

  return {
    totalCompanies: companies.size,
    industriesReached: industries.size, // Will need real industry data
    discovered: companies.size, // Placeholder - define what "discovered" means
  };
}

// Get contacts scanned in last 7 days
function getRecentScans(contacts: UnifiedContact[]) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return contacts.filter(contact => {
    if (!contact.createdAt) return false;
    const createdDate = new Date(contact.createdAt);
    return createdDate >= sevenDaysAgo;
  }).length;
}

// Get data quality issues
function getDataQualityIssues(contacts: UnifiedContact[]) {
  let missingCompany = 0;
  let missingTitle = 0;
  let missingEmail = 0;
  let missingPhone = 0;

  contacts.forEach(contact => {
    if (!contact.company?.trim()) missingCompany++;
    if (!contact.title?.trim()) missingTitle++;
    if (!contact.email?.trim()) missingEmail++;
    if (!contact.phone?.trim()) missingPhone++;
  });

  return {
    total: missingCompany + missingTitle + missingEmail + missingPhone,
    breakdown: {
      missingCompany,
      missingTitle,
      missingEmail,
      missingPhone,
    }
  };
}

// Get reminders count (placeholder - you'll need real reminder data)
function getRemindersCount(contacts: UnifiedContact[]) {
  let count = 0;
  contacts.forEach(contact => {
    if (Array.isArray(contact.reminders)) {
      const activeReminders = contact.reminders.filter(r => !r.done);
      count += activeReminders.length;
    }
  });
  return count;
}

export function HomeScoreboardV2({
  refreshKey,
  onCreateContact,
  onViewReminders,
  onViewCompanies,
  onViewDataQuality,
}: HomeScoreboardV2Props) {
  const { contacts } = useUnifiedContacts();

  const stats = useMemo(() => {
    const companyStats = getCompanyStats(contacts);
    const recentScans = getRecentScans(contacts);
    const dataQuality = getDataQualityIssues(contacts);
    const remindersCount = getRemindersCount(contacts);

    return {
      ...companyStats,
      recentScans,
      dataQuality,
      remindersCount,
    };
  }, [contacts, refreshKey]);

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

      {/* Reminders Section */}
      {stats.remindersCount > 0 && (
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
                  You have {stats.remindersCount} reminder{stats.remindersCount !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  Tap to view
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.remindersCount}
            </div>
          </div>
        </button>
      )}

      {/* Companies Overview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Network Overview</h2>
          <Button variant="ghost" size="sm" onClick={onViewCompanies}>
            View all
          </Button>
        </div>
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={onViewCompanies}
              className="text-center group"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="text-3xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                {stats.totalCompanies}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Companies
              </div>
            </button>

            <button
              onClick={onViewCompanies}
              className="text-center group"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="text-3xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                {stats.industriesReached}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Industries
              </div>
            </button>

            <button
              onClick={onViewCompanies}
              className="text-center group"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="text-3xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                {stats.discovered}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Discovered
              </div>
            </button>
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
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.recentScans}
            </div>
          </div>
        </Card>
      </div>

      {/* Data Quality */}
      {stats.dataQuality.total > 0 && (
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
                      {stats.dataQuality.total} field{stats.dataQuality.total !== 1 ? 's' : ''} need attention
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.dataQuality.total}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {stats.dataQuality.breakdown.missingCompany > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing company:</span>
                    <span className="font-medium">{stats.dataQuality.breakdown.missingCompany}</span>
                  </div>
                )}
                {stats.dataQuality.breakdown.missingTitle > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing title:</span>
                    <span className="font-medium">{stats.dataQuality.breakdown.missingTitle}</span>
                  </div>
                )}
                {stats.dataQuality.breakdown.missingEmail > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing email:</span>
                    <span className="font-medium">{stats.dataQuality.breakdown.missingEmail}</span>
                  </div>
                )}
                {stats.dataQuality.breakdown.missingPhone > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing phone:</span>
                    <span className="font-medium">{stats.dataQuality.breakdown.missingPhone}</span>
                  </div>
                )}
              </div>
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
