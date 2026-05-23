import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { UserEvent } from "@/lib/api";

interface EventCardProps {
  event: UserEvent;
  onPress: () => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventCard({ event, onPress }: EventCardProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: event.isActive ? colors.primary : colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: event.isActive
              ? colors.primary + "22"
              : colors.secondary,
            borderRadius: colors.radius - 4,
          },
        ]}
      >
        <Feather
          name="calendar"
          size={22}
          color={event.isActive ? colors.primary : colors.mutedForeground}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.name, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {event.title}
          </Text>
          {event.isActive ? (
            <View
              style={[styles.activeDot, { backgroundColor: colors.primary }]}
            />
          ) : null}
        </View>
        {event.locationLabel ? (
          <View style={styles.row}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text
              style={[styles.meta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {event.locationLabel}
            </Text>
          </View>
        ) : null}
        {event.startedAt ? (
          <View style={styles.row}>
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {formatDate(event.startedAt)}
            </Text>
          </View>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "600" as const,
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
  },
});
