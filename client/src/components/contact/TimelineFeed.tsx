import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  StickyNote,
  Sparkles,
  Bell,
  CheckSquare,
  Calendar,
  Users,
  Scan,
  Edit,
  CloudUpload,
  Loader2,
  Phone,
  Mail,
  Linkedin,
  Mic,
} from "lucide-react";
import { format } from "date-fns";

export type TimelineEventType =
  | "note"
  | "followup"
  | "reminder"
  | "crm"
  | "created"
  | "scan_created"
  | "note_added"
  | "note_updated"
  | "followup_generated"
  | "reminder_set"
  | "reminder_done"
  | "task_added"
  | "task_done"
  | "meeting_scheduled"
  | "event_attended"
  | "contact_merged"
  | "contact_updated"
  | "hubspot_synced"
  | "salesforce_synced"
  | "followup_sent"
  | "voice_debrief";

export interface TimelineItem {
  id: string;
  type: TimelineEventType;
  title: string;
  detail?: string;
  meta?: {
    outcome?: "positive" | "neutral" | "negative";
    note?: string;
    source?: string;
  };
  at: string | Date;
}

interface TimelineFeedProps {
  items: TimelineItem[];
  onAddNote: (text: string) => void;
  isAddingNote?: boolean;
  onQuickLog?: (type: TimelineEventType, summary: string, displayLabel: string) => void;
}

// FIX #4: Smaller icon map, same types
const EVENT_ICONS: Record<string, typeof StickyNote> = {
  note: StickyNote,
  note_added: StickyNote,
  note_updated: Edit,
  followup: Sparkles,
  followup_generated: Sparkles,
  reminder: Bell,
  reminder_set: Bell,
  reminder_done: Bell,
  crm: CloudUpload,
  hubspot_synced: CloudUpload,
  salesforce_synced: CloudUpload,
  created: Scan,
  scan_created: Scan,
  task_added: CheckSquare,
  task_done: CheckSquare,
  meeting_scheduled: Calendar,
  event_attended: Calendar,
  contact_merged: Users,
  contact_updated: Edit,
  followup_sent: Sparkles,
  voice_debrief: Mic,
};

const EVENT_COLORS: Record<string, string> = {
  note: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  note_added: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  note_updated: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  followup: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  followup_generated: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  reminder: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  reminder_set: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  reminder_done: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  crm: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  hubspot_synced: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  salesforce_synced: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
  created: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  scan_created: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  task_added: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  task_done: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  meeting_scheduled: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  event_attended: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  contact_merged: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300",
  contact_updated: "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
  followup_sent: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  voice_debrief: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
};

// FIX #3: Group same-type events on the same calendar day
type GroupedEntry =
  | TimelineItem
  | { type: "__group__"; label: string; id: string; at: string | Date; eventType: string };

function isSameDay(a: string | Date, b: string | Date): boolean {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Types that are meaningful to show individually — never collapse these
const NEVER_COLLAPSE: Set<TimelineEventType> = new Set([
  "note",
  "note_added",
  "note_updated",
  "voice_debrief",
  "followup_sent",
  "followup_generated",
  "meeting_scheduled",
]);

function groupTimelineItems(items: TimelineItem[]): GroupedEntry[] {
  const result: GroupedEntry[] = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i];

    // Never collapse important events — show individually
    if (NEVER_COLLAPSE.has(item.type)) {
      result.push(item);
      i++;
      continue;
    }

    // Try to batch same-type events on the same day
    const batch = [item];
    while (
      i + 1 < items.length &&
      items[i + 1].type === item.type &&
      isSameDay(items[i + 1].at, item.at) &&
      !NEVER_COLLAPSE.has(items[i + 1].type)
    ) {
      i++;
      batch.push(items[i]);
    }

    if (batch.length >= 2) {
      // Produce a friendly label per type
      const typeLabel: Partial<Record<TimelineEventType, string>> = {
        reminder_set: "reminders set",
        contact_updated: "profile edits",
        task_added: "tasks added",
        task_done: "tasks completed",
        hubspot_synced: "HubSpot syncs",
        salesforce_synced: "Salesforce syncs",
      };
      const label = `${batch.length} ${typeLabel[item.type] ?? "events"}`;
      result.push({
        type: "__group__",
        label,
        id: `group-${batch[0].id}`,
        at: batch[0].at,
        eventType: item.type,
      });
    } else {
      result.push(item);
    }

    i++;
  }

  return result;
}

