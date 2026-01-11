import { useMemo, useEffect } from "react";
import { Camera, Calendar, Plus, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useUnifiedContacts, type UnifiedContact } from "@/hooks/useUnifiedContacts";

type HomeScoreboardProps = {
  refreshKey: number;
  onPressScan: () => void;
  onPressRelationships: () => void;
  onPressEvents: () => void;
  onSelectContact: (contact: UnifiedContact, initialAction?: "followup") => void;
};

function initials(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

function ContactRow({
  contact,
  ctaLabel,
  onCTA,
  onOpen,
}: {
  contact: UnifiedContact;
  ctaLabel: string;
  onCTA: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      >
        <div className="h-9 w-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
          {initials(contact.name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{contact.name || "Unnamed"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {contact.company || "No company"}{contact.title ? ` • ${contact.title}` : ""}
          </div>
        </div>
      </button>
      <Button size="sm" variant="secondary" onClick={onCTA}>
        {ctaLabel}
      </Button>
    </div>
  );
}

export function HomeScoreboard({
  refreshKey,
  onPressScan,
  onPressRelationships,
  onPressEvents,
  onSelectContact,
}: HomeScoreboardProps) {
  const { contacts, refreshLocal } = useUnifiedContacts();
  
  useEffect(() => {
    refreshLocal();
  }, [refreshKey, refreshLocal]);
  
  const { dueFollowUps, newCaptures, eventSprints, counts, insights } = useScoreboard(contacts, refreshKey);

  const topEvent = eventSprints[0] || null;
  const showEventTile = counts.eventSprints > 0 && !!topEvent;

  const doNowList = useMemo(() => dueFollowUps.slice(0, 3), [dueFollowUps]);
  const newList = useMemo(() => newCaptures.slice(0, 3), [newCaptures]);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-3">
        <div className="text-xl font-semibold">Today</div>
        <div className="text-xs text-muted-foreground">
          {counts.dueFollowUps} due • {counts.newCaptures} new{showEventTile ? ` • ${counts.eventSprints} event pending` : ""}
        </div>
      </div>

      {/* Hero tiles */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={onPressRelationships}
          className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 p-3 text-left hover:from-amber-100 hover:to-orange-100/60 dark:hover:from-amber-900/40 dark:hover:to-orange-800/30 transition-all"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">Follow-ups</div>
            <Users className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-semibold text-amber-900 dark:text-amber-100">{counts.dueFollowUps}</div>
          <div className="text-xs text-amber-700 dark:text-amber-400">Due now</div>
        </button>

        <button
          onClick={onPressScan}
          className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100/50 dark:from-emerald-950/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/50 p-3 text-left hover:from-emerald-100 hover:to-teal-200/60 dark:hover:from-emerald-900/40 dark:hover:to-teal-800/30 transition-all"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">New captures</div>
            <Camera className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{counts.newCaptures}</div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400">In the last 24h</div>
        </button>
      </div>

      {showEventTile && topEvent && (
        <button
          onClick={onPressEvents}
          className="w-full rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3 text-left hover:from-purple-100 hover:to-purple-200/50 dark:hover:from-purple-900/40 dark:hover:to-purple-800/30 transition-all mb-4"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">Event sprint</div>
              <div className="text-sm font-medium truncate max-w-[70%] text-purple-900 dark:text-purple-100">{topEvent.eventName}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">{topEvent.pending}</div>
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">Tap to review and follow up</div>
        </button>
      )}

      {/* Do now */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Do now</div>
          <Button variant="ghost" size="sm" onClick={onPressRelationships}>
            View all
          </Button>
        </div>
        <Card className="p-3">
          {doNowList.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No urgent follow-ups. You’re on top of it.</div>
          ) : (
            doNowList.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                ctaLabel="Send follow-up"
                onCTA={() => onSelectContact(c, "followup")}
                onOpen={() => onSelectContact(c)}
              />
            ))
          )}
        </Card>
      </div>

      {/* New captures */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">New captures</div>
          <Button variant="ghost" size="sm" onClick={onPressScan}>
            Add
          </Button>
        </div>
        <Card className="p-3">
          {newList.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No new captures yet — try scanning a card.</div>
          ) : (
            newList.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                ctaLabel="Follow-up"
                onCTA={() => onSelectContact(c, "followup")}
                onOpen={() => onSelectContact(c)}
              />
            ))
          )}
        </Card>
      </div>

      {/* Insights (non-duplicative) */}
      <div className="mb-2">
        <div className="text-sm font-semibold mb-2">Insights</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold">Reconnect</div>
            <div className="mt-1 text-lg font-semibold text-amber-900 dark:text-amber-100">{insights.reconnectCount}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400">60+ days</div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50/50 dark:from-sky-950/30 dark:to-blue-900/20 border border-sky-200 dark:border-sky-800/50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-sky-700 dark:text-sky-300 font-semibold">Data quality</div>
            <div className="mt-1 text-lg font-semibold text-sky-900 dark:text-sky-100">{insights.missingFieldsCount}</div>
            <div className="text-xs text-sky-600 dark:text-sky-400">Missing fields</div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50/50 dark:from-purple-950/30 dark:to-fuchsia-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-purple-700 dark:text-purple-300 font-semibold">Momentum</div>
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-1 text-lg font-semibold text-purple-900 dark:text-purple-100">{insights.weeklyMomentumCount}</div>
            <div className="text-xs text-purple-600 dark:text-purple-400">Actions / 7d</div>
          </div>
        </div>
      </div>

      {/* Quick add */}
      <div className="mt-6">
        <Button onClick={onPressScan} className="w-full rounded-2xl">
          <Plus className="w-4 h-4 mr-2" /> Add a contact
        </Button>
      </div>
    </div>
  );
}
