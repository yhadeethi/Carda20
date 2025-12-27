/**
 * Contact Timeline Tab
 * Shows history of events and allows adding notes
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  StickyNote,
  Bell,
  CheckSquare,
  Calendar,
  Sparkles,
  Users,
  Scan,
  Edit,
  Plus,
  Filter,
  CloudUpload,
} from "lucide-react";
import { SiHubspot } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { ContactV2, addNote } from "@/lib/contacts/storage";
import { TimelineEvent, TimelineEventType } from "@/lib/contacts/types";
import { format, formatDistanceToNow } from "date-fns";

interface ContactTimelineTabProps {
  contact: ContactV2;
  onUpdate: () => void;
}

const EVENT_ICONS: Record<TimelineEventType, typeof StickyNote> = {
  scan_created: Scan,
  note_added: StickyNote,
  note_updated: Edit,
  followup_generated: Sparkles,
  reminder_set: Bell,
  reminder_done: Bell,
  task_added: CheckSquare,
  task_done: CheckSquare,
  meeting_scheduled: Calendar,
  event_attended: Calendar,
  contact_merged: Users,
  contact_updated: Edit,
  hubspot_synced: CloudUpload,
};

const EVENT_COLORS: Record<TimelineEventType, string> = {
  scan_created: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  note_added: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  note_updated: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  followup_generated: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  reminder_set: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  reminder_done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  task_added: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  task_done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  meeting_scheduled: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  event_attended: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  contact_merged: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  contact_updated: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  hubspot_synced: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const EVENT_LABELS: Record<TimelineEventType, string> = {
  scan_created: "Created",
  note_added: "Note",
  note_updated: "Note Updated",
  followup_generated: "Follow-Up",
  reminder_set: "Reminder",
  reminder_done: "Reminder Done",
  task_added: "Task",
  task_done: "Task Done",
  meeting_scheduled: "Meeting",
  event_attended: "Event",
  contact_merged: "Merged",
  contact_updated: "Updated",
  hubspot_synced: "HubSpot Sync",
};

type FilterType = 'all' | TimelineEventType;

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'note_added', label: 'Notes' },
  { value: 'followup_generated', label: 'Follow-ups' },
  { value: 'reminder_set', label: 'Reminders' },
  { value: 'task_added', label: 'Tasks' },
  { value: 'meeting_scheduled', label: 'Meetings' },
];

export function ContactTimelineTab({ contact, onUpdate }: ContactTimelineTabProps) {
  const { toast } = useToast();
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [filter, setFilter] = useState<FilterType>('all');

  const timeline = useMemo(() => {
    let events = [...(contact.timeline || [])];
    
    // Filter
    if (filter !== 'all') {
      // Group related events
      if (filter === 'reminder_set') {
        events = events.filter(e => e.type === 'reminder_set' || e.type === 'reminder_done');
      } else if (filter === 'task_added') {
        events = events.filter(e => e.type === 'task_added' || e.type === 'task_done');
      } else {
        events = events.filter(e => e.type === filter);
      }
    }
    
    // Sort by date descending
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }, [contact.timeline, filter]);

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    addNote(contact.id, newNoteText.trim());
    setNewNoteText("");
    setShowAddNote(false);
    onUpdate();
    toast({ title: "Note added" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add Note Button */}
      <div className="p-4 border-b">
        {showAddNote ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              rows={3}
              autoFocus
              data-testid="input-note"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={!newNoteText.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddNote(false);
                  setNewNoteText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowAddNote(true)}
            data-testid="button-add-note"
          >
            <StickyNote className="w-4 h-4 mr-2" />
            Add a note...
          </Button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="px-4 py-2 border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {FILTER_OPTIONS.map(opt => (
            <Badge
              key={opt.value}
              variant={filter === opt.value ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1 p-4">
        {timeline.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {timeline.map((event) => {
                const Icon = EVENT_ICONS[event.type] || Edit;
                const colorClass = EVENT_COLORS[event.type] || EVENT_COLORS.contact_updated;
                const fullNote = event.meta?.fullNote;
                const noteText = typeof fullNote === 'string' ? fullNote : null;

                return (
                  <div
                    key={event.id}
                    className="relative pl-10"
                    data-testid={`timeline-event-${event.id}`}
                  >
                    {/* Icon bubble */}
                    <div
                      className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {EVENT_LABELS[event.type]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(event.at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm">{event.summary}</p>
                            {noteText && (
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                {noteText}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
