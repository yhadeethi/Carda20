import { useMemo } from "react";
import type { UnifiedContact } from "./useUnifiedContacts";

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

  // Get reminder objects with contact info
  const reminders = useMemo(() => {
    const now = new Date();
    const reminderList: Array<{
      id: string;
      time: string;
      label: string;
      contactName: string;
      contact: UnifiedContact;
      done: boolean;
      remindAt: Date;
    }> = [];

    enriched.forEach(({ c }) => {
      if (Array.isArray(c.reminders)) {
        c.reminders.forEach(r => {
          if (!r.done && r.remindAt) {
            const remindAt = new Date(r.remindAt);
            reminderList.push({
              id: r.id,
              time: remindAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              label: r.label,
              contactName: c.name || 'Unknown',
              contact: c,
              done: r.done,
              remindAt,
            });
          }
        });
      }
    });

    return reminderList.sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }, [enriched]);

  // Get new companies in last 7 days
  const newCompaniesCount = useMemo(() => {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const companies = new Set<string>();

    enriched.forEach(({ c, createdAt }) => {
      if (createdAt >= sevenDaysAgo && c.company?.trim()) {
        companies.add(c.company.trim().toLowerCase());
      }
    });

    return companies.size;
  }, [enriched, now]);

  // Detect duplicates (contacts with same name or email)
  const duplicates = useMemo(() => {
    const nameMap = new Map<string, UnifiedContact[]>();
    const emailMap = new Map<string, UnifiedContact[]>();

    enriched.forEach(({ c }) => {
      if (c.name?.trim()) {
        const normalized = c.name.trim().toLowerCase();
        if (!nameMap.has(normalized)) nameMap.set(normalized, []);
        nameMap.get(normalized)!.push(c);
      }
      if (c.email?.trim()) {
        const normalized = c.email.trim().toLowerCase();
        if (!emailMap.has(normalized)) emailMap.set(normalized, []);
        emailMap.get(normalized)!.push(c);
      }
    });

    const dupes: UnifiedContact[] = [];
    nameMap.forEach((contacts) => {
      if (contacts.length > 1) dupes.push(...contacts);
    });
    emailMap.forEach((contacts) => {
      if (contacts.length > 1) {
        contacts.forEach(c => {
          if (!dupes.find(d => d.id === c.id)) dupes.push(c);
        });
      }
    });

    return dupes;
  }, [enriched]);

  return {
    contacts,
    dueFollowUps,
    newCaptures,
    eventSprints,
    reminders,
    duplicates,
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
      newCompaniesCount,
    },
  };
}
