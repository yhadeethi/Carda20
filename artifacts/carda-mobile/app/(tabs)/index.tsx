import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
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
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { api, Contact, ContactReminder } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { useCapture } from "@/context/CaptureContext";

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

// ── Create Contact Modal ──────────────────────────────────────────────────────

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

  const reset = () => setForm({ fullName: "", email: "", phone: "", jobTitle: "", companyName: "" });

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
      reset();
      onCreated(saved.id);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not create contact.");
    } finally {
      setSaving(false);
    }
  };

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

          {(["fullName", "email", "phone", "jobTitle", "companyName"] as const).map((key) => {
            const labels: Record<typeof key, string> = {
              fullName: "Full Name",
              email: "Email",
              phone: "Phone",
              jobTitle: "Job Title",
              companyName: "Company",
            };
            const keyboards: Record<typeof key, any> = {
              fullName: "default",
              email: "email-address",
              phone: "phone-pad",
              jobTitle: "default",
              companyName: "default",
            };
            return (
              <View key={key} style={ccStyles.field}>
                <Text style={[ccStyles.fieldLabel, { color: colors.mutedForeground }]}>
                  {labels[key]}
                </Text>
                <TextInput
                  value={form[key]}
                  onChangeText={(v) => setForm((p) => ({ ...p, [key]: v }))}
                  style={[
                    ccStyles.fieldInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder={`Enter ${labels[key].toLowerCase()}`}
                  keyboardType={keyboards[key]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            );
          })}

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
    paddingBottom: 36,
    gap: 10,
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

// ── Needs Attention Row ────────────────────────────────────────────────────────

function NeedsAttentionRow({
  contact,
  daysSinceCreated,
  onDebrief,
}: {
  contact: Contact;
  daysSinceCreated: number;
  onDebrief: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
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
      <View style={naStyles.daysBadge}>
        <Text style={naStyles.daysText}>{daysSinceCreated}d ago</Text>
      </View>
      <TouchableOpacity
        onPress={onDebrief}
        style={[naStyles.debriefBtn, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}
      >
        <Feather name="mic" size={12} color="#6366F1" />
        <Text style={[naStyles.debriefText, { color: "#6366F1" }]}>Debrief</Text>
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
    backgroundColor: "#FEF3C7",
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

// ── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const capture = useCapture();
  const [showCreate, setShowCreate] = useState(false);

  // ── Contacts query ──────────────────────────────────────────────────────
  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
  });

  // ── Batch-fetch tasks for all contacts to count open follow-ups ─────────
  const taskQueries = useQueries({
    queries: contacts.map((c) => ({
      queryKey: ["contact-tasks", c.id],
      queryFn: () => api.getContactTasks(c.id),
      staleTime: 60_000,
    })),
  });

  // ── Batch-fetch reminders for all contacts ──────────────────────────────
  const reminderQueries = useQueries({
    queries: contacts.map((c) => ({
      queryKey: ["contact-reminders", c.id],
      queryFn: () => api.getContactReminders(c.id),
      staleTime: 60_000,
    })),
  });

  const followUps = useMemo(
    () =>
      taskQueries.reduce(
        (sum, q) => sum + (q.data?.filter((t) => t.done === 0).length ?? 0),
        0
      ),
    [taskQueries]
  );

  type UpNextItem = {
    reminder: ContactReminder;
    contact: Contact;
    group: "today" | "tomorrow" | "thisWeek";
  };

  const upNextItems = useMemo<UpNextItem[]>(() => {
    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    const weekEnd = new Date(now); weekEnd.setHours(0, 0, 0, 0); weekEnd.setDate(weekEnd.getDate() + 7);

    const items: UpNextItem[] = [];
    reminderQueries.forEach((q, i) => {
      const contact = contacts[i];
      if (!contact || !q.data) return;
      q.data.forEach((r) => {
        if (r.done === 1) return;
        const d = new Date(r.remindAt);
        if (d <= todayEnd) {
          items.push({ reminder: r, contact, group: "today" });
        } else if (d <= tomorrowEnd) {
          items.push({ reminder: r, contact, group: "tomorrow" });
        } else if (d <= weekEnd) {
          items.push({ reminder: r, contact, group: "thisWeek" });
        }
      });
    });
    return items.sort((a, b) => new Date(a.reminder.remindAt).getTime() - new Date(b.reminder.remindAt).getTime());
  }, [reminderQueries, contacts]);

  // ── Derived stats ────────────────────────────────────────────────────────
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

  // Needs attention: contacts added > 14 days ago with no recorded notes
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
        .slice(0, 3),
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

  // Tab bar height for pinned buttons bottom padding
  const TAB_BAR_HEIGHT = 56 + insets.bottom;

  const s = styles(colors);

  return (
    <SafeAreaView style={s.bg} edges={["top"]}>
      {/* ── Scrollable content ─────────────────────────────────────── */}
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
          <View style={{ flex: 1 }}>
            <Text style={s.dateText}>{formatDate()}</Text>
            <Text style={s.greetingText}>{getGreeting()}</Text>
            {(contacts.length > 0 || scanned7d > 0) && (
              <Text style={s.subtitleText}>
                {scanned7d > 0 ? `${scanned7d} scanned this week` : `${contacts.length} contacts`}
              </Text>
            )}
          </View>
          <TouchableOpacity style={s.bellBtn} activeOpacity={0.75}>
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

        {/* ── Needs Attention ────────────────────────────────────── */}
        {needsAttention.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Needs attention</Text>
              <View style={[s.attentionBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Text style={[s.attentionBadgeText, { color: "#D97706" }]}>
                  {needsAttention.length} contact{needsAttention.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <GlassCard style={{ padding: 0 }}>
              {needsAttention.map((c) => (
                <NeedsAttentionRow
                  key={c.id}
                  contact={c}
                  daysSinceCreated={daysSince(c.createdAt)}
                  onDebrief={() => capture.openCapture("voice")}
                />
              ))}
            </GlassCard>
          </View>
        )}

        {/* ── Up Next ─────────────────────────────────────────────── */}
        {upNextItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Up next</Text>
              <View style={[s.badge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Text style={[s.badgeText, { color: "#D97706" }]}>
                  🔔 {upNextItems.length} reminder{upNextItems.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <GlassCard style={{ padding: 0 }}>
              {(() => {
                const groups: Array<{ key: "today" | "tomorrow" | "thisWeek"; label: string }> = [
                  { key: "today", label: "Today" },
                  { key: "tomorrow", label: "Tomorrow" },
                  { key: "thisWeek", label: "This Week" },
                ];
                return groups.map(({ key, label }) => {
                  const groupItems = upNextItems.filter((i) => i.group === key);
                  if (groupItems.length === 0) return null;
                  return (
                    <View key={key}>
                      <View style={[s.upNextGroupHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[s.upNextGroupLabel, { color: colors.mutedForeground }]}>
                          {label}
                        </Text>
                      </View>
                      {groupItems.map((item) => {
                        const contactName = item.contact.fullName || item.contact.email || "Contact";
                        const remindDate = new Date(item.reminder.remindAt);
                        return (
                          <TouchableOpacity
                            key={item.reminder.id}
                            onPress={() => router.push(`/contact/${item.contact.id}` as any)}
                            style={[s.upNextRow, { borderBottomColor: colors.border }]}
                            activeOpacity={0.75}
                          >
                            <View style={[s.upNextIcon, { backgroundColor: "#FEF3C7" }]}>
                              <Feather name="bell" size={14} color="#D97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.upNextLabel, { color: colors.foreground }]} numberOfLines={1}>
                                {item.reminder.label}
                              </Text>
                              <Text style={[s.upNextMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                                {contactName}
                                {" · "}
                                {remindDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </Text>
                            </View>
                            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                });
              })()}
            </GlassCard>
          </View>
        )}

        {/* ── This week chart (below Up Next) ────────────────────── */}
        {isLoading ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={[s.skeletonLine, { width: 70, height: 13 }]} />
            </View>
            <View style={[s.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.chart}>
                {[0.45, 0.7, 0.3, 0.85, 0.55, 0.65, 0.9].map((h, i) => (
                  <View key={i} style={s.chartCol}>
                    <View style={[s.skeletonLine, { width: "100%", height: 11, marginBottom: 3 }]} />
                    <View style={s.barTrack}>
                      <View style={[s.bar, { height: Math.max(4, h * 72), backgroundColor: colors.border }]} />
                    </View>
                    <View style={[s.skeletonLine, { width: 14, height: 10 }]} />
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : contacts.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>This week</Text>
              {scanned7d > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>🔥 {scanned7d} scanned</Text>
                </View>
              )}
            </View>
            <View style={[s.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.chart}>
                {chartData.map((d) => (
                  <View key={d.iso} style={s.chartCol}>
                    <Text
                      style={[
                        s.chartCount,
                        {
                          color: d.isToday ? colors.primary : colors.mutedForeground,
                          opacity: d.count > 0 ? 1 : 0,
                        },
                      ]}
                    >
                      {d.count || " "}
                    </Text>
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
                          fontWeight: (d.isToday ? "700" : "500") as "700" | "500",
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
        ) : null}

        {/* ── Recent captures ────────────────────────────────────── */}
        {isLoading ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={[s.skeletonLine, { width: 110, height: 13 }]} />
            </View>
            <GlassCard padding={0} style={{ overflow: "hidden" } as any}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    s.captureRow,
                    i > 1 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[s.skeletonCircle, { width: 36, height: 36 }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={[s.skeletonLine, { width: "55%", height: 12 }]} />
                    <View style={[s.skeletonLine, { width: "38%", height: 10 }]} />
                  </View>
                </View>
              ))}
            </GlassCard>
          </View>
        ) : recentCaptures.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent captures</Text>
              {contacts.length > 3 && (
                <TouchableOpacity onPress={() => router.push("/(tabs)/network" as any)}>
                  <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                </TouchableOpacity>
              )}
            </View>
            <GlassCard padding={0} style={{ overflow: "hidden" } as any}>
              {recentCaptures.map((c, idx) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => router.push(`/contact/${c.id}` as any)}
                  style={[
                    s.captureRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                  activeOpacity={0.75}
                >
                  <Avatar name={c.fullName || c.email} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.captureName, { color: colors.foreground }]} numberOfLines={1}>
                      {c.fullName || c.email || "Unknown"}
                    </Text>
                    <Text style={[s.captureMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {c.companyName || c.jobTitle || "No company"}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </GlassCard>
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

      {/* ── Pinned bottom actions (above tab bar) ─────────────────── */}
      <View style={[s.bottomActions, { paddingBottom: TAB_BAR_HEIGHT + 8 }]}>
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
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 },

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
    attentionBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
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
    chart: { flexDirection: "row", alignItems: "flex-end", height: 106, gap: 5 },
    chartCol: { flex: 1, alignItems: "center", gap: 4 },
    barTrack: { flex: 1, justifyContent: "flex-end", width: "100%" },
    bar: { width: "100%", borderRadius: 6 },
    chartCount: { fontSize: 11, fontWeight: "700" as const, textAlign: "center" as const },
    chartDayLabel: { fontSize: 11 },
    chartSubtitle: { fontSize: 11, color: colors.mutedForeground, opacity: 0.55, marginTop: 10 },

    captureRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    captureName: { fontSize: 14, fontWeight: "600" as const },
    captureMeta: { fontSize: 12, marginTop: 2 },

    skeletonLine: { backgroundColor: colors.border, borderRadius: 4, opacity: 0.6 },
    skeletonCircle: { borderRadius: 18, backgroundColor: colors.border, opacity: 0.6 },

    calTeaser: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 } as any,
    calIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    calTitle: { fontSize: 14, fontWeight: "600" as const },
    calSub: { fontSize: 12, marginTop: 1 },
    comingSoonBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
    comingSoonText: { fontSize: 11, fontWeight: "600" as const },

    upNextGroupHeader: { paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1 },
    upNextGroupLabel: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.7, textTransform: "uppercase" as const },
    upNextRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
    },
    upNextIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    upNextLabel: { fontSize: 13, fontWeight: "600" as const },
    upNextMeta: { fontSize: 11, marginTop: 1 },

    list: { gap: 8 },

    empty: { alignItems: "center", paddingVertical: 56, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    emptyBody: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 20 },

    bottomActions: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 10,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
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
