/**
 * TimelineFeed — unified activity, task, and reminder feed.
 * Now accepts contactV2.tasks and contactV2.reminders alongside timeline items.
 * When filter is "tasks" or "reminders", renders from those separate arrays.
 * When filter is "all", merges all three into one chronological feed.
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ContactTask, ContactReminder } from "@/lib/contacts/types";

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
  | "voice_debrief"
  | "call_logged";

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

// ── Unified feed item ─────────────────────────────────────────────────────
// Internal type that merges timeline events, tasks, and reminders into
// a single sortable item for the "all" view.

type FeedItemKind = "timeline" | "task" | "reminder";

interface FeedItem {
  id: string;
  kind: FeedItemKind;
  sortAt: Date;
  // timeline
  timelineItem?: TimelineItem;
  // task
  task?: ContactTask;
  // reminder
  reminder?: ContactReminder;
}

// ── Active filter type ─────────────────────────────────────────────────────
export type ActivityFilter = "all" | "calls" | "emails" | "meetings" | "notes" | "tasks" | "reminders";

// ── Props ─────────────────────────────────────────────────────────────────

interface TimelineFeedProps {
  items: TimelineItem[];
  tasks?: ContactTask[];
  reminders?: ContactReminder[];
  filter?: ActivityFilter;
  onAddNote: (text: string) => void;
  isAddingNote?: boolean;
  onCompleteTask?: (taskId: string) => void;
  onQuickLog?: (type: TimelineEventType, summary: string, displayLabel: string) => void;
}

// ── Dot colour per event type ─────────────────────────────────────────────

const EVENT_DOT: Record<string, string> = {
  note:               "bg-amber-400",
  note_added:         "bg-amber-400",
  note_updated:       "bg-amber-400",
  followup:           "bg-violet-500",
  followup_generated: "bg-violet-500",
  followup_sent:      "bg-violet-500",
  reminder:           "bg-orange-400",
  reminder_set:       "bg-orange-400",
  reminder_done:      "bg-emerald-500",
  task_added:         "bg-slate-400",
  task_done:          "bg-emerald-500",
  meeting_scheduled:  "bg-indigo-500",
  event_attended:     "bg-indigo-500",
  hubspot_synced:     "bg-orange-400",
  salesforce_synced:  "bg-sky-500",
  created:            "bg-[#4B68F5]",
  scan_created:       "bg-[#4B68F5]",
  contact_updated:    "bg-black/20",
  contact_merged:     "bg-pink-500",
  voice_debrief:      "bg-violet-500",
  call_logged:        "bg-emerald-500",
};

// ── Month grouping ────────────────────────────────────────────────────────

function getMonthKey(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

interface MonthGroup {
  key: string;
  label: string;
  feedItems: FeedItem[];
}

function groupByMonth(feedItems: FeedItem[]): MonthGroup[] {
  const map = new Map<string, FeedItem[]>();
  for (const item of feedItems) {
    const key = getMonthKey(item.sortAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return sortedKeys.map((key) => ({
    key,
    label: getMonthLabel(key),
    feedItems: map.get(key)!,
  }));
}

// ── Relative time ─────────────────────────────────────────────────────────

function formatRelativeTime(at: string | Date): string {
  const date = typeof at === "string" ? new Date(at) : at;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays  = Math.floor(diffMs / 86400000);

  if (diffMins  < 1)  return "Just now";
  if (diffMins  < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays  < 7)  return `${diffDays}d ago`;
  return format(date, "MMM d");
}

function formatDueDate(dueAt: string): string {
  const d = new Date(dueAt);
  const now = new Date();
  const start  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff   = Math.round((target - start) / 86400000);

  if (diff === 0)  return "Due today";
  if (diff === 1)  return "Due tomorrow";
  if (diff === -1) return "Due yesterday";
  if (diff < 0)   return `${Math.abs(diff)}d overdue`;
  return `Due in ${diff}d`;
}

// ── Individual row renderers ──────────────────────────────────────────────

function TimelineRow({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = EVENT_DOT[item.type] || "bg-black/20";
  const hasExpandable = item.title.length > 60 || !!item.meta?.note || !!item.detail;

  const outcomeConfig = item.meta?.outcome
    ? ({
        positive: { label: "Worth following up", className: "bg-emerald-500/10 text-emerald-700" },
        neutral:  { label: "Neutral",            className: "bg-black/5 text-muted-foreground" },
        negative: { label: "Not interested",     className: "bg-red-500/10 text-red-700" },
      } as const)[item.meta.outcome]
    : null;

  return (
    <div
      className={[
        "flex gap-3 px-3 py-3 border-b border-black/[0.05] last:border-0",
        hasExpandable ? "cursor-pointer active:bg-black/[0.02] transition-colors" : "",
      ].join(" ")}
      onClick={hasExpandable ? () => setExpanded((v) => !v) : undefined}
      style={hasExpandable ? { touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties : undefined}
      data-testid={`timeline-item-${item.id}`}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 mt-[5px] ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={["text-[13px] font-semibold text-foreground leading-snug", !expanded && item.title.length > 60 ? "line-clamp-1" : ""].join(" ")}>
            {item.title}
          </p>
          <span className="text-[11px] font-semibold text-muted-foreground/60 shrink-0 mt-0.5">
            {formatRelativeTime(item.at)}
          </span>
        </div>
        {outcomeConfig && (
          <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${outcomeConfig.className}`}>
            {outcomeConfig.label}
          </span>
        )}
        {item.meta?.note && (
          <p className={["text-[12px] text-muted-foreground mt-1 italic leading-relaxed", !expanded ? "line-clamp-1" : ""].join(" ")}>
            "{item.meta.note}"
          </p>
        )}
        {!item.meta?.note && item.detail && expanded && (
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{item.detail}</p>
        )}
        {hasExpandable && (
          <p className="text-[11px] text-muted-foreground/40 mt-1 font-medium">
            {expanded ? "Tap to collapse" : "Tap to expand"}
          </p>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onComplete }: { task: ContactTask; onComplete?: (id: string) => void }) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-3 border-b border-black/[0.05] last:border-0"
      data-testid={`task-feed-${task.id}`}
    >
      <div className="shrink-0 mt-0.5">
        {task.done ? (
          <div className="w-4 h-4 rounded border border-black/10 bg-emerald-500/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-sm bg-emerald-500" />
          </div>
        ) : (
          <Checkbox
            checked={false}
            onCheckedChange={() => onComplete?.(task.id)}
            className="shrink-0"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={["text-[13px] font-semibold leading-snug", task.done ? "line-through text-muted-foreground" : "text-foreground"].join(" ")}>
          {task.title}
        </p>
        {task.dueAt && !task.done && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDueDate(task.dueAt)}</p>
        )}
        {task.done && task.completedAt && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Completed {formatRelativeTime(task.completedAt)}</p>
        )}
      </div>
      <span className={["shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full", task.done ? "bg-black/5 text-muted-foreground" : "bg-[#EAF3DE] text-[#27500A]"].join(" ")}>
        {task.done ? "Done" : "Task"}
      </span>
    </div>
  );
}

function ReminderRow({ reminder }: { reminder: ContactReminder }) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-3 border-b border-black/[0.05] last:border-0"
      data-testid={`reminder-feed-${reminder.id}`}
    >
      <div className="w-2 h-2 rounded-full shrink-0 mt-[5px] bg-amber-400" />
      <div className="flex-1 min-w-0">
        <p className={["text-[13px] font-semibold leading-snug", reminder.done ? "line-through text-muted-foreground" : "text-foreground"].join(" ")}>
          {reminder.label}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {reminder.done
            ? `Done ${reminder.doneAt ? formatRelativeTime(reminder.doneAt) : ""}`
            : format(new Date(reminder.remindAt), "MMM d, yyyy")}
        </p>
      </div>
      <span className={["shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full", reminder.done ? "bg-black/5 text-muted-foreground" : "bg-[#FAEEDA] text-[#633806]"].join(" ")}>
        {reminder.done ? "Done" : "Reminder"}
      </span>
    </div>
  );
}

// ── Month group ───────────────────────────────────────────────────────────

function MonthGroup({
  group,
  onCompleteTask,
}: {
  group: MonthGroup;
  onCompleteTask?: (id: string) => void;
}) {
  const [open, setOpen] = useState(true); // default open

  return (
    <div className="mb-2">
      <button
        className={[
          "w-full flex items-center justify-between px-3 py-2.5 bg-white border border-black/10 shadow-sm transition-colors active:bg-black/[0.02]",
          open ? "rounded-t-xl border-b-transparent" : "rounded-xl",
        ].join(" ")}
        onClick={() => setOpen((v) => !v)}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
      >
        <span className="text-[13px] font-bold text-foreground">{group.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-muted-foreground/60">
            {group.feedItems.length} {group.feedItems.length === 1 ? "item" : "items"}
          </span>
          <ChevronDown className={["w-4 h-4 text-muted-foreground/50 transition-transform duration-200", open ? "rotate-180" : ""].join(" ")} />
        </div>
      </button>

      {open && (
        <div className="bg-white border border-black/10 border-t-0 rounded-b-xl overflow-hidden shadow-sm">
          {group.feedItems.map((fi) => {
            if (fi.kind === "timeline" && fi.timelineItem) {
              return <TimelineRow key={fi.id} item={fi.timelineItem} />;
            }
            if (fi.kind === "task" && fi.task) {
              return <TaskRow key={fi.id} task={fi.task} onComplete={onCompleteTask} />;
            }
            if (fi.kind === "reminder" && fi.reminder) {
              return <ReminderRow key={fi.id} reminder={fi.reminder} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// ── Main feed ─────────────────────────────────────────────────────────────

export function TimelineFeed({
  items,
  tasks = [],
  reminders = [],
  filter = "all",
  onAddNote,
  isAddingNote,
  onCompleteTask,
}: TimelineFeedProps) {
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  // Build unified FeedItem[] based on active filter
  const feedItems = useMemo<FeedItem[]>(() => {
    const result: FeedItem[] = [];

    if (filter === "tasks") {
      for (const t of tasks) {
        result.push({ id: `task-${t.id}`, kind: "task", sortAt: new Date(t.dueAt ?? t.createdAt), task: t });
      }
    } else if (filter === "reminders") {
      for (const r of reminders) {
        result.push({ id: `reminder-${r.id}`, kind: "reminder", sortAt: new Date(r.remindAt), reminder: r });
      }
    } else {
      // timeline items (already filtered by caller for calls/emails/meetings/notes/all)
      for (const t of items) {
        const at = typeof t.at === "string" ? new Date(t.at) : t.at;
        result.push({ id: `tl-${t.id}`, kind: "timeline", sortAt: at, timelineItem: t });
      }
      // In "all" mode, also include tasks and reminders
      if (filter === "all") {
        for (const t of tasks) {
          result.push({ id: `task-${t.id}`, kind: "task", sortAt: new Date(t.dueAt ?? t.createdAt), task: t });
        }
        for (const r of reminders) {
          result.push({ id: `reminder-${r.id}`, kind: "reminder", sortAt: new Date(r.remindAt), reminder: r });
        }
      }
    }

    // Sort descending (newest/most-due first)
    return result.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());
  }, [items, tasks, reminders, filter]);

  const monthGroups = useMemo(() => groupByMonth(feedItems), [feedItems]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
    setNoteOpen(false);
  };

  return (
    <div data-testid="timeline-feed">
      {/* Add a note */}
      <div className="mb-3">
        {!noteOpen ? (
          <button
            onClick={() => setNoteOpen(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-black/15 bg-transparent text-[14px] font-medium text-muted-foreground/60 hover:border-[#4B68F5]/30 hover:text-muted-foreground transition-colors"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
            data-testid="button-open-note"
          >
            Add a note…
          </button>
        ) : (
          <div className="rounded-xl bg-white border border-black/10 shadow-sm p-3 space-y-2">
            <Textarea
              placeholder="What happened?"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="resize-none min-h-[80px] bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 text-[14px]"
              autoFocus
              data-testid="input-add-note"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setNoteText(""); setNoteOpen(false); }} data-testid="button-discard-note">
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteText.trim() || isAddingNote}
                className="rounded-lg bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] border-0 text-white"
                data-testid="button-add-note"
              >
                {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Feed */}
      {monthGroups.length === 0 ? (
        <div className="py-8 text-center text-[13px] font-medium text-muted-foreground/60">
          No activity yet
        </div>
      ) : (
        monthGroups.map((group) => (
          <MonthGroup key={group.key} group={group} onCompleteTask={onCompleteTask} />
        ))
      )}
    </div>
  );
}
