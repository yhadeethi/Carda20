import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, ContactTask, TimelineEvent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const TYPE_COLOR: Record<string, string> = {
  note: "#4B68F5",
  email: "#34C759",
  call: "#FF9500",
  meeting: "#7B5CF0",
  linkedin: "#0A66C2",
  scan: "#4B68F5",
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TimelineFeedProps {
  contactId: number;
  createdAt?: string;
}

export function TimelineFeed({ contactId, createdAt }: TimelineFeedProps) {
  const colors = useColors();

  const { data: events = [], isLoading: eventsLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["contact-timeline", contactId],
    queryFn: () => api.getContactTimeline(contactId),
    staleTime: 60_000,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ContactTask[]>({
    queryKey: ["contact-tasks", contactId],
    queryFn: () => api.getContactTasks(contactId),
    staleTime: 60_000,
  });

  const isLoading = eventsLoading || tasksLoading;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const openTasks = tasks.filter((t) => t.done === 0);
  const hasActivity = events.length > 0 || openTasks.length > 0;

  return (
    <View style={styles.container}>
      {/* Contact added entry */}
      <View style={styles.entry}>
        <View style={styles.dotCol}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]}>
            <Feather name="user-check" size={10} color="#fff" />
          </View>
          {hasActivity && <View style={[styles.line, { backgroundColor: colors.primary + "30" }]} />}
        </View>
        <View style={styles.entryContent}>
          <Text style={[styles.entryTitle, { color: colors.foreground }]}>Contact added</Text>
          {createdAt ? (
            <Text style={[styles.entryTime, { color: colors.mutedForeground }]}>
              {relativeTime(createdAt)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Open tasks */}
      {openTasks.map((task, i) => {
        const isLast = i === openTasks.length - 1 && events.length === 0;
        return (
          <View key={`task-${task.id}`} style={styles.entry}>
            <View style={styles.dotCol}>
              <View style={[styles.dot, styles.taskDot, { borderColor: colors.success }]}>
                <Feather name="circle" size={8} color={colors.success} />
              </View>
              {!isLast && <View style={[styles.line, { backgroundColor: colors.primary + "30" }]} />}
            </View>
            <View style={styles.entryContent}>
              <Text style={[styles.entryTitle, { color: colors.foreground }]}>{task.title}</Text>
              {task.dueAt ? (
                <Text style={[styles.entryTime, { color: colors.mutedForeground }]}>
                  Due {new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              ) : (
                <Text style={[styles.entryTime, { color: colors.mutedForeground }]}>Task</Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Timeline events */}
      {events.map((event, i) => {
        const dotColor = TYPE_COLOR[event.type] ?? colors.primary;
        const isLast = i === events.length - 1;
        return (
          <View key={`event-${event.id}`} style={styles.entry}>
            <View style={styles.dotCol}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={[styles.line, { backgroundColor: colors.primary + "30" }]} />}
            </View>
            <View style={styles.entryContent}>
              <Text style={[styles.entryTitle, { color: colors.foreground }]}>{event.summary}</Text>
              <Text style={[styles.entryTime, { color: colors.mutedForeground }]}>
                {relativeTime(event.eventAt)}
              </Text>
            </View>
          </View>
        );
      })}

      {!hasActivity && (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No activity yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  loading: { paddingVertical: 16, alignItems: "center" },
  entry: { flexDirection: "row", gap: 12, minHeight: 40 },
  dotCol: { alignItems: "center", width: 20 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  taskDot: {
    backgroundColor: "#fff",
    borderWidth: 2,
  },
  line: { flex: 1, width: 1.5, marginTop: 2, marginBottom: -4 },
  entryContent: { flex: 1, paddingBottom: 16 },
  entryTitle: { fontSize: 14, fontWeight: "500" as const, lineHeight: 20 },
  entryTime: { fontSize: 12, marginTop: 1 },
  emptyText: { fontSize: 13, paddingLeft: 32, paddingVertical: 8 },
});
