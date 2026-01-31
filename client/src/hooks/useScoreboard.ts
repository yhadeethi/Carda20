import { useMemo } from "react";
import type { UnifiedContact } from "./useUnifiedContacts";
import {
  autoGenerateCompaniesFromContacts,
  getCompanyById,
  resolveCompanyIdForContact,
  extractDomainFromEmail,
  extractDomainFromWebsite,
  normalizeCompanyName,
} from "@/lib/companiesStorage";
import type { ContactReminder } from "@/lib/contacts/types";

const FOLLOWUP_DUE_AFTER_DAYS = 3;
const NEW_CAPTURE_HOURS = 24;
const RECONNECT_DAYS = 60;

function parseIso(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasTimelineEvent(contact: UnifiedContact, type: string): boolean {
  return Array.isArray(contact.timeline) && contact.timeline.some((t) => t.type === type);
}

export type EventSprintSummary = {
  eventName: string;
  pending: number;
};

export type WeeklySeriesPoint = {
  dayLabel: string; // Mon
  isoDate: string; // YYYY-MM-DD (local)
  captures: number;
};

export type CompanySummary = {
  companyId: string;
  name: string;
  domain?: string | null;
  contactsCount: number;
  lastTouchedAt: string;
  completeness: number; // 0-100
  hasNotes: boolean;
};

export type SuggestedCompany = CompanySummary & {
  nextAction: "finish_profile" | "add_intel";
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function useScoreboard(inputContacts: UnifiedContact[], refreshKey: number) {
  const now = useMemo(() => new Date(), [refreshKey]);

  const contacts = useMemo(() => inputContacts, [inputContacts]);

  const enriched = useMemo(() => {
    return contacts
      .map((c) => {
        const createdAt = parseIso(c.createdAt) || new Date(0);
        const lastTouchedAt = parseIso(c.lastTouchedAt) || createdAt;
        const followUpDone = hasTimelineEvent(c, "followup_sent");
        return { c, createdAt, lastTouchedAt, followUpDone };
      })
      .filter(({ c }) => !!c);
  }, [contacts]);

  const dueFollowUps = useMemo(() => {
    const cutoff = new Date(now.getTime() - FOLLOWUP_DUE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    return enriched
      .filter(({ followUpDone, createdAt }) => !followUpDone && createdAt <= cutoff)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ c }) => c);
  }, [enriched, now]);

  const newCaptures = useMemo(() => {
    const cutoff = new Date(now.getTime() - NEW_CAPTURE_HOURS * 60 * 60 * 1000);
    return enriched
      .filter(({ followUpDone, createdAt }) => !followUpDone && createdAt >= cutoff)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ c }) => c);
  }, [enriched, now]);

  const eventSprints: EventSprintSummary[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const { c, followUpDone } of enriched) {
      const eventName = (c.eventName || "").trim();
      if (!eventName) continue;
      if (followUpDone) continue;
      map.set(eventName, (map.get(eventName) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([eventName, pending]) => ({ eventName, pending }))
      .sort((a, b) => b.pending - a.pending);
  }, [enriched]);

  // Insights: non-duplicative "leverage" indicators.
  const missingFieldsCount = useMemo(() => {
    return enriched.filter(({ c }) => !c.company?.trim() || !c.title?.trim() || !c.email?.trim() || !c.phone?.trim()).length;
  }, [enriched]);

  // Data quality breakdown
  const dataQualityBreakdown = useMemo(() => {
    let missingCompany = 0;
    let missingTitle = 0;
    let missingEmail = 0;
    let missingPhone = 0;

    enriched.forEach(({ c }) => {
      if (!c.company?.trim()) missingCompany++;
      if (!c.title?.trim()) missingTitle++;
      if (!c.email?.trim()) missingEmail++;
      if (!c.phone?.trim()) missingPhone++;
    });

    return {
      missingCompany,
      missingTitle,
      missingEmail,
      missingPhone,
    };
  }, [enriched]);

  const reconnectCount = useMemo(() => {
    const cutoff = new Date(now.getTime() - RECONNECT_DAYS * 24 * 60 * 60 * 1000);
    return enriched.filter(({ lastTouchedAt }) => lastTouchedAt <= cutoff).length;
  }, [enriched, now]);

  const weeklyMomentumCount = useMemo(() => {
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let count = 0;
    for (const { c } of enriched) {
      if (!Array.isArray(c.timeline)) continue;
      count += c.timeline.filter((t) => {
        const at = parseIso(t.at);
        if (!at || at < cutoff) return false;
        return t.type === "followup_sent" || t.type === "reminder_done" || t.type === "task_done";
      }).length;
    }
    return count;
  }, [enriched, now]);

  // Get contacts scanned in last 7 days
  const recentScans = useMemo(() => {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return enriched.filter(({ createdAt }) => createdAt >= sevenDaysAgo).length;
  }, [enriched, now]);

  // Count unique companies
  const companiesCount = useMemo(() => {
    const companies = new Set<string>();
    enriched.forEach(({ c }) => {
      if (c.company?.trim()) {
        companies.add(c.company.trim().toLowerCase());
      }
    });
    return companies.size;
  }, [enriched]);

  // Count active reminders
  const remindersCount = useMemo(() => {
    let count = 0;
    enriched.forEach(({ c }) => {
      if (Array.isArray(c.reminders)) {
        const activeReminders = c.reminders.filter(r => !r.done);
        count += activeReminders.length;
      }
    });
    return count;
  }, [enriched]);

  // Active reminders list (includes overdue) sorted by remindAt
  const activeReminders = useMemo(() => {
    const list: Array<{ contact: UnifiedContact; reminder: ContactReminder }> = [];
    for (const { c } of enriched) {
      if (!Array.isArray(c.reminders)) continue;
      for (const r of c.reminders) {
        if (r?.done) continue;
        if (!r?.remindAt) continue;
        list.push({ contact: c, reminder: r as ContactReminder });
      }
    }
    list.sort((a, b) => String(a.reminder.remindAt).localeCompare(String(b.reminder.remindAt)));
    return list;
  }, [enriched]);

  // Weekly captures (last 7 local days including today)
  const weeklyCapturesSeries: WeeklySeriesPoint[] = useMemo(() => {
    const end = startOfLocalDay(now);
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      days.push(d);
    }

    const countsByDate = new Map<string, number>();
    for (const { createdAt } of enriched) {
      const d = startOfLocalDay(createdAt);
      const key = toLocalISODate(d);
      countsByDate.set(key, (countsByDate.get(key) || 0) + 1);
    }

    return days.map((d) => {
      const iso = toLocalISODate(d);
      return {
        dayLabel: dayLabel(d),
        isoDate: iso,
        captures: countsByDate.get(iso) || 0,
      };
    });
  }, [enriched, now]);

  // Company summaries for "Recent companies" strip
  const recentCompanies: CompanySummary[] = useMemo(() => {
    // Ensure companies exist (idempotent)
    try {
      autoGenerateCompaniesFromContacts(
        enriched.map(({ c }) => ({
          company: c.company || "",
          email: c.email || "",
          website: c.website || "",
          companyId: c.companyId || null,
        }))
      );
    } catch {
      // ignore (e.g., during SSR)
    }

    const map = new Map<string, {
      companyId: string;
      name: string;
      domain?: string | null;
      contactsCount: number;
      lastTouchedAt: Date;
      hasNotes: boolean;
      hasLocation: boolean;
    }>();

    const computeCompleteness = (hasDomain: boolean, hasNotes: boolean, hasLocation: boolean, contactsCount: number) => {
      let score = 0;
      if (hasDomain) score += 25;
      if (hasNotes) score += 25;
      if (hasLocation) score += 25;
      if (contactsCount >= 3) score += 25;
      return score;
    };

    for (const { c, createdAt, lastTouchedAt } of enriched) {
      const companyName = (c.company || "").trim();
      if (!companyName) continue;

      const resolvedId = resolveCompanyIdForContact({
        companyId: c.companyId || null,
        company: companyName,
        email: c.email || "",
      });

      if (!resolvedId) continue;

      const company = getCompanyById(resolvedId);
      const name = company?.name || normalizeCompanyName(companyName);
      const domain = company?.domain || extractDomainFromWebsite(c.website || "") || extractDomainFromEmail(c.email || "");
      const hasNotes = !!company?.notes?.trim();
      const hasLocation = !!(company?.city || company?.state || company?.country);

      const key = resolvedId;
      const existing = map.get(key);
      const touched = parseIso(c.lastTouchedAt) || lastTouchedAt || createdAt;

      if (!existing) {
        map.set(key, {
          companyId: resolvedId,
          name,
          domain,
          contactsCount: 1,
          lastTouchedAt: touched,
          hasNotes,
          hasLocation,
        });
      } else {
        existing.contactsCount += 1;
        if (touched > existing.lastTouchedAt) existing.lastTouchedAt = touched;
        if (!existing.domain && domain) existing.domain = domain;
        existing.hasNotes = existing.hasNotes || hasNotes;
        existing.hasLocation = existing.hasLocation || hasLocation;
      }
    }

    const list = Array.from(map.values())
      .map((v) => {
        const completeness = computeCompleteness(!!v.domain, v.hasNotes, v.hasLocation, v.contactsCount);
        return {
          companyId: v.companyId,
          name: v.name,
          domain: v.domain || null,
          contactsCount: v.contactsCount,
          lastTouchedAt: v.lastTouchedAt.toISOString(),
          completeness,
          hasNotes: v.hasNotes,
        } satisfies CompanySummary;
      })
      .sort((a, b) => b.lastTouchedAt.localeCompare(a.lastTouchedAt));

    return list;
  }, [enriched]);

  const suggestedCompany: SuggestedCompany | null = useMemo(() => {
    if (!recentCompanies.length) return null;

    // Pick the lowest completeness among the most recent 10, tie-break by contactsCount then recency
    const pool = recentCompanies.slice(0, 10);
    const sorted = [...pool].sort((a, b) => {
      if (a.completeness !== b.completeness) return a.completeness - b.completeness;
      if (a.contactsCount !== b.contactsCount) return b.contactsCount - a.contactsCount;
      return b.lastTouchedAt.localeCompare(a.lastTouchedAt);
    });
    const best = sorted[0];
    return {
      ...best,
      nextAction: best.completeness < 75 ? "finish_profile" : "add_intel",
    };
  }, [recentCompanies]);

  return {
    contacts,
    dueFollowUps,
    newCaptures,
    eventSprints,
    activeReminders,
    weeklyCapturesSeries,
    recentCompanies,
    suggestedCompany,
    counts: {
      dueFollowUps: dueFollowUps.length,
      newCaptures: newCaptures.length,
      eventSprints: eventSprints.reduce((sum, e) => sum + e.pending, 0),
      recentScans,
      remindersCount,
    },
    insights: {
      missingFieldsCount,
      dataQualityBreakdown,
      reconnectCount,
      weeklyMomentumCount,
      companiesCount,
    },
  };
}
