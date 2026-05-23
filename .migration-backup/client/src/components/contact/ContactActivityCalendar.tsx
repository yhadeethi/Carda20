/**
 * ContactActivityCalendar
 * Calendar view for contact activity — meetings, tasks, reminders.
 * Reads from contactV2.timeline, contactV2.tasks, contactV2.reminders.
 * No backend changes required — pure rendering layer on existing data.
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ContactV2 } from "@/lib/contacts/storage";
import { ContactTask, ContactReminder, TimelineEvent } from "@/lib/contacts/types";

// ── Types ─────────────────────────────────────────────────────────────────

type CalEventKind = "activity" | "task" | "reminder";

interface CalEvent {
  id: string;
  kind: CalEventKind;
  date: string; // YYYY-MM-DD
  title: string;
  sub: string;
  badge: string;
}

interface DayMeta {
  hasActivity: boolean;
  hasTask: boolean;
  hasReminder: boolean;
  events: CalEvent[];
}

// ── Visible timeline types (same filter as ContactDetailView) ─────────────

const VISIBLE_TIMELINE_TYPES = new Set<string>([
  "voice_debrief",
  "followup_sent",
  "meeting_scheduled",
  "event_attended",
  "note_added",
  "call_logged",
]);

const TIMELINE_BADGE: Record<string, string> = {
  voice_debrief:     "Debrief",
  followup_sent:     "Email",
  meeting_scheduled: "Meeting",
  event_attended:    "Event",
  note_added:        "Note",
  call_logged:       "Call",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toYMD(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDisplay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function buildEventMap(contactV2: ContactV2 | null): Map<string, DayMeta> {
  const map = new Map<string, DayMeta>();

  const ensure = (ymd: string): DayMeta => {
    if (!map.has(ymd)) map.set(ymd, { hasActivity: false, hasTask: false, hasReminder: false, events: [] });
    return map.get(ymd)!;
  };

  // Timeline events
  for (const t of contactV2?.timeline ?? []) {
    if (!VISIBLE_TIMELINE_TYPES.has(t.type)) continue;
    const ymd = toYMD(t.at);
    const day = ensure(ymd);
    day.hasActivity = true;
    day.events.push({
      id: t.id,
      kind: "activity",
      date: ymd,
      title: t.summary,
      sub: TIMELINE_BADGE[t.type] ?? t.type,
      badge: TIMELINE_BADGE[t.type] ?? "Activity",
    });
  }

  // Tasks — use dueAt if present, otherwise createdAt
  for (const task of contactV2?.tasks ?? []) {
    const dateStr = task.dueAt ?? task.createdAt;
    const ymd = toYMD(dateStr);
    const day = ensure(ymd);
    day.hasTask = true;
    const dueSuffix = task.dueAt ? ` · due ${format(new Date(task.dueAt), "MMM d")}` : "";
    day.events.push({
      id: task.id,
      kind: "task",
      date: ymd,
      title: task.title,
      sub: task.done ? "Completed" : `Task${dueSuffix}`,
      badge: task.done ? "Done" : "Task",
    });
  }

  // Reminders — use remindAt
  for (const r of contactV2?.reminders ?? []) {
    const ymd = toYMD(r.remindAt);
    const day = ensure(ymd);
    day.hasReminder = true;
    day.events.push({
      id: r.id,
      kind: "reminder",
      date: ymd,
      title: r.label,
      sub: r.done ? "Done" : `Reminder · ${format(new Date(r.remindAt), "MMM d")}`,
      badge: r.done ? "Done" : "Reminder",
    });
  }

  // Sort events within each day by kind: activity → task → reminder
  const kindOrder: Record<CalEventKind, number> = { activity: 0, task: 1, reminder: 2 };
  for (const day of map.values()) {
    day.events.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  }

  return map;
}

// ── Sub-components ────────────────────────────────────────────────────────

function BadgePill({ kind, label, done }: { kind: CalEventKind; label: string; done?: boolean }) {
  if (done) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/5 text-muted-foreground">
        {label}
      </span>
    );
  }
  if (kind === "activity") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEEDFE] text-[#3C3489]">
        {label}
      </span>
    );
  }
  if (kind === "task") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF3DE] text-[#27500A]">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAEEDA] text-[#633806]">
      {label}
    </span>
  );
}

function DayDetail({ ymd, events }: { ymd: string; events: CalEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-[13px] font-medium text-muted-foreground/50">
        No activity on this day
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.6px] mb-3">
        {isoToDisplay(ymd)}
      </p>
      <div className="space-y-2">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-3 p-3 rounded-xl border border-black/[0.07] bg-white shadow-sm"
          >
            {/* Kind indicator dot */}
            <div
              className={[
                "w-2 h-2 rounded-full shrink-0 mt-[5px]",
                ev.kind === "activity" ? "bg-[#534AB7]" :
                ev.kind === "task"     ? "bg-[#1D9E75]" :
                                         "bg-[#BA7517]",
              ].join(" ")}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
                {ev.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ev.sub}</p>
            </div>
            <BadgePill kind={ev.kind} label={ev.badge} done={ev.badge === "Done"} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface ContactActivityCalendarProps {
  contactV2: ContactV2 | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const today = new Date();
const TODAY_YMD = toYMD(today);

export function ContactActivityCalendar({ contactV2 }: ContactActivityCalendarProps) {
  const [year, setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedYmd, setSelectedYmd] = useState<string>(TODAY_YMD);

  const eventMap = useMemo(() => buildEventMap(contactV2), [contactV2]);

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth    = new Date(year, month + 1, 0).getDate();

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  function ymdForDay(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const selectedEvents = eventMap.get(selectedYmd)?.events ?? [];

  return (
    <div data-testid="contact-activity-calendar">

      {/* ── Month nav ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-full border border-black/10 bg-white flex items-center justify-center shadow-sm active:opacity-60 transition-opacity"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-[14px] font-bold text-foreground">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-full border border-black/10 bg-white flex items-center justify-center shadow-sm active:opacity-60 transition-opacity"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* ── Day-of-week labels ── */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground/50 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ── */}
      <div className="grid grid-cols-7 gap-[3px] mb-4">
        {/* Empty leading cells */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const ymd  = ymdForDay(d);
          const meta = eventMap.get(ymd);
          const isToday    = ymd === TODAY_YMD;
          const isSelected = ymd === selectedYmd;
          const hasActivity = meta?.hasActivity ?? false;
          const hasTask     = meta?.hasTask     ?? false;
          const hasReminder = meta?.hasReminder ?? false;
          const hasAny = hasActivity || hasTask || hasReminder;

          // Background priority: selected > activity > task > reminder > none
          let cellBg = "";
          let numColor = "text-muted-foreground";
          if (isSelected) {
            cellBg   = "bg-[#111]";
            numColor = "text-white font-bold";
          } else if (hasActivity) {
            cellBg   = "bg-[#EEEDFE]";
            numColor = "text-[#3C3489] font-semibold";
          } else if (hasTask) {
            cellBg   = "bg-[#EAF3DE]";
            numColor = "text-[#27500A] font-semibold";
          } else if (hasReminder) {
            cellBg   = "bg-[#FAEEDA]";
            numColor = "text-[#633806] font-semibold";
          }

          const todayRing = isToday && !isSelected
            ? "outline outline-[1.5px] outline-offset-[-1.5px] outline-[#534AB7]"
            : "";

          return (
            <button
              key={ymd}
              onClick={() => setSelectedYmd(ymd)}
              className={[
                "aspect-square flex flex-col items-center justify-center rounded-lg transition-all",
                "active:opacity-70",
                cellBg,
                todayRing,
              ].filter(Boolean).join(" ")}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
              aria-label={`${d} ${MONTH_NAMES[month]}`}
              aria-selected={isSelected}
            >
              <span className={`text-[12px] leading-none ${numColor}`}>{d}</span>
              {/* Dot indicators */}
              {hasAny && (
                <div className="flex gap-[2px] mt-[3px]">
                  {hasActivity && (
                    <div className={`w-[3px] h-[3px] rounded-full ${isSelected ? "bg-white/60" : "bg-[#534AB7]"}`} />
                  )}
                  {hasTask && (
                    <div className={`w-[3px] h-[3px] rounded-full ${isSelected ? "bg-white/60" : "bg-[#1D9E75]"}`} />
                  )}
                  {hasReminder && (
                    <div className={`w-[3px] h-[3px] rounded-full ${isSelected ? "bg-white/60" : "bg-[#BA7517]"}`} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center justify-center gap-4 pb-4 mb-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#EEEDFE] border border-[#AFA9EC]" />
          <span className="text-[10px] font-semibold text-muted-foreground">Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#EAF3DE] border border-[#97C459]" />
          <span className="text-[10px] font-semibold text-muted-foreground">Task</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#FAEEDA] border border-[#EF9F27]" />
          <span className="text-[10px] font-semibold text-muted-foreground">Reminder</span>
        </div>
      </div>

      {/* ── Day detail ── */}
      <DayDetail ymd={selectedYmd} events={selectedEvents} />
    </div>
  );
}
