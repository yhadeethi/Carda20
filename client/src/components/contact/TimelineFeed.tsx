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
  | "hubspot_synced";

export interface TimelineItem {
  id: string;
  type: TimelineEventType;
  title: string;
  detail?: string;
  at: string | Date;
}

interface TimelineFeedProps {
  items: TimelineItem[];
  onAddNote: (text: string) => void;
  isAddingNote?: boolean;
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
  created: Scan,
  scan_created: Scan,
  task_added: CheckSquare,
  task_done: CheckSquare,
  meeting_scheduled: Calendar,
  event_attended: Calendar,
  contact_merged: Users,
  contact_updated: Edit,
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
  created: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  scan_created: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  task_added: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  task_done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  meeting_scheduled: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  event_attended: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  contact_merged: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  contact_updated: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
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

export function TimelineFeed({ items, onAddNote, isAddingNote }: TimelineFeedProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [noteText, setNoteText] = useState("");

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => {
      const normalized = normalizeType(item.type);
      return normalized === filter;
    });
  }, [items, filter]);

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
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No timeline events yet
          </div>
        ) : (
          filteredItems.map((item) => {
            const Icon = EVENT_ICONS[item.type] || StickyNote;
            const colorClass = EVENT_COLORS[item.type] || EVENT_COLORS.note;

            return (
              <div
                key={item.id}
                className="flex gap-3 py-3"
                data-testid={`timeline-item-${item.id}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatEventTime(item.at)}
                    </span>
                  </div>
                  {item.detail && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {item.detail}
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
