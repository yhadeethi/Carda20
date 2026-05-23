import { useMemo } from "react";
import { ContactV2, loadContactsV2 } from "@/lib/contacts/storage";

const FOLLOWUP_DUE_AFTER_DAYS = 3;
const NEW_CAPTURE_HOURS = 24;
const RECONNECT_DAYS = 60;

function parseIso(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasTimelineEvent(contact: ContactV2, type: string): boolean {
  return Array.isArray(contact.timeline) && contact.timeline.some((t) => t.type === type);
}

export type EventSprintSummary = {
  eventName: string;
  pending: number;
};

export function useScoreboard(refreshKey: number) {
  const now = useMemo(() => new Date(), [refreshKey]);

  const contacts = useMemo(() => {
    try {
      return loadContactsV2();
    } catch {
      return [] as ContactV2[];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
    return [...map.entries()]
      .map(([eventName, pending]) => ({ eventName, pending }))
      .sort((a, b) => b.pending - a.pending);
  }, [enriched]);

  // Insights: non-duplicative “leverage” indicators.
  const missingFieldsCount = useMemo(() => {
    return enriched.filter(({ c }) => !c.company?.trim() || !c.title?.trim()).length;
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

  return {
    contacts,
    dueFollowUps,
    newCaptures,
    eventSprints,
    counts: {
      dueFollowUps: dueFollowUps.length,
      newCaptures: newCaptures.length,
      eventSprints: eventSprints.reduce((sum, e) => sum + e.pending, 0),
    },
    insights: {
      missingFieldsCount,
      reconnectCount,
      weeklyMomentumCount,
    },
  };
}
