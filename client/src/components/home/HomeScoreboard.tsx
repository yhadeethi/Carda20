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
          className="rounded-2xl bg-card border p-3 text-left hover:bg-accent/30 transition-colors"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Follow-ups</div>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{counts.dueFollowUps}</div>
          <div className="text-xs text-muted-foreground">Due</div>
        </button>

        <button
          onClick={onPressScan}
          className="rounded-2xl bg-card border p-3 text-left hover:bg-accent/30 transition-colors"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">New captures</div>
            <Camera className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{counts.newCaptures}</div>
          <div className="text-xs text-muted-foreground">In last 24h</div>
        </button>
      </div>

      {showEventTile && topEvent && (
        <button
          onClick={onPressEvents}
          className="w-full rounded-2xl bg-card border p-3 text-left hover:bg-accent/30 transition-colors mb-4"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Event sprint</div>
              <div className="text-sm font-medium truncate max-w-[70%]">{topEvent.eventName}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold">{topEvent.pending}</div>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Tap to review and follow up</div>
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
                ctaLabel="Send"
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
            <div className="text-sm text-muted-foreground py-2">No new contacts in the last 24h.</div>
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
          <div className="rounded-2xl bg-card border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reconnect</div>
            <div className="mt-1 text-lg font-semibold">{insights.reconnectCount}</div>
            <div className="text-xs text-muted-foreground">60+ days</div>
          </div>
          <div className="rounded-2xl bg-card border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Data quality</div>
            <div className="mt-1 text-lg font-semibold">{insights.missingFieldsCount}</div>
            <div className="text-xs text-muted-foreground">Missing fields</div>
          </div>
          <div className="rounded-2xl bg-card border p-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Momentum</div>
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="mt-1 text-lg font-semibold">{insights.weeklyMomentumCount}</div>
            <div className="text-xs text-muted-foreground">Actions / 7d</div>
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
