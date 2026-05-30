import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { api, Contact, ContactActivity, ContactTask } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const HERO_BG = "#0F172A";
const HERO_BG2 = "#1E293B";
const RELATIONSHIP_OPTIONS = ["Casual", "Normal", "Close"] as const;
type RelStrength = (typeof RELATIONSHIP_OPTIONS)[number];

const ACTIVITY_FILTERS = ["All", "Notes", "Calls", "Meetings"] as const;
type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  if (!value) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.infoRow, { borderBottomColor: colors.border }]}
    >
      <Feather
        name={icon as any}
        size={16}
        color={colors.primary}
        style={styles.infoIcon}
      />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.infoValue,
            { color: onPress ? colors.primary : colors.foreground },
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {onPress && (
        <Feather name="external-link" size={14} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: ContactTask;
  contactId: number;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const done = task.done === 1;
  return (
    <View style={[styles.taskRow, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onToggle} style={styles.taskCheck}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: done ? colors.primary : colors.border,
              backgroundColor: done ? colors.primary : "transparent",
              borderRadius: 4,
            },
          ]}
        >
          {done ? <Feather name="check" size={11} color="#fff" /> : null}
        </View>
      </TouchableOpacity>
      <Text
        style={[
          styles.taskTitle,
          {
            color: done ? colors.mutedForeground : colors.foreground,
            textDecorationLine: done ? "line-through" : "none",
            flex: 1,
          },
        ]}
        numberOfLines={2}
      >
        {task.title}
      </Text>
      <TouchableOpacity onPress={onDelete} style={styles.taskDelete}>
        <Feather name="x" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

function ActivityRow({ item }: { item: ContactActivity }) {
  const colors = useColors();
  const iconMap: Record<ContactActivity["type"], string> = {
    note: "file-text",
    call: "phone",
    meeting: "users",
    email: "mail",
  };
  return (
    <View style={[styles.activityRow, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.activityIcon,
          { backgroundColor: colors.primary + "18", borderRadius: 8 },
        ]}
      >
        <Feather
          name={iconMap[item.type] as any}
          size={14}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.activityText, { color: colors.foreground }]}>
          {item.text}
        </Text>
        <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>
          {timeAgo(item.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  const [relationship, setRelationship] = useState<RelStrength | null>(null);
  const [savingRel, setSavingRel] = useState(false);

  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("All");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [logType, setLogType] = useState<"Call" | "Meeting" | null>(null);

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["contact", id],
    queryFn: async () => {
      const c = await api.getContact(Number(id));
      if (c.orgRelationshipStrength) {
        const val = c.orgRelationshipStrength as RelStrength;
        if (RELATIONSHIP_OPTIONS.includes(val)) setRelationship(val);
      }
      return c;
    },
    enabled: !!id,
  });

  const { data: tasks } = useQuery<ContactTask[]>({
    queryKey: ["contact-tasks", id],
    queryFn: () => api.getContactTasks(Number(id)),
    enabled: !!id,
  });

  const handleEdit = () => {
    setForm(contact ?? {});
    setEditing(true);
  };

  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      await api.updateContact(contact.id, form);
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      await qc.invalidateQueries({ queryKey: ["contact", id] });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete contact", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!contact) return;
          try {
            await api.deleteContact(contact.id);
            await qc.invalidateQueries({ queryKey: ["contacts"] });
            router.back();
          } catch {
            Alert.alert("Error", "Could not delete contact.");
          }
        },
      },
    ]);
  };

  const handleSetRelationship = async (val: RelStrength) => {
    if (!contact) return;
    const next = relationship === val ? null : val;
    setRelationship(next);
    setSavingRel(true);
    try {
      await api.updateContact(contact.id, {
        orgRelationshipStrength: next ?? "",
      });
      await qc.invalidateQueries({ queryKey: ["contact", id] });
      Haptics.selectionAsync();
    } catch {
      setRelationship(relationship);
    } finally {
      setSavingRel(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    const newActivity: ContactActivity = {
      id: `${Date.now()}`,
      type: "note",
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [newActivity, ...prev]);
    setNoteText("");
    if (contact) {
      try {
        await api.createContactTask(contact.id, {
          clientId: newActivity.id,
          title: `Note: ${newActivity.text}`,
        });
        await qc.invalidateQueries({ queryKey: ["contact-tasks", id] });
      } catch {}
    }
    setAddingNote(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleLogActivity = (type: "Call" | "Meeting") => {
    if (!contact) return;
    Alert.prompt(
      `Log ${type}`,
      `Add a note about this ${type.toLowerCase()} with ${contact.fullName ?? "this contact"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log",
          onPress: (text: string | undefined) => {
            if (!text?.trim()) return;
            const newActivity: ContactActivity = {
              id: `${Date.now()}`,
              type: type === "Call" ? "call" : "meeting",
              text: text.trim(),
              createdAt: new Date().toISOString(),
            };
            setActivities((prev) => [newActivity, ...prev]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      "plain-text"
    );
  };

  const handleSaveToPhone = async () => {
    if (!contact) return;
    try {
      const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${BASE_URL}/api/vcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: contact.fullName,
          jobTitle: contact.jobTitle,
          companyName: contact.companyName,
          email: contact.email,
          phone: contact.phone,
          website: contact.website,
          linkedinUrl: contact.linkedinUrl,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate vCard");
      const vcardText = await res.text();
      await Share.share({
        title: `${contact.fullName ?? "Contact"}.vcf`,
        message: vcardText,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not export contact.");
    }
  };

  const handleExportCRM = () => {
    if (!contact) return;
    Alert.alert("Export to CRM", "Choose a CRM to sync this contact to:", [
      {
        text: "HubSpot",
        onPress: async () => {
          try {
            await api.syncHubSpot();
            Alert.alert("Success", "Contact synced to HubSpot.");
          } catch {
            Alert.alert("Error", "Could not sync to HubSpot. Check integration in Profile.");
          }
        },
      },
      {
        text: "Salesforce",
        onPress: async () => {
          try {
            await api.syncSalesforce();
            Alert.alert("Success", "Contact synced to Salesforce.");
          } catch {
            Alert.alert("Error", "Could not sync to Salesforce. Check integration in Profile.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleAddTask = async () => {
    if (!contact || !newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await api.createContactTask(contact.id, {
        clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: newTaskTitle.trim(),
      });
      await qc.invalidateQueries({ queryKey: ["contact-tasks", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewTaskTitle("");
      setShowAddTask(false);
    } catch {
      Alert.alert("Error", "Could not create task.");
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: ContactTask) => {
    if (!contact) return;
    const done = task.done === 1;
    try {
      await api.updateContactTask(contact.id, task.id, { done: !done });
      await qc.invalidateQueries({ queryKey: ["contact-tasks", id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Error", "Could not update task.");
    }
  };

  const handleDeleteTask = (task: ContactTask) => {
    if (!contact) return;
    Alert.alert("Delete task", `"${task.title}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteContactTask(contact.id, task.id);
            await qc.invalidateQueries({ queryKey: ["contact-tasks", id] });
          } catch {
            Alert.alert("Error", "Could not delete task.");
          }
        },
      },
    ]);
  };

  const displayName = contact?.fullName || contact?.email || "Contact";
  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const filteredActivities = activities.filter((a) => {
    if (activityFilter === "All") return true;
    if (activityFilter === "Notes") return a.type === "note";
    if (activityFilter === "Calls") return a.type === "call";
    if (activityFilter === "Meetings") return a.type === "meeting";
    return true;
  });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Contact not found</Text>
      </View>
    );
  }

  if (editing) {
    const f = (label: string, key: keyof Contact, multiline = false) => (
      <View key={key} style={styles.editRow}>
        <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <TextInput
          value={(form[key] as string) || ""}
          onChangeText={(v) => setForm((prev) => ({ ...prev, [key]: v }))}
          style={[
            styles.editInput,
            {
              color: colors.foreground,
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              borderRadius: colors.radius - 4,
            },
            multiline && styles.multilineInput,
          ]}
          multiline={multiline}
          placeholderTextColor={colors.mutedForeground}
          placeholder={`Enter ${label.toLowerCase()}`}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    );

    return (
      <>
        <Stack.Screen
          options={{
            title: "Edit Contact",
            headerRight: () => (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ color: colors.primary, fontWeight: "600" as const, fontSize: 16 }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={{ padding: 16, paddingBottom }}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard>
            {f("Full Name", "fullName")}
            {f("Job Title", "jobTitle")}
            {f("Company", "companyName")}
            {f("Email", "email")}
            {f("Phone", "phone")}
            {f("LinkedIn", "linkedinUrl")}
            {f("Website", "website")}
            {f("Notes", "notes", true)}
          </GlassCard>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleEdit}
              style={[styles.headerEditBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
            >
              <Feather name="edit-2" size={15} color="#fff" />
            </TouchableOpacity>
          ),
          headerTintColor: "#fff",
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom }}
      >
        {/* ── DARK HERO CARD ── */}
        <LinearGradient
          colors={[HERO_BG, HERO_BG2]}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroAvatar}>
              <Avatar name={displayName} size={72} />
            </View>
            {contact.createdAt ? (
              <View style={styles.scannedBadge}>
                <Feather name="camera" size={10} color="rgba(255,255,255,0.7)" />
                <Text style={styles.scannedText}>
                  SCANNED {timeAgo(contact.createdAt).toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroName}>{displayName}</Text>
          {(contact.jobTitle || contact.companyName) ? (
            <Text style={styles.heroMeta}>
              {[contact.jobTitle, contact.companyName].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          <View style={styles.heroContactRow}>
            {contact.phone ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                style={styles.heroPill}
              >
                <Feather name="phone" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroPillText} numberOfLines={1}>
                  {contact.phone}
                </Text>
              </TouchableOpacity>
            ) : null}
            {contact.email ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
                style={styles.heroPill}
              >
                <Feather name="mail" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroPillText} numberOfLines={1}>
                  {contact.email}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>

        {/* ── RELATIONSHIP ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            RELATIONSHIP
          </Text>
          <GlassCard style={{ padding: 12 }}>
            <View style={styles.relPills}>
              {RELATIONSHIP_OPTIONS.map((opt) => {
                const active = relationship === opt;
                const relColors: Record<RelStrength, string> = {
                  Casual: "#F59E0B",
                  Normal: colors.primary,
                  Close: "#22C55E",
                };
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => handleSetRelationship(opt)}
                    disabled={savingRel}
                    style={[
                      styles.relPill,
                      {
                        backgroundColor: active ? relColors[opt] : colors.secondary,
                        borderColor: active ? relColors[opt] : colors.border,
                        borderRadius: 999,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.relPillText,
                        { color: active ? "#fff" : colors.mutedForeground },
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            QUICK ACTIONS
          </Text>

          {/* Voice Debrief — full width prominent */}
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Voice Debrief",
                "Voice debrief recording is coming soon. You can log a meeting note in the Activity section below.",
                [{ text: "OK" }]
              )
            }
            style={styles.debriefBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#6366F1", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.debriefGradient}
            >
              <View style={styles.debriefContent}>
                <View style={styles.debriefLeft}>
                  <View style={styles.debriefIconWrap}>
                    <Feather name="mic" size={22} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.debriefTitle}>Voice Debrief</Text>
                    <Text style={styles.debriefSub}>After a meeting</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* 2×2 action grid */}
          <View style={styles.actionGrid}>
            {/* Log */}
            <GlassCard style={styles.actionCard}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="edit-3" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Log</Text>
              <View style={styles.actionSubBtns}>
                <TouchableOpacity
                  onPress={() => Platform.OS === "ios" ? handleLogActivity("Call") : Alert.alert("Log Call", "Call logging coming soon.")}
                  style={[styles.actionSubBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.actionSubBtnText, { color: colors.primary }]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Platform.OS === "ios" ? handleLogActivity("Meeting") : Alert.alert("Log Meeting", "Meeting logging coming soon.")}
                  style={[styles.actionSubBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.actionSubBtnText, { color: colors.primary }]}>Meet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowAddTask(true)}
                  style={[styles.actionSubBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.actionSubBtnText, { color: colors.primary }]}>Note</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

            {/* Email */}
            <TouchableOpacity
              onPress={() => {
                if (!contact.email) {
                  Alert.alert("No email", "This contact has no email address.");
                  return;
                }
                Linking.openURL(
                  `mailto:${contact.email}?subject=Following up&body=Hi ${contact.fullName?.split(" ")[0] ?? ""},`
                );
              }}
              activeOpacity={0.75}
            >
              <GlassCard style={styles.actionCard}>
                <View style={[styles.actionIconWrap, { backgroundColor: "#22C55E18" }]}>
                  <Feather name="mail" size={18} color="#22C55E" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Email</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  Follow up
                </Text>
              </GlassCard>
            </TouchableOpacity>

            {/* Save to Phone */}
            <TouchableOpacity onPress={handleSaveToPhone} activeOpacity={0.75}>
              <GlassCard style={styles.actionCard}>
                <View style={[styles.actionIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Feather name="user-plus" size={18} color="#F59E0B" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Save to Phone</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  Export vCard
                </Text>
              </GlassCard>
            </TouchableOpacity>

            {/* Export to CRM */}
            <TouchableOpacity onPress={handleExportCRM} activeOpacity={0.75}>
              <GlassCard style={styles.actionCard}>
                <View style={[styles.actionIconWrap, { backgroundColor: colors.purple + "18" }]}>
                  <Feather name="upload-cloud" size={18} color={colors.purple} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Export to CRM</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  HubSpot · Salesforce
                </Text>
              </GlassCard>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CONTACT DETAILS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            CONTACT DETAILS
          </Text>
          <GlassCard style={{ padding: 0 }}>
            <InfoRow
              icon="mail"
              label="Email"
              value={contact.email}
              onPress={contact.email ? () => Linking.openURL(`mailto:${contact.email}`) : undefined}
            />
            <InfoRow
              icon="phone"
              label="Phone"
              value={contact.phone}
              onPress={contact.phone ? () => Linking.openURL(`tel:${contact.phone}`) : undefined}
            />
            <InfoRow icon="briefcase" label="Job Title" value={contact.jobTitle} />
            <InfoRow icon="building" label="Company" value={contact.companyName} />
            <InfoRow
              icon="globe"
              label="Website"
              value={contact.website}
              onPress={contact.website ? () => Linking.openURL(contact.website!) : undefined}
            />
            <InfoRow
              icon="linkedin"
              label="LinkedIn"
              value={contact.linkedinUrl}
              onPress={
                contact.linkedinUrl
                  ? () =>
                      Linking.openURL(
                        contact.linkedinUrl!.startsWith("http")
                          ? contact.linkedinUrl!
                          : `https://linkedin.com/in/${contact.linkedinUrl}`
                      )
                  : undefined
              }
            />
            <InfoRow icon="file-text" label="Notes" value={contact.notes} />
          </GlassCard>
        </View>

        {/* ── ACTIVITY ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            ACTIVITY
          </Text>
          <GlassCard style={{ padding: 12 }}>
            {/* Filter pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              <View style={{ flexDirection: "row", gap: 6 }}>
                {ACTIVITY_FILTERS.map((f) => {
                  const active = activityFilter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setActivityFilter(f)}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor: active ? colors.primary : colors.secondary,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: active ? "#fff" : colors.mutedForeground },
                        ]}
                      >
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Note input */}
            <View
              style={[
                styles.noteInputRow,
                { borderColor: colors.border, backgroundColor: colors.secondary },
              ]}
            >
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note…"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.noteInput, { color: colors.foreground }]}
                onSubmitEditing={handleAddNote}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleAddNote}
                disabled={!noteText.trim() || addingNote}
                style={[
                  styles.noteSendBtn,
                  { backgroundColor: noteText.trim() ? colors.primary : colors.muted },
                ]}
              >
                {addingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="send" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Activity list */}
            {filteredActivities.length > 0 ? (
              filteredActivities.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))
            ) : (
              <View style={styles.emptyActivity}>
                <Feather name="clock" size={20} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
                <Text style={[styles.emptyActivityText, { color: colors.mutedForeground }]}>
                  No activity yet
                </Text>
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── TASKS ── */}
        <View style={styles.section}>
          <View style={styles.taskSectionHeader}>
            <Feather name="check-square" size={13} color={colors.mutedForeground} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]}>
              TASKS ({tasks?.length ?? 0})
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddTask(true)}
              style={[styles.addTaskBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
            >
              <Feather name="plus" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <GlassCard style={{ padding: 0 }}>
            {tasks && tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  contactId={contact.id}
                  onToggle={() => handleToggleTask(task)}
                  onDelete={() => handleDeleteTask(task)}
                />
              ))
            ) : (
              <View style={styles.emptyTasks}>
                <Text style={[styles.emptyTasksText, { color: colors.mutedForeground }]}>
                  No tasks yet — add a follow-up action
                </Text>
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── COMPANY INTEL ── */}
        {contact.companyId ? (
          <TouchableOpacity
            style={[
              styles.intelButton,
              {
                marginHorizontal: 16,
                marginBottom: 8,
                backgroundColor: colors.primary + "1A",
                borderColor: colors.primary + "44",
                borderRadius: colors.radius,
              },
            ]}
            onPress={() => router.push(`/company/${contact.companyId}`)}
          >
            <Feather name="zap" size={16} color={colors.primary} />
            <Text style={[styles.intelButtonText, { color: colors.primary }]}>
              View {contact.companyName || "company"} intelligence
            </Text>
            <Feather name="chevron-right" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        {/* ── DELETE ── */}
        <TouchableOpacity
          onPress={handleDelete}
          style={[
            styles.deleteButton,
            {
              marginHorizontal: 16,
              marginTop: 4,
              marginBottom: 8,
              borderColor: colors.destructive + "44",
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteText, { color: colors.destructive }]}>
            Delete Contact
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Task Modal */}
      <Modal
        visible={showAddTask}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddTask(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                New Task
              </Text>
              <TouchableOpacity onPress={() => setShowAddTask(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="Task description…"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleAddTask}
              disabled={!newTaskTitle.trim() || addingTask}
              style={[
                styles.modalButton,
                {
                  backgroundColor: newTaskTitle.trim()
                    ? colors.primary
                    : colors.muted,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {addingTask ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Add Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    paddingTop: 100,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  scannedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scannedText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
  },
  heroName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroMeta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    marginBottom: 12,
  },
  heroContactRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 180,
  },
  heroPillText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    flex: 1,
  },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  relPills: { flexDirection: "row", gap: 8 },
  relPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  relPillText: { fontSize: 13, fontWeight: "600" as const },

  debriefBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 10 },
  debriefGradient: { borderRadius: 16 },
  debriefContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  debriefLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  debriefIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  debriefTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
  },
  debriefSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: "47%",
    minHeight: 100,
    gap: 6,
    padding: 14,
  } as any,
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionTitle: { fontSize: 13, fontWeight: "700" as const, letterSpacing: -0.1 },
  actionSub: { fontSize: 11 },
  actionSubBtns: { flexDirection: "row", gap: 4, marginTop: 2 },
  actionSubBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionSubBtnText: { fontSize: 11, fontWeight: "600" as const },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  infoIcon: { width: 22, marginRight: 10 },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoValue: { fontSize: 15 },

  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 12, fontWeight: "600" as const },

  noteInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 4,
    marginBottom: 10,
  },
  noteInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  noteSendBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  activityIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  activityText: { fontSize: 13, lineHeight: 18 },
  activityTime: { fontSize: 11, marginTop: 2 },

  emptyActivity: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyActivityText: { fontSize: 13 },

  taskSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  addTaskBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  taskCheck: { padding: 2 },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  taskTitle: { fontSize: 14 },
  taskDelete: { padding: 4 },
  emptyTasks: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyTasksText: { fontSize: 13 },

  intelButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
  },
  intelButtonText: { flex: 1, fontSize: 14, fontWeight: "500" as const },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  deleteText: { fontSize: 15, fontWeight: "500" as const },

  editRow: { marginBottom: 14 },
  editLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editInput: {
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top" as const },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingBottom: 24,
  },
  modalContent: { marginHorizontal: 16, padding: 20, gap: 14 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 17, fontWeight: "700" as const },
  modalInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  modalButton: { paddingVertical: 14, alignItems: "center" },
  modalButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 15 },
});
