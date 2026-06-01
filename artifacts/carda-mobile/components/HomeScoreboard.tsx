import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { Contact, ContactReminder } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

function makeLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      iso: d.toISOString().split("T")[0],
      label: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()],
      isToday: i === 6,
    };
  });
}

const CHART_DAYS = makeLast7Days();

type UpNextGroup = "today" | "tomorrow" | "thisWeek";

interface UpNextItem {
  reminder: ContactReminder;
  contact: Contact;
  group: UpNextGroup;
}

interface HomeScorebordProps {
  contacts: Contact[];
  followUps: number;
  upNextItems: UpNextItem[];
  scanned7d: number;
  needsAttention: Contact[];
  recentCaptures: Contact[];
  isLoading: boolean;
  onDebrief: () => void;
}

function daysSince(dateStr?: string) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function HomeScoreboard({
  contacts,
  followUps,
  upNextItems,
  scanned7d,
  needsAttention,
  recentCaptures,
  isLoading,
  onDebrief,
}: HomeScorebordProps) {
  const colors = useColors();
  const router = useRouter();

  const chartData = CHART_DAYS.map((d) => ({
    ...d,
    count: contacts.filter((c) => c.createdAt?.startsWith(d.iso)).length,
  }));
  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <>
      {/* Stats strip */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Contacts</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{contacts.length}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Follow-ups</Text>
          <Text style={[styles.statValue, followUps > 0 ? { color: "#F59E0B" } : { color: colors.mutedForeground, opacity: 0.35 }]}>
            {followUps}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Scanned 7d</Text>
          <Text style={[styles.statValue, scanned7d > 0 ? { color: colors.success } : { color: colors.mutedForeground, opacity: 0.35 }]}>
            {scanned7d}
          </Text>
        </View>
      </View>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Needs attention</Text>
            <View style={[styles.attentionBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
              <Text style={[styles.attentionBadgeText, { color: "#D97706" }]}>
                {needsAttention.length} contact{needsAttention.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <GlassCard style={{ padding: 0 }}>
            {needsAttention.map((c) => {
              const displayName = c.fullName || c.email || "Unknown";
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => router.push(`/contact/${c.id}` as any)}
                  style={[styles.attentionRow, { borderBottomColor: colors.border }]}
                  activeOpacity={0.75}
                >
                  <Avatar name={displayName} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.attentionName, { color: colors.foreground }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text style={[styles.attentionMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {c.companyName || c.jobTitle || "No company"}
                    </Text>
                  </View>
                  <View style={styles.daysBadge}>
                    <Text style={styles.daysText}>{daysSince(c.createdAt)}d ago</Text>
                  </View>
                  <TouchableOpacity onPress={onDebrief} activeOpacity={0.82}>
                    <LinearGradient
                      colors={["#4B68F5", "#7B5CF0"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.debriefBtn}
                    >
                      <Feather name="mic" size={12} color="#fff" />
                      <Text style={styles.debriefText}>Debrief</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        </View>
      )}

      {/* Up next */}
      {upNextItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Up next</Text>
            <View style={[styles.badge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
              <Text style={[styles.badgeText, { color: "#D97706" }]}>
                🔔 {upNextItems.length} reminder{upNextItems.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <GlassCard style={{ padding: 0 }}>
            {(["today", "tomorrow", "thisWeek"] as UpNextGroup[]).map((key) => {
              const label = key === "today" ? "Today" : key === "tomorrow" ? "Tomorrow" : "This Week";
              const groupItems = upNextItems.filter((i) => i.group === key);
              if (!groupItems.length) return null;
              return (
                <View key={key}>
                  <View style={[styles.groupHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
                  </View>
                  {groupItems.map((item) => {
                    const name = item.contact.fullName || item.contact.email || "Contact";
                    const remindDate = new Date(item.reminder.remindAt);
                    return (
                      <TouchableOpacity
                        key={item.reminder.id}
                        onPress={() => router.push(`/contact/${item.contact.id}` as any)}
                        style={[styles.upNextRow, { borderBottomColor: colors.border }]}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.upNextIcon, { backgroundColor: "#FEF3C7" }]}>
                          <Feather name="bell" size={14} color="#D97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.upNextLabel, { color: colors.foreground }]} numberOfLines={1}>
                            {item.reminder.label}
                          </Text>
                          <Text style={[styles.upNextMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {name} · {remindDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </GlassCard>
        </View>
      )}

      {/* This week chart */}
      {!isLoading && contacts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>This week</Text>
            {scanned7d > 0 && (
              <View style={[styles.badge, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Text style={[styles.badgeText, { color: "#059669" }]}>🔥 {scanned7d} scanned</Text>
              </View>
            )}
          </View>
          <GlassCard>
            <View style={styles.chart}>
              {chartData.map((d) => (
                <View key={d.iso} style={styles.chartCol}>
                  <Text style={[styles.chartCount, { color: d.isToday ? colors.primary : colors.mutedForeground, opacity: d.count > 0 ? 1 : 0 }]}>
                    {d.count || " "}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: Math.max(4, (d.count / maxCount) * 72), backgroundColor: d.isToday ? colors.primary : colors.border }]} />
                  </View>
                  <Text style={[styles.chartDayLabel, { color: d.isToday ? colors.primary : colors.mutedForeground, fontWeight: d.isToday ? "700" : "500" }]}>
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[styles.chartSubtitle, { color: colors.mutedForeground }]}>
              Tap + below to keep the streak going.
            </Text>
          </GlassCard>
        </View>
      )}

      {/* Recent captures */}
      {!isLoading && recentCaptures.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Recent captures</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {recentCaptures.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => router.push(`/contact/${c.id}` as any)}
                style={[styles.captureCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.75}
              >
                <Avatar name={c.fullName || c.email} size={40} />
                <Text style={[styles.captureName, { color: colors.foreground }]} numberOfLines={2}>
                  {c.fullName || c.email || "Unknown"}
                </Text>
                <Text style={[styles.captureMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {c.companyName || c.jobTitle || "No company"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  statLabel: { fontSize: 11, fontWeight: "600" as const, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "700" as const },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "600" as const },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700" as const },
  attentionBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  attentionBadgeText: { fontSize: 11, fontWeight: "700" as const },
  attentionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
  attentionName: { fontSize: 14, fontWeight: "600" as const },
  attentionMeta: { fontSize: 12, marginTop: 1 },
  daysBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  daysText: { fontSize: 11, fontWeight: "700" as const, color: "#D97706" },
  debriefBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  debriefText: { fontSize: 12, fontWeight: "600" as const, color: "#fff" },
  groupHeader: { paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1 },
  groupLabel: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.7 },
  upNextRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
  upNextIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  upNextLabel: { fontSize: 13, fontWeight: "600" as const },
  upNextMeta: { fontSize: 11, marginTop: 1 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 106, gap: 5 },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { flex: 1, justifyContent: "flex-end", width: "100%" },
  bar: { width: "100%", borderRadius: 6 },
  chartCount: { fontSize: 11, fontWeight: "700" as const, textAlign: "center" as const },
  chartDayLabel: { fontSize: 11 },
  chartSubtitle: { fontSize: 11, opacity: 0.55, marginTop: 10 },
  captureCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" as const, gap: 6 },
  captureName: { fontSize: 12, fontWeight: "600" as const, textAlign: "center" as const },
  captureMeta: { fontSize: 11, textAlign: "center" as const },
});