export function TimelineFeed({ items, onAddNote, isAddingNote, onQuickLog }: TimelineFeedProps) {
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  // FIX #3: Use new smart grouping instead of old contact_updated-only grouping
  const groupedItems = useMemo(() => groupTimelineItems(items), [items]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
    setNoteOpen(false);
  };

  const formatEventTime = (at: string | Date): string => {
    const date = typeof at === "string" ? new Date(at) : at;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, "MMM d");
  };

  return (
    // FIX #2: Removed space-y-3, tighter top spacing
    <div data-testid="timeline-feed">

      {/* FIX #5: Add a note — solid background so it doesn't float */}
      <div className="mb-3">
        {!noteOpen ? (
          <button
            onClick={() => setNoteOpen(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-border/50 bg-background text-sm text-muted-foreground/60 hover:border-border/80 hover:text-muted-foreground transition-colors"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
            data-testid="button-open-note"
          >
            Add a note…
          </button>
        ) : (
          <div className="rounded-xl bg-background border border-border/60 p-3 space-y-2">
            <Textarea
              placeholder="What happened?"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="resize-none min-h-[80px] bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
              autoFocus
              data-testid="input-add-note"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setNoteText(""); setNoteOpen(false); }}
                data-testid="button-discard-note"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteText.trim() || isAddingNote}
                data-testid="button-add-note"
              >
                {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline list */}
      {/* FIX #2: divide-y removed, using py spacing only for cleaner look */}
      <div>
        {groupedItems.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            No activity yet
          </div>
        ) : (
          groupedItems.map((item) => {

            // Collapsed group row
            if ("label" in item && item.type === "__group__") {
              const groupItem = item as { type: "__group__"; label: string; id: string; at: string | Date; eventType: string };
              const Icon = EVENT_ICONS[groupItem.eventType] || Edit;
              const colorClass = EVENT_COLORS[groupItem.eventType] || EVENT_COLORS.contact_updated;
              return (
                <div key={groupItem.id} className="flex items-center gap-3 py-2">
                  {/* FIX #4: Smaller icon — w-6 h-6 instead of w-8 h-8 */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground">{groupItem.label}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatEventTime(groupItem.at)}
                  </span>
                </div>
              );
            }

            // Individual event row
            const timelineItem = item as TimelineItem;
            const Icon = EVENT_ICONS[timelineItem.type] || StickyNote;
            const colorClass = EVENT_COLORS[timelineItem.type] || EVENT_COLORS.note;

            const outcomeConfig = timelineItem.meta?.outcome
              ? ({
                  positive: { label: "Worth following up", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
                  neutral:  { label: "Neutral",            className: "bg-muted text-muted-foreground" },
                  negative: { label: "Not interested",     className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
                } as const)[timelineItem.meta.outcome]
              : null;

            return (
              <div
                key={timelineItem.id}
                className="flex gap-3 py-2.5 border-b border-border/30 last:border-0"
                data-testid={`timeline-item-${timelineItem.id}`}
              >
                {/* FIX #4: Smaller icon — w-6 h-6, icon w-3.5 h-3.5 */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{timelineItem.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {formatEventTime(timelineItem.at)}
                    </span>
                  </div>
                  {outcomeConfig && (
                    <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${outcomeConfig.className}`}>
                      {outcomeConfig.label}
                    </span>
                  )}
                  {timelineItem.meta?.note && (
                    <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">
                      "{timelineItem.meta.note}"
                    </p>
                  )}
                  {!timelineItem.meta?.note && timelineItem.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {timelineItem.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
