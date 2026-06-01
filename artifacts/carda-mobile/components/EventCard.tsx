import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Fonts } from "@/constants/fonts";
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
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      {/* Top row: gradient calendar icon + title + active badge */}
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={colors.BRAND_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Feather name="calendar" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {event.title}
          </Text>
          {isActive && (
            <View style={styles.activeRow}>
              <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.activeText, { color: colors.success }]}>Active</Text>
            </View>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.separator }]} />

      {/* Meta rows */}
      <View style={styles.metaGroup}>
        {event.locationLabel ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {event.locationLabel}
            </Text>
          </View>
        ) : null}
        {event.startedAt ? (
          <View style={styles.metaRow}>
            <Feather name="calendar" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatDate(event.startedAt)}
            </Text>
          </View>
        ) : null}
        {attendeeCount !== undefined && attendeeCount > 0 ? (
          <View style={styles.metaRow}>
            <Feather name="users" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {attendeeCount} {attendeeCount === 1 ? "contact" : "contacts"}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Chevron */}
      <View style={styles.chevronRow}>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground + "70"} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", fontFamily: Fonts.semiBold },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  activeDot: { width: 7, height: 7, borderRadius: 3.5 },
  activeText: { fontSize: 12, fontWeight: "600", fontFamily: Fonts.semiBold },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  metaGroup: { gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 },
  metaText: { fontSize: 13, flex: 1, fontFamily: Fonts.regular },
  chevronRow: { alignItems: "flex-end", marginTop: 8 },
});
