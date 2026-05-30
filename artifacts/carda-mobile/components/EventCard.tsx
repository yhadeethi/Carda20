import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { UserEvent } from "@/lib/api";

interface EventCardProps {
  event: UserEvent;
  onPress: () => void;
  attendeeCount?: number;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function EventCard({ event, onPress, attendeeCount }: EventCardProps) {
  const colors = useColors();
  const isActive = !!event.isActive;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: isActive ? colors.primary + "44" : colors.cardBorder },
        isActive && { borderWidth: 1.5 },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isActive ? colors.primary + "15" : colors.secondary },
        ]}
      >
        <Feather name="calendar" size={20} color={isActive ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {event.title}
          </Text>
          {isActive && (
            <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.activeBadgeText}>Live</Text>
            </View>
          )}
        </View>
        <View style={styles.metaGroup}>
          {event.locationLabel ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {event.locationLabel}
              </Text>
            </View>
          ) : null}
          {event.startedAt ? (
            <View style={styles.metaRow}>
              <Feather name="clock" size={11} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {formatDate(event.startedAt)}
              </Text>
            </View>
          ) : null}
          {attendeeCount !== undefined ? (
            <View style={styles.metaRow}>
              <Feather name="users" size={11} color={colors.primary} />
              <Text style={[styles.meta, { color: colors.primary }]}>
                {attendeeCount} {attendeeCount === 1 ? "attendee" : "attendees"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  name: { fontSize: 14, fontWeight: "700" as const, flex: 1 },
  activeBadge: {
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" as const },
  metaGroup: { gap: 2 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  meta: { fontSize: 12, fontWeight: "500" as const },
});
