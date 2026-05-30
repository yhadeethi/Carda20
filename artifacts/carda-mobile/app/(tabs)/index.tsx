import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ContactCard } from "@/components/ContactCard";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { api, Contact } from "@/lib/api";
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

function daysSince(dateStr?: string): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

interface CreateContactModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}

function CreateContactModal({ visible, onClose, onCreated }: CreateContactModalProps) {
  const colors = useColors();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    jobTitle: "",
    companyName: "",
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.fullName.trim() && !form.email.trim()) {
      Alert.alert("Name or email required", "Please enter at least a name or email.");
      return;
    }
    setSaving(true);
    try {
      const saved = await api.createContact({
        fullName: form.fullName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
      });
      setForm({ fullName: "", email: "", phone: "", jobTitle: "", companyName: "" });
      onCreated(saved.id);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not create contact.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, opts?: { keyboard?: any }) => (
    <View key={key} style={ccStyles.field}>
      <Text style={[ccStyles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm((p) => ({ ...p, [key]: v }))}
        style={[ccStyles.fieldInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
        placeholderTextColor={colors.mutedForeground}
        placeholder={`Enter ${label.toLowerCase()}`}
        keyboardType={opts?.keyboard ?? "default"}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ccStyles.overlay}>
        <View style={[ccStyles.sheet, { backgroundColor: colors.card }]}>
          <View style={ccStyles.handle} />
          <View style={ccStyles.header}>
            <Text style={[ccStyles.title, { color: colors.foreground }]}>New Contact</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {field("Full Name", "fullName")}
          {field("Email", "email", { keyboard: "email-address" })}
          {field("Phone", "phone", { keyboard: "phone-pad" })}
          {field("Job Title", "jobTitle")}
          {field("Company", "companyName")}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={saving}
            style={[ccStyles.saveBtn, { backgroundColor: colors.primary }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={ccStyles.saveBtnText}>Create Contact</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ccStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginBottom: 8,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 17, fontWeight: "700" as const },
  field: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
});

interface NeedsAttentionRowProps {
  contact: Contact;
  onDebrief: () => void;
}

function NeedsAttentionRow({ contact, onDebrief }: NeedsAttentionRowProps) {
  const colors = useColors();
  const router = useRouter();
  const days = daysSince(contact.createdAt);
  const displayName = contact.fullName || contact.email || "Unknown";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/contact/${contact.id}` as any)}
      style={[naStyles.row, { borderBottomColor: colors.border }]}
      activeOpacity={0.75}
    >
      <Avatar name={displayName} size={38} />
      <View style={naStyles.info}>
        <Text style={[naStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[naStyles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {contact.companyName || contact.jobTitle || "No company"}
        </Text>
      </View>
      <View style={[naStyles.daysBadge, { backgroundColor: "#FEF3C7" }]}>
        <Text style={naStyles.daysText}>{days}d</Text>
      </View>
      <TouchableOpacity
        onPress={onDebrief}
        style={[naStyles.debriefBtn, { backgroundColor: colors.purple + "18", borderColor: colors.purple + "33" }]}
      >
        <Feather name="mic" size={12} color={colors.purple} />
        <Text style={[naStyles.debriefText, { color: colors.purple }]}>Debrief</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const naStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "600" as const },
  meta: { fontSize: 12, marginTop: 1 },
  daysBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  daysText: { fontSize: 11, fontWeight: "700" as const, color: "#D97706" },
  debriefBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  debriefText: { fontSize: 12, fontWeight: "600" as const },
});

interface HomeScreenProps {
  onOpenCapture?: () => void;
}

export default function HomeScreen({ onOpenCapture }: HomeScreenProps) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
  });

  const sevenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d;
  }, []);

  const fourteenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 14); return d;
  }, []);

  const scanned7d = useMemo(
    () => contacts.filter((c) => c.createdAt && new Date(c.createdAt) >= sevenDaysAgo).length,
    [contacts, sevenDaysAgo]
  );

  const followUps = useMemo(
    () => contacts.filter((c) => c.createdAt && new Date(c.createdAt) < sevenDaysAgo).length,
    [contacts, sevenDaysAgo]
  );

  const needsAttention = useMemo(
    () =>
      contacts
        .filter((c) => c.createdAt && new Date(c.createdAt) < fourteenDaysAgo)
        .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
        .slice(0, 3),
    [contacts, fourteenDaysAgo]
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

  const paddingBottom = insets.bottom + 100;
  const s = styles(colors);

  return (
    <SafeAreaView style={s.bg} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.dateText}>{formatDate()}</Text>
            <Text style={s.greetingText}>{getGreeting()}</Text>
            {(contacts.length > 0 || followUps > 0) && (
              <Text style={s.subtitleText}>
                {followUps > 0 ? `${followUps} follow-ups · ` : ""}
                {scanned7d > 0 ? `${scanned7d} scanned this week` : `${contacts.length} contacts`}
              </Text>
            )}
          </View>
          {/* Bell icon (visual only) */}
          <TouchableOpacity style={s.bellBtn}>
            <Feather name="bell" size={20} color={colors.mutedForeground} />
            {followUps > 0 && (
              <View style={[s.bellBadge, { backgroundColor: "#F59E0B" }]}>
                <Text style={s.bellBadgeText}>{followUps > 9 ? "9+" : followUps}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Search bar ──────────────────────────────────────────── */}
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
            <Text style={s.statLabel}>Follow-ups</Text>
            <Text
              style={[
                s.statValue,
                followUps > 0 ? { color: "#F59E0B" } : { color: colors.mutedForeground, opacity: 0.35 },
              ]}
            >
              {followUps}
            </Text>
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

        {/* ── Needs Attention ────────────────────────────────────── */}
        {needsAttention.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Needs attention</Text>
              <View style={[s.attentionBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Text style={[s.attentionBadgeText, { color: "#D97706" }]}>
                  {needsAttention.length} contacts
                </Text>
              </View>
            </View>
            <GlassCard style={{ padding: 0 }}>
              {needsAttention.map((c) => (
                <NeedsAttentionRow
                  key={c.id}
                  contact={c}
                  onDebrief={() =>
                    Alert.alert(
                      "Voice Debrief",
                      "Voice debriefs are coming soon. Log a note on the contact page in the meantime.",
                      [{ text: "OK" }]
                    )
                  }
                />
              ))}
            </GlassCard>
          </View>
        )}

        {/* ── Calendar briefing teaser ────────────────────────────── */}
        <View style={s.section}>
          <GlassCard style={s.calTeaser}>
            <View style={[s.calIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="calendar" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.calTitle, { color: colors.foreground }]}>Connect your calendar</Text>
              <Text style={[s.calSub, { color: colors.mutedForeground }]}>See who you're meeting today</Text>
            </View>
            <View style={[s.comingSoonBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[s.comingSoonText, { color: colors.mutedForeground }]}>Soon</Text>
            </View>
          </GlassCard>
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

        {/* ── Bottom action buttons ───────────────────────────────── */}
        <View style={s.bottomActions}>
          <TouchableOpacity
            style={[s.scanBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/scan" as any)}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={16} color="#fff" />
            <Text style={s.scanBtnText}>Scan a business card</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.createBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.75}
          >
            <Feather name="user-plus" size={16} color={colors.foreground} />
            <Text style={[s.createBtnText, { color: colors.foreground }]}>Create contact</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CreateContactModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async (id) => {
          await qc.invalidateQueries({ queryKey: ["/api/contacts"] });
          setShowCreate(false);
          router.push(`/contact/${id}` as any);
        }}
      />
    </SafeAreaView>
  );
}

function styles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 6 },

    header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
    dateText: { fontSize: 13, color: colors.mutedForeground, marginBottom: 2 },
    greetingText: { fontSize: 26, fontWeight: "700", color: colors.foreground, letterSpacing: -0.4 },
    subtitleText: { fontSize: 13, color: colors.mutedForeground, marginTop: 3, opacity: 0.7 },
    bellBtn: { marginTop: 6, padding: 4, position: "relative" },
    bellBadge: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

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
    attentionBadge: {
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
    },
    attentionBadgeText: { fontSize: 11, fontWeight: "700" },

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

    calTeaser: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    } as any,
    calIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    calTitle: { fontSize: 14, fontWeight: "600" as const },
    calSub: { fontSize: 12, marginTop: 1 },
    comingSoonBadge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    comingSoonText: { fontSize: 11, fontWeight: "600" as const },

    list: { gap: 8 },

    empty: { alignItems: "center", paddingVertical: 56, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    emptyBody: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      paddingHorizontal: 20,
    },

    bottomActions: { gap: 10, marginTop: 4, marginBottom: 8 },
    scanBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      paddingVertical: 15,
      shadowColor: "#3B82F6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    scanBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      paddingVertical: 14,
      borderWidth: 1,
    },
    createBtnText: { fontSize: 15, fontWeight: "600" },
  });
}
