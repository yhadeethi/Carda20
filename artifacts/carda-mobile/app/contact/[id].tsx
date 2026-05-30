import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
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
import { api, Contact, ContactActivity, ContactTask, TimelineEvent, ContactReminder } from "@/lib/api";
import { ContactActivityCalendar } from "@/components/ContactActivityCalendar";
import { debriefStore } from "@/lib/debriefStore";
import { useColors } from "@/hooks/useColors";

const HERO_BG = "#0F172A";
const HERO_BG2 = "#1E293B";
const RELATIONSHIP_OPTIONS = ["Casual", "Normal", "Close"] as const;
type RelStrength = (typeof RELATIONSHIP_OPTIONS)[number];

const ACTIVITY_FILTERS = ["All", "Meetings", "Calls", "Emails"] as const;
type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];
type ActivityView = "list" | "calendar";

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

interface DisplayActivity {
  id: string;
  type: string;
  text: string;
  createdAt: string;
  isDebrief?: boolean;
}

function ActivityRow({ item }: { item: DisplayActivity }) {
  const colors = useColors();
  const iconMap: Record<string, string> = {
    note: "file-text",
    call: "phone",
    meeting: "users",
    email: "mail",
    voice_debrief: "mic",
    reminder: "bell",
  };
  const icon = iconMap[item.type] ?? "activity";
  const isDebrief = item.isDebrief;
  const isReminder = item.type === "reminder";

  const iconColor = isDebrief ? "#6366F1" : isReminder ? "#F59E0B" : colors.primary;
  const iconBg = isDebrief ? "#6366F11A" : isReminder ? "#FEF3C7" : colors.primary + "18";

  return (
    <View style={[styles.activityRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.activityIcon, { backgroundColor: iconBg, borderRadius: 8 }]}>
        <Feather name={icon as any} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        {isDebrief && (
          <Text style={[styles.activityLabel, { color: "#6366F1" }]}>
            Voice Debrief
          </Text>
        )}
        {isReminder && (
          <Text style={[styles.activityLabel, { color: "#F59E0B" }]}>
            Reminder
          </Text>
        )}
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
  const [activityView, setActivityView] = useState<ActivityView>("list");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [logType, setLogType] = useState<"Call" | "Meeting" | "Email" | null>(null);
  const [logText, setLogText] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderLabel, setReminderLabel] = useState("");
  const [reminderDate, setReminderDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
  });
  const [savingReminder, setSavingReminder] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpTone, setFollowUpTone] = useState<"Friendly" | "Professional" | "Brief">("Friendly");
  const [followUpMedium, setFollowUpMedium] = useState<"Email" | "SMS">("Email");
  const [followUpContext, setFollowUpContext] = useState("");
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [followUpResult, setFollowUpResult] = useState<{ subject?: string; body: string; bullets: string[] } | null>(null);

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

  const { data: timelineEvents = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["contact-timeline", id],
    queryFn: () => api.getContactTimeline(Number(id)),
    enabled: !!id,
  });

  const { data: reminders = [] } = useQuery<ContactReminder[]>({
    queryKey: ["contact-reminders", Number(id)],
    queryFn: () => api.getContactReminders(Number(id)),
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

  const handleOpenLog = (type: "Call" | "Meeting" | "Email") => {
    setLogType(type);
    setLogText("");
  };

  const handleSaveLog = async () => {
    if (!logType || !logText.trim()) return;
    setSavingLog(true);
    const typeMap: Record<"Call" | "Meeting" | "Email", ContactActivity["type"]> = {
      Call: "call",
      Meeting: "meeting",
      Email: "email",
    };
    const newActivity: ContactActivity = {
      id: `${Date.now()}`,
      type: typeMap[logType],
      text: logText.trim(),
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [newActivity, ...prev]);
    setLogType(null);
    setLogText("");
    setSavingLog(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const handleSaveReminder = async () => {
    if (!contact || !reminderLabel.trim()) return;
    setSavingReminder(true);
    try {
      await api.createContactReminder(contact.id, {
        clientId: `reminder-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label: reminderLabel.trim(),
        remindAt: reminderDate.toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ["contact-reminders", Number(id)] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowReminderModal(false);
      setReminderLabel("");
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
      setReminderDate(d);
    } catch {
      Alert.alert("Error", "Could not save reminder.");
    } finally {
      setSavingReminder(false);
    }
  };

  const handleDismissReminder = async (reminder: ContactReminder) => {
    if (!contact) return;
    try {
      await api.updateContactReminder(contact.id, reminder.id, {
        done: true,
        doneAt: new Date().toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ["contact-reminders", Number(id)] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Error", "Could not update reminder.");
    }
  };

  const handleDeleteReminder = (reminder: ContactReminder) => {
    if (!contact) return;
    Alert.alert("Delete reminder", `"${reminder.label}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteContactReminder(contact.id, reminder.id);
            await qc.invalidateQueries({ queryKey: ["contact-reminders", Number(id)] });
          } catch {
            Alert.alert("Error", "Could not delete reminder.");
          }
        },
      },
    ]);
  };

  const handleGenerateFollowUp = async () => {
    if (!contact) return;
    setGeneratingFollowUp(true);
    setFollowUpResult(null);
    try {
      const toneMap: Record<"Friendly" | "Professional" | "Brief", "friendly" | "formal" | "direct"> = {
        Friendly: "friendly",
        Professional: "formal",
        Brief: "direct",
      };
      const isSMS = followUpMedium === "SMS";
      const smsPrefix = isSMS ? "Write a short SMS message (under 160 characters). " : "";
      const result = await api.generateFollowUp({
        contact: {
          name: contact.fullName || contact.email || "Contact",
          company: contact.companyName,
          title: contact.jobTitle,
          email: contact.email,
        },
        request: {
          mode: "email_followup",
          tone: toneMap[followUpTone],
          length: isSMS || followUpTone === "Brief" ? "short" : "medium",
          context: smsPrefix + (followUpContext.trim() || ""),
          goal: isSMS ? "Send a brief SMS follow-up" : undefined,
        },
      });
      setFollowUpResult(result);
    } catch {
      Alert.alert("Error", "Could not generate follow-up. AI service may not be configured.");
    } finally {
      setGeneratingFollowUp(false);
    }
  };

  const displayName = contact?.fullName || contact?.email || "Contact";
  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const allActivities: DisplayActivity[] = [
    ...activities.map((a) => ({
      id: a.id,
      type: a.type,
      text: a.text,
      createdAt: a.createdAt,
      isDebrief: false,
    })),
    ...timelineEvents.map((e) => ({
      id: String(e.id),
      type: e.type,
      text: e.summary,
      createdAt: e.eventAt,
      isDebrief: e.type === "voice_debrief",
    })),
    ...reminders.map((r) => ({
      id: `reminder-${r.id}`,
      type: "reminder" as const,
      text: r.label,
      createdAt: r.remindAt,
      isDebrief: false,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredActivities = allActivities.filter((a) => {
    if (activityFilter === "All") return true;
    if (activityFilter === "Meetings") return a.type === "meeting";
    if (activityFilter === "Calls") return a.type === "call";
    if (activityFilter === "Emails") return a.type === "email";
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
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              debriefStore.setContactId(contact.id);
              router.push("/voice-debrief" as any);
            }}
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
                  onPress={() => handleOpenLog("Call")}
                  style={[styles.actionSubBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.actionSubBtnText, { color: colors.primary }]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenLog("Meeting")}
                  style={[styles.actionSubBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.actionSubBtnText, { color: colors.primary }]}>Meet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenLog("Email")}
                  style={[styles.actionSubBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.actionSubBtnText, { color: colors.primary }]}>Email</Text>
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

            {/* Set Reminder */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowReminderModal(true);
              }}
              activeOpacity={0.75}
            >
              <GlassCard style={styles.actionCard}>
                <View style={[styles.actionIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Feather name="bell" size={18} color="#F59E0B" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Set Reminder</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  {reminders.filter((r) => r.done === 0).length > 0
                    ? `${reminders.filter((r) => r.done === 0).length} pending`
                    : "Schedule follow-up"}
                </Text>
              </GlassCard>
            </TouchableOpacity>

            {/* Draft Follow-up */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFollowUpResult(null);
                setFollowUpContext("");
                setShowFollowUp(true);
              }}
              activeOpacity={0.75}
            >
              <GlassCard style={styles.actionCard}>
                <View style={[styles.actionIconWrap, { backgroundColor: "#22C55E18" }]}>
                  <Feather name="zap" size={18} color="#22C55E" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Draft Follow-up</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  AI-powered draft
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
          <View style={styles.activitySectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]}>
              ACTIVITY
            </Text>
            {/* List / Calendar toggle */}
            <View style={[styles.viewToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {(["list", "calendar"] as ActivityView[]).map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setActivityView(v)}
                  style={[
                    styles.viewToggleBtn,
                    activityView === v && { backgroundColor: colors.card },
                  ]}
                >
                  <Feather
                    name={v === "list" ? "list" : "calendar"}
                    size={13}
                    color={activityView === v ? colors.primary : colors.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
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

            {/* Calendar view */}
            {activityView === "calendar" ? (
              <ContactActivityCalendar
                timeline={timelineEvents}
                tasks={tasks ?? []}
                reminders={reminders}
              />
            ) : (
              /* Activity list */
              filteredActivities.length > 0 ? (
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
              )
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

        {/* ── REMINDERS ── */}
        <View style={styles.section}>
          <View style={styles.taskSectionHeader}>
            <Feather name="bell" size={13} color={colors.mutedForeground} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]}>
              REMINDERS ({reminders.length})
            </Text>
            <TouchableOpacity
              onPress={() => setShowReminderModal(true)}
              style={[styles.addTaskBtn, { backgroundColor: "#F59E0B", borderRadius: colors.radius - 4 }]}
            >
              <Feather name="plus" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <GlassCard style={{ padding: 0 }}>
            {reminders.length > 0 ? (
              reminders.map((r) => {
                const isDone = r.done === 1;
                const remindDate = new Date(r.remindAt);
                const isPast = remindDate < new Date() && !isDone;
                return (
                  <View
                    key={r.id}
                    style={[styles.taskRow, { borderBottomColor: colors.border }]}
                  >
                    <TouchableOpacity
                      onPress={() => !isDone && handleDismissReminder(r)}
                      style={styles.taskCheck}
                    >
                      <View style={[
                        styles.checkbox,
                        {
                          borderColor: isDone ? "#F59E0B" : isPast ? "#EF4444" : "#F59E0B",
                          backgroundColor: isDone ? "#F59E0B" : "transparent",
                          borderRadius: 4,
                        },
                      ]}>
                        {isDone ? <Feather name="check" size={11} color="#fff" /> : null}
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.taskTitle,
                        {
                          color: isDone ? colors.mutedForeground : colors.foreground,
                          textDecorationLine: isDone ? "line-through" : "none",
                        },
                      ]} numberOfLines={2}>
                        {r.label}
                      </Text>
                      <Text style={[{ fontSize: 11, marginTop: 2, color: isPast && !isDone ? "#EF4444" : colors.mutedForeground }]}>
                        {remindDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {remindDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {isPast && !isDone ? " · Overdue" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteReminder(r)} style={styles.taskDelete}>
                      <Feather name="x" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyTasks}>
                <Text style={[styles.emptyTasksText, { color: colors.mutedForeground }]}>
                  No reminders — tap + to schedule one
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

      {/* Log Activity Modal */}
      <Modal
        visible={logType !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLogType(null)}
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
                Log {logType}
              </Text>
              <TouchableOpacity onPress={() => setLogType(null)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={logText}
              onChangeText={setLogText}
              placeholder={`Notes about this ${logType?.toLowerCase()}…`}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              multiline
              style={[
                styles.modalInput,
                styles.multilineInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleSaveLog}
              disabled={!logText.trim() || savingLog}
              style={[
                styles.modalButton,
                {
                  backgroundColor: logText.trim() ? colors.primary : colors.muted,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {savingLog ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Save Log</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* Set Reminder Modal */}
      <Modal
        visible={showReminderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reminderSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Set Reminder</Text>
              <TouchableOpacity onPress={() => setShowReminderModal(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>REMINDER LABEL</Text>
            <TextInput
              value={reminderLabel}
              onChangeText={setReminderLabel}
              placeholder="e.g. Follow up on proposal"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.modalInput, {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: 10,
              }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 4 }]}>QUICK DATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 2 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                {[
                  { label: "Today", days: 0, hour: 17 },
                  { label: "Tomorrow", days: 1, hour: 9 },
                  { label: "In 3 days", days: 3, hour: 9 },
                  { label: "1 week", days: 7, hour: 9 },
                  { label: "2 weeks", days: 14, hour: 9 },
                ].map((preset) => {
                  const presetDate = new Date();
                  presetDate.setDate(presetDate.getDate() + preset.days);
                  presetDate.setHours(preset.hour, 0, 0, 0);
                  const isActive =
                    reminderDate.toDateString() === presetDate.toDateString() &&
                    reminderDate.getHours() === preset.hour;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => { setReminderDate(presetDate); setShowDatePicker(false); setShowTimePicker(false); }}
                      style={[
                        styles.presetPill,
                        {
                          backgroundColor: isActive ? "#F59E0B" : colors.secondary,
                          borderColor: isActive ? "#F59E0B" : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.presetPillText, { color: isActive ? "#fff" : colors.mutedForeground }]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>CUSTOM DATE & TIME</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
              <TouchableOpacity
                onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}
                style={[styles.presetPill, {
                  backgroundColor: showDatePicker ? "#F59E0B" : colors.secondary,
                  borderColor: showDatePicker ? "#F59E0B" : colors.border,
                  flex: 1,
                }]}
              >
                <Feather name="calendar" size={13} color={showDatePicker ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.presetPillText, { color: showDatePicker ? "#fff" : colors.mutedForeground }]}>
                  {reminderDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}
                style={[styles.presetPill, {
                  backgroundColor: showTimePicker ? "#F59E0B" : colors.secondary,
                  borderColor: showTimePicker ? "#F59E0B" : colors.border,
                  flex: 1,
                }]}
              >
                <Feather name="clock" size={13} color={showTimePicker ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.presetPillText, { color: showTimePicker ? "#fff" : colors.mutedForeground }]}>
                  {reminderDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </Text>
              </TouchableOpacity>
            </View>

            {(showDatePicker || showTimePicker) && (
              <DateTimePicker
                value={reminderDate}
                mode={showDatePicker ? "date" : "time"}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  if (Platform.OS === "android") {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }
                  if (selected) setReminderDate(selected);
                }}
                style={{ marginBottom: 4 }}
              />
            )}

            <View style={[styles.reminderPreview, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
              <Feather name="bell" size={14} color="#D97706" />
              <Text style={[styles.reminderPreviewText, { color: "#92400E" }]}>
                {reminderDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" at "}
                {reminderDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSaveReminder}
              disabled={!reminderLabel.trim() || savingReminder}
              style={[
                styles.modalButton,
                {
                  backgroundColor: reminderLabel.trim() ? "#F59E0B" : colors.muted,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {savingReminder ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Save Reminder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Draft Follow-up Sheet */}
      <Modal
        visible={showFollowUp}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowFollowUp(false); setFollowUpResult(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.followUpSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Draft Follow-up</Text>
              <TouchableOpacity onPress={() => { setShowFollowUp(false); setFollowUpResult(null); }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {followUpResult ? (
              /* Result view */
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {followUpResult.subject && (
                  <View style={[styles.fuResultBlock, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.fuResultLabel, { color: colors.mutedForeground }]}>SUBJECT</Text>
                    <Text style={[styles.fuResultText, { color: colors.foreground }]}>{followUpResult.subject}</Text>
                  </View>
                )}
                <View style={[styles.fuResultBlock, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.fuResultLabel, { color: colors.mutedForeground }]}>MESSAGE</Text>
                  <Text style={[styles.fuResultText, { color: colors.foreground }]}>{followUpResult.body}</Text>
                </View>
                {followUpResult.bullets.length > 0 && (
                  <View style={[styles.fuResultBlock, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.fuResultLabel, { color: colors.mutedForeground }]}>KEY POINTS</Text>
                    {followUpResult.bullets.map((b, i) => (
                      <View key={i} style={styles.fuBulletRow}>
                        <View style={[styles.fuBulletDot, { backgroundColor: colors.primary }]} />
                        <Text style={[styles.fuResultText, { color: colors.foreground }]}>{b}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      const text = (followUpResult.subject ? `Subject: ${followUpResult.subject}\n\n` : "") + followUpResult.body;
                      await Clipboard.setStringAsync(text);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                    style={[styles.fuActionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                  >
                    <Feather name="copy" size={15} color={colors.foreground} />
                    <Text style={[styles.fuActionBtnText, { color: colors.foreground }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const text = (followUpResult.subject ? `Subject: ${followUpResult.subject}\n\n` : "") + followUpResult.body;
                      Share.share({ message: text, title: "Follow-up Draft" });
                    }}
                    style={[styles.fuActionBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  >
                    <Feather name="share-2" size={15} color="#fff" />
                    <Text style={styles.fuActionBtnText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setFollowUpResult(null)}
                    style={[styles.fuActionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                  >
                    <Feather name="refresh-cw" size={15} color={colors.foreground} />
                    <Text style={[styles.fuActionBtnText, { color: colors.foreground }]}>Regenerate</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* Config view */
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MEDIUM</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {(["Email", "SMS"] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setFollowUpMedium(opt)}
                      style={[styles.fuPill, {
                        backgroundColor: followUpMedium === opt ? colors.primary : colors.secondary,
                        borderColor: followUpMedium === opt ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[styles.fuPillText, { color: followUpMedium === opt ? "#fff" : colors.mutedForeground }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TONE</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {(["Friendly", "Professional", "Brief"] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setFollowUpTone(opt)}
                      style={[styles.fuPill, {
                        backgroundColor: followUpTone === opt ? "#6366F1" : colors.secondary,
                        borderColor: followUpTone === opt ? "#6366F1" : colors.border,
                      }]}
                    >
                      <Text style={[styles.fuPillText, { color: followUpTone === opt ? "#fff" : colors.mutedForeground }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CONTEXT (optional)</Text>
                <TextInput
                  value={followUpContext}
                  onChangeText={setFollowUpContext}
                  placeholder="How you met, what you discussed…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[styles.modalInput, styles.multilineInput, {
                    color: colors.foreground,
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    borderRadius: 10,
                    marginBottom: 14,
                  }]}
                />

                <TouchableOpacity
                  onPress={handleGenerateFollowUp}
                  disabled={generatingFollowUp}
                  style={[styles.modalButton, { backgroundColor: "#6366F1", borderRadius: colors.radius, marginBottom: 16 }]}
                >
                  {generatingFollowUp ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.modalButtonText}>Generating…</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="zap" size={16} color="#fff" />
                      <Text style={styles.modalButtonText}>Generate Draft</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
  activityLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  activityText: { fontSize: 13, lineHeight: 18 },
  activityTime: { fontSize: 11, marginTop: 2 },

  activitySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

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
  modalButton: { paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  modalButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 15 },

  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginBottom: 14,
  },
  reminderSheet: {
    marginHorizontal: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetPillText: { fontSize: 12, fontWeight: "600" as const },
  reminderPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 10,
  },
  reminderPreviewText: { fontSize: 13, fontWeight: "600" as const },

  followUpSheet: {
    marginHorizontal: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
    flex: 0,
  },
  fuPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  fuPillText: { fontSize: 12, fontWeight: "600" as const },
  fuResultBlock: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  fuResultLabel: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.8, textTransform: "uppercase" as const },
  fuResultText: { fontSize: 14, lineHeight: 20 },
  fuBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  fuBulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  fuActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  fuActionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
});
