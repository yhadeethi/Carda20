import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ContactTask, TimelineEvent, ContactReminder } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────

type CalEventKind = "activity" | "task" | "reminder";

interface CalEvent {
  id: string;
  kind: CalEventKind;
  date: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────

function toYMD(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDisplay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TIMELINE_BADGE: Record<string, string> = {
  voice_debrief: "Debrief",
  followup_sent: "Email",
  meeting_scheduled: "Meeting",
  event_attended: "Event",
  note_added: "Note",
  call_logged: "Call",
  note: "Note",
  call: "Call",
  meeting: "Meeting",
  email: "Email",
};

function buildEventMap(
  timeline: TimelineEvent[],
  tasks: ContactTask[],
  reminders: ContactReminder[]
): Map<string, DayMeta> {
  const map = new Map<string, DayMeta>();

  const ensure = (ymd: string): DayMeta => {
    if (!map.has(ymd)) {
      map.set(ymd, { hasActivity: false, hasTask: false, hasReminder: false, events: [] });
    }
    return map.get(ymd)!;
  };

  for (const t of timeline) {
    const ymd = toYMD(t.eventAt);
    const day = ensure(ymd);
    day.hasActivity = true;
    day.events.push({
      id: String(t.id),
      kind: "activity",
      date: ymd,
      title: t.summary,
      sub: TIMELINE_BADGE[t.type] ?? t.type,
      badge: TIMELINE_BADGE[t.type] ?? "Activity",
    });
  }

  for (const task of tasks) {
    const dateStr = task.dueAt ?? task.createdAt;
    if (!dateStr) continue;
    const ymd = toYMD(dateStr);
    const day = ensure(ymd);
    day.hasTask = true;
    const dueSuffix = task.dueAt ? ` · due ${formatDueDate(task.dueAt)}` : "";
    day.events.push({
      id: String(task.id),
      kind: "task",
      date: ymd,
      title: task.title,
      sub: task.done ? "Completed" : `Task${dueSuffix}`,
      badge: task.done ? "Done" : "Task",
    });
  }

  for (const r of reminders) {
    const ymd = toYMD(r.remindAt);
    const day = ensure(ymd);
    day.hasReminder = true;
    day.events.push({
      id: String(r.id),
      kind: "reminder",
      date: ymd,
      title: r.label,
      sub: r.done ? "Done" : `Reminder · ${formatDueDate(r.remindAt)}`,
      badge: r.done ? "Done" : "Reminder",
    });
  }

  const kindOrder: Record<CalEventKind, number> = { activity: 0, task: 1, reminder: 2 };
  for (const day of map.values()) {
    day.events.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  }

  return map;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const today = new Date();
const TODAY_YMD = toYMD(today.toISOString());

// ── Badge Pill ────────────────────────────────────────────────────────────

function BadgePill({ kind, label }: { kind: CalEventKind; label: string }) {
  const bgColor =
    label === "Done" ? "#F3F4F6" :
    kind === "activity" ? "#EEEDFE" :
    kind === "task" ? "#EAF3DE" :
    "#FAEEDA";

  const textColor =
    label === "Done" ? "#6B7280" :
    kind === "activity" ? "#3C3489" :
    kind === "task" ? "#27500A" :
    "#633806";

  return (
    <View style={[bs.pill, { backgroundColor: bgColor }]}>
      <Text style={[bs.pillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const bs = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: "700" as const },
});

// ── Day Detail ────────────────────────────────────────────────────────────

function DayDetail({ ymd, events }: { ymd: string; events: CalEvent[] }) {
  const colors = useColors();

  if (events.length === 0) {
    return (
      <View style={dd.empty}>
        <Text style={[dd.emptyText, { color: colors.mutedForeground }]}>
          No activity on this day
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[dd.dateLabel, { color: colors.mutedForeground }]}>
        {isoToDisplay(ymd).toUpperCase()}
      </Text>
      <View style={{ gap: 8 }}>
        {events.map((ev) => {
          const dotColor =
            ev.kind === "activity" ? "#534AB7" :
            ev.kind === "task" ? "#1D9E75" :
            "#BA7517";
          return (
            <View
              key={ev.id}
              style={[dd.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[dd.dot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[dd.title, { color: colors.foreground }]} numberOfLines={2}>
                  {ev.title}
                </Text>
                <Text style={[dd.sub, { color: colors.mutedForeground }]}>{ev.sub}</Text>
              </View>
              <BadgePill kind={ev.kind} label={ev.badge} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const dd = StyleSheet.create({
  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 13 },
  dateLabel: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.6, marginBottom: 10 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  title: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  sub: { fontSize: 11, marginTop: 2 },
});

// ── Main Component ────────────────────────────────────────────────────────

interface ContactActivityCalendarProps {
  timeline: TimelineEvent[];
  tasks: ContactTask[];
  reminders: ContactReminder[];
}

export function ContactActivityCalendar({
  timeline,
  tasks,
  reminders,
}: ContactActivityCalendarProps) {
  const colors = useColors();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedYmd, setSelectedYmd] = useState<string>(TODAY_YMD);

  const eventMap = useMemo(
    () => buildEventMap(timeline, tasks, reminders),
    [timeline, tasks, reminders]
  );

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

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
    <View>
      {/* Month nav */}
      <View style={cs.navRow}>
        <TouchableOpacity
          onPress={prevMonth}
          style={[cs.navBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[cs.monthLabel, { color: colors.foreground }]}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={[cs.navBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={cs.dowRow}>
        {DAY_LABELS.map((d) => (
          <View key={d} style={cs.dowCell}>
            <Text style={[cs.dowLabel, { color: colors.mutedForeground }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={cs.grid}>
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <View key={`empty-${i}`} style={cs.dayCellEmpty} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const ymd = ymdForDay(d);
          const meta = eventMap.get(ymd);
          const isToday = ymd === TODAY_YMD;
          const isSelected = ymd === selectedYmd;
          const hasActivity = meta?.hasActivity ?? false;
          const hasTask = meta?.hasTask ?? false;
          const hasReminder = meta?.hasReminder ?? false;
          const hasAny = hasActivity || hasTask || hasReminder;

          let cellBg = "transparent";
          let numColor = colors.mutedForeground;
          let numWeight: "400" | "600" | "700" = "400";

          if (isSelected) {
            cellBg = "#111827";
            numColor = "#fff";
            numWeight = "700";
          } else if (hasActivity) {
            cellBg = "#EEEDFE";
            numColor = "#3C3489";
            numWeight = "600";
          } else if (hasTask) {
            cellBg = "#EAF3DE";
            numColor = "#27500A";
            numWeight = "600";
          } else if (hasReminder) {
            cellBg = "#FAEEDA";
            numColor = "#633806";
            numWeight = "600";
          }

          return (
            <TouchableOpacity
              key={ymd}
              onPress={() => setSelectedYmd(ymd)}
              style={[
                cs.dayCell,
                { backgroundColor: cellBg },
                isToday && !isSelected && { borderWidth: 1.5, borderColor: "#534AB7" },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[cs.dayNum, { color: numColor, fontWeight: numWeight }]}>
                {d}
              </Text>
              {hasAny && (
                <View style={cs.dotRow}>
                  {hasActivity && (
                    <View style={[cs.dot, { backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : "#534AB7" }]} />
                  )}
                  {hasTask && (
                    <View style={[cs.dot, { backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : "#1D9E75" }]} />
                  )}
                  {hasReminder && (
                    <View style={[cs.dot, { backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : "#BA7517" }]} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={[cs.legend, { borderBottomColor: colors.border }]}>
        {([
          { color: "#EEEDFE", border: "#AFA9EC", label: "Activity" },
          { color: "#EAF3DE", border: "#97C459", label: "Task" },
          { color: "#FAEEDA", border: "#EF9F27", label: "Reminder" },
        ] as const).map((item) => (
          <View key={item.label} style={cs.legendItem}>
            <View style={[cs.legendSwatch, { backgroundColor: item.color, borderColor: item.border }]} />
            <Text style={[cs.legendLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Day detail */}
      <DayDetail ymd={selectedYmd} events={selectedEvents} />
    </View>
  );
}

const CELL_SIZE = 40;

const cs = StyleSheet.create({
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 14, fontWeight: "700" as const },

  dowRow: { flexDirection: "row", marginBottom: 4 },
  dowCell: { width: CELL_SIZE, alignItems: "center", paddingVertical: 4 },
  dowLabel: { fontSize: 10, fontWeight: "600" as const },

  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  dayCellEmpty: { width: CELL_SIZE, height: CELL_SIZE },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontSize: 12, lineHeight: 14 },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  dot: { width: 3, height: 3, borderRadius: 2 },

  legend: { flexDirection: "row", justifyContent: "center", gap: 16, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendLabel: { fontSize: 10, fontWeight: "600" as const },
});
