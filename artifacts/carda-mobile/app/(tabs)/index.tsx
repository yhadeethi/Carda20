import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContactCard } from "@/components/ContactCard";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

function formatDate(): string {
  const now = new Date();
  const dow = now.toLocaleDateString("en-US", { weekday: "short" });
  const day = now.getDate();
  const mon = now.toLocaleDateString("en-US", { month: "short" });
  return `${dow} ${day} ${mon}`;
}

function makeLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      iso: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      isToday: i === 6,
    };
  });
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
  });

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const scanned7d = useMemo(
    () => contacts.filter((c) => c.createdAt && new Date(c.createdAt) >= sevenDaysAgo).length,
    [contacts, sevenDaysAgo]
  );

  const recentCaptures = useMemo(
    () =>
      [...contacts]
        .filter((c) => !!c.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 5),
    [contacts]
  );

  const chartDays = useMemo(() => makeLast7Days(), []);
  const chartData = useMemo(
    () =>
      chartDays.map((d) => ({
        ...d,
        count: contacts.filter((c) => c.createdAt?.startsWith(d.iso)).length,
      })),
    [chartDays, contacts]
  );
  const maxCount = useMemo(() => Math.max(...chartData.map((d) => d.count), 1), [chartData]);

  const s = styles(colors);

  return (
    <SafeAreaView style={s.bg} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.dateText}>{formatDate()}</Text>
            <Text style={s.greetingText}>{getGreeting()}</Text>
            {scanned7d > 0 && (
              <Text style={s.subtitleText}>{scanned7d} scanned this week</Text>
            )}
          </View>
        </View>

        {/* ── Search bar (taps to Network tab) ───────────────────── */}
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => router.push("/(tabs)/network" as any)}
          activeOpacity={0.75}
        >
          <Feather name="search" size={15} color={colors.mutedForeground} style={{ opacity: 0.45 }} />
          <Text style={s.searchPlaceholder}>Search contacts, companies…</Text>
        </TouchableOpacity>

        {/* ── Stats strip ────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Contacts</Text>
            <Text style={[s.statValue, { color: colors.primary }]}>{contacts.length}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Scanned 7d</Text>
            <Text
              style={[
                s.statValue,
                scanned7d > 0 ? { color: "#10B981" } : { color: colors.mutedForeground, opacity: 0.35 },
              ]}
            >
              {scanned7d}
            </Text>
          </View>
          <TouchableOpacity
            style={s.statCard}
            activeOpacity={0.75}
            onPress={() => router.push("/(tabs)/network" as any)}
          >
            <Text style={s.statLabel}>Network</Text>
            <Feather name="arrow-right" size={18} color={colors.primary} style={{ marginTop: 2 }} />
          </TouchableOpacity>
        </View>

        {/* ── Weekly captures chart ──────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Weekly captures</Text>
            {scanned7d > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>🔥 {scanned7d} this week</Text>
              </View>
            )}
          </View>
          <View style={s.chartCard}>
            <View style={s.chart}>
              {chartData.map((d) => (
                <View key={d.iso} style={s.chartCol}>
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.bar,
                        {
                          height: Math.max(4, (d.count / maxCount) * 72),
                          backgroundColor: d.isToday ? colors.primary : colors.border,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      s.chartDayLabel,
                      {
                        color: d.isToday ? colors.primary : colors.mutedForeground,
                        fontWeight: d.isToday ? "700" : "500",
                      },
                    ]}
                  >
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.chartSubtitle}>Tap + below to keep the streak going.</Text>
          </View>
        </View>

        {/* ── Recent captures ────────────────────────────────────── */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : recentCaptures.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent captures</Text>
              {contacts.length > 5 && (
                <TouchableOpacity onPress={() => router.push("/(tabs)/network" as any)}>
                  <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.list}>
              {recentCaptures.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  onPress={() => router.push(`/contact/${c.id}` as any)}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={s.empty}>
            <Feather name="users" size={44} color={colors.border} />
            <Text style={s.emptyTitle}>Your network starts here</Text>
            <Text style={s.emptyBody}>
              Tap the + button below to scan your first business card
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 130, paddingTop: 6 },

    header: { marginBottom: 14 },
    dateText: { fontSize: 13, color: colors.mutedForeground, marginBottom: 2 },
    greetingText: { fontSize: 26, fontWeight: "700", color: colors.foreground, letterSpacing: -0.4 },
    subtitleText: { fontSize: 13, color: colors.mutedForeground, marginTop: 3, opacity: 0.7 },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
      marginBottom: 14,
    },
    searchPlaceholder: { flex: 1, fontSize: 14, color: colors.mutedForeground, opacity: 0.6 },

    statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    statLabel: { fontSize: 11, fontWeight: "600", color: colors.mutedForeground, marginBottom: 4 },
    statValue: { fontSize: 22, fontWeight: "700" },

    section: { marginBottom: 20 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    viewAll: { fontSize: 12, fontWeight: "600" },
    badge: {
      backgroundColor: "#F0FDF4",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: "#BBF7D0",
    },
    badgeText: { fontSize: 11, fontWeight: "700", color: "#059669" },

    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    chart: { flexDirection: "row", alignItems: "flex-end", height: 96, gap: 5 },
    chartCol: { flex: 1, alignItems: "center", gap: 5 },
    barTrack: { flex: 1, justifyContent: "flex-end", width: "100%" },
    bar: { width: "100%", borderRadius: 6 },
    chartDayLabel: { fontSize: 11 },
    chartSubtitle: { fontSize: 11, color: colors.mutedForeground, opacity: 0.55, marginTop: 10 },

    list: { gap: 8 },

    empty: { alignItems: "center", paddingVertical: 56, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    emptyBody: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      paddingHorizontal: 20,
    },
  });
}
