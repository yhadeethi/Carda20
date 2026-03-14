import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Plus,
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
  | "salesforce_synced";

export interface TimelineItem {
  id: string;
  type: TimelineEventType;
  title: string;
  detail?: string;
  meta?: {
    outcome?: 'positive' | 'neutral' | 'negative';
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
  note: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  note_added: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  note_updated: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  followup: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  followup_generated: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  reminder: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  reminder_set: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  reminder_done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  crm: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  hubspot_synced: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  salesforce_synced: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  created: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  scan_created: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  task_added: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  task_done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  meeting_scheduled: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  event_attended: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  contact_merged: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  contact_updated: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  followup_sent: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  voice_debrief: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

type FilterType = "all" | "notes" | "followups" | "reminders" | "crm";

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: "all", label: "All" },
  { value: "notes", label: "Notes" },
  { value: "followups", label: "Follow-ups" },
  { value: "reminders", label: "Reminders" },
  { value: "crm", label: "CRM" },
];

function normalizeType(type: string): FilterType | null {
  if (type.includes("note")) return "notes";
  if (type.includes("followup")) return "followups";
  if (type.includes("reminder")) return "reminders";
  if (type.includes("hubspot") || type.includes("crm")) return "crm";
  return null;
}

interface QuickLogBarProps {
  onLog: (type: TimelineEventType, summary: string, displayLabel: string) => void;
}

function QuickLogBar({ onLog }: QuickLogBarProps) {
  const options = [
    { type: 'meeting_scheduled' as TimelineEventType, label: 'Met',      icon: <Users     className="w-3.5 h-3.5" /> },
    { type: 'note_added'        as TimelineEventType, label: 'Called',   icon: <Phone     className="w-3.5 h-3.5" /> },
    { type: 'note_added'        as TimelineEventType, label: 'Emailed',  icon: <Mail      className="w-3.5 h-3.5" /> },
    { type: 'note_added'        as TimelineEventType, label: 'LinkedIn', icon: <Linkedin  className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="pb-2">
      <p className="text-xs text-muted-foreground mb-2">Log interaction</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onLog(opt.type, opt.label, opt.label)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card/60 text-xs font-medium hover:bg-muted/50 transition-colors active:scale-95"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            data-testid={`chip-log-${opt.label.toLowerCase()}`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimelineFeed({ items, onAddNote, isAddingNote, onQuickLog }: TimelineFeedProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [noteText, setNoteText] = useState("");

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => {
      const normalized = normalizeType(item.type);
      return normalized === filter;
    });
  }, [items, filter]);

  // Group consecutive contact_updated events to reduce noise
  const groupedItems = useMemo(() => {
    const result: Array<TimelineItem | { type: "__group__"; label: string; id: string; at: string | Date }> = [];
    let i = 0;
    while (i < filteredItems.length) {
      const item = filteredItems[i];
      if (item.type === "contact_updated") {
        // Collect consecutive contact_updated items
        const batch = [item];
        while (
          i + 1 < filteredItems.length &&
          filteredItems[i + 1].type === "contact_updated"
        ) {
          i++;
          batch.push(filteredItems[i]);
        }
        if (batch.length >= 2) {
          result.push({
            type: "__group__" as const,
            label: `${batch.length} profile edits`,
            id: `group-${batch[0].id}`,
            at: batch[0].at,
          });
        } else {
          result.push(item);
        }
      } else {
        result.push(item);
      }
      i++;
    }
    return result;
  }, [filteredItems]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
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
    <div className="space-y-4" data-testid="timeline-feed">
      {/* Quick Log Bar */}
      {onQuickLog && <QuickLogBar onLog={onQuickLog} />}

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(option.value)}
            className="shrink-0"
            data-testid={`filter-${option.value}`}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Inline Note Composer */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a note..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="resize-none min-h-[60px] flex-1"
          data-testid="input-add-note"
        />
        <Button
          onClick={handleAddNote}
          disabled={!noteText.trim() || isAddingNote}
          size="sm"
          className="self-end"
          data-testid="button-add-note"
        >
          {isAddingNote ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Timeline List */}
      <div className="divide-y divide-border/50">
        {groupedItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No timeline events yet
          </div>
        ) : (
          groupedItems.map((item) => {
            if ("label" in item && item.type === "__group__") {
              return (
                <div key={item.id} className="flex gap-3 py-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                    <Edit className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0 pl-2">
                      {formatEventTime(item.at)}
                    </span>
                  </div>
                </div>
              );
            }

            const timelineItem = item as TimelineItem;
            const Icon = EVENT_ICONS[timelineItem.type] || StickyNote;
            const colorClass = EVENT_COLORS[timelineItem.type] || EVENT_COLORS.note;

            return (
              <div
                key={timelineItem.id}
                className="flex gap-3 py-3"
                data-testid={`timeline-item-${timelineItem.id}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{timelineItem.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatEventTime(timelineItem.at)}
                    </span>
                  </div>
                  {(() => {
                    const outcomeConfig = timelineItem.meta?.outcome
                      ? ({
                          positive: { label: 'Worth following up', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
                          neutral:  { label: 'Neutral',             className: 'bg-muted text-muted-foreground' },
                          negative: { label: 'Not interested',      className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
                        } as const)[timelineItem.meta.outcome]
                      : null;
                    return (
                      <>
                        {outcomeConfig && (
                          <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${outcomeConfig.className}`}>
                            {outcomeConfig.label}
                          </span>
                        )}
                        {timelineItem.meta?.note && (
                          <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">"{timelineItem.meta.note}"</p>
                        )}
                        {!timelineItem.meta?.note && timelineItem.detail && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {timelineItem.detail}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
