import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
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
import { api, Contact, ContactTask } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

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
  contactId,
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

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["contact", id],
    queryFn: () => api.getContact(Number(id)),
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
          title: displayName,
          headerRight: () => (
            <TouchableOpacity onPress={handleEdit} style={{ marginRight: 4 }}>
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom }}
      >
        <View
          style={[
            styles.heroSection,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Avatar name={displayName} size={72} />
          <Text style={[styles.heroName, { color: colors.foreground }]}>
            {displayName}
          </Text>
          {(contact.jobTitle || contact.companyName) ? (
            <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
              {[contact.jobTitle, contact.companyName].filter(Boolean).join(" · ")}
            </Text>
          ) : null}

          <View style={styles.quickActions}>
            {contact.email ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
                style={[styles.actionBtn, { backgroundColor: colors.primary + "1A", borderRadius: colors.radius }]}
              >
                <Feather name="mail" size={18} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.primary }]}>Email</Text>
              </TouchableOpacity>
            ) : null}
            {contact.phone ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                style={[styles.actionBtn, { backgroundColor: colors.primary + "1A", borderRadius: colors.radius }]}
              >
                <Feather name="phone" size={18} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.primary }]}>Call</Text>
              </TouchableOpacity>
            ) : null}
            {contact.linkedinUrl ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(
                  contact.linkedinUrl!.startsWith("http")
                    ? contact.linkedinUrl!
                    : `https://linkedin.com/in/${contact.linkedinUrl}`
                )}
                style={[styles.actionBtn, { backgroundColor: colors.primary + "1A", borderRadius: colors.radius }]}
              >
                <Feather name="linkedin" size={18} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.primary }]}>LinkedIn</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <GlassCard style={{ margin: 16, padding: 0 }}>
          <InfoRow icon="mail" label="Email" value={contact.email} onPress={contact.email ? () => Linking.openURL(`mailto:${contact.email}`) : undefined} />
          <InfoRow icon="phone" label="Phone" value={contact.phone} onPress={contact.phone ? () => Linking.openURL(`tel:${contact.phone}`) : undefined} />
          <InfoRow icon="briefcase" label="Job Title" value={contact.jobTitle} />
          <InfoRow icon="building" label="Company" value={contact.companyName} />
          <InfoRow icon="globe" label="Website" value={contact.website} onPress={contact.website ? () => Linking.openURL(contact.website!) : undefined} />
          <InfoRow icon="file-text" label="Notes" value={contact.notes} />
        </GlassCard>

        <View style={[styles.sectionHeader, { marginHorizontal: 16 }]}>
          <Feather name="check-square" size={14} color={colors.mutedForeground} />
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Tasks ({tasks?.length ?? 0})
          </Text>
          <TouchableOpacity
            onPress={() => setShowAddTask(true)}
            style={[styles.addTaskBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
          >
            <Feather name="plus" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <GlassCard style={{ marginHorizontal: 16, padding: 0, marginBottom: 8 }}>
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

        {contact.companyId ? (
          <TouchableOpacity
            style={[
              styles.intelButton,
              {
                marginHorizontal: 16,
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

        <TouchableOpacity
          onPress={handleDelete}
          style={[
            styles.deleteButton,
            {
              marginHorizontal: 16,
              marginTop: 8,
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

      <Modal
        visible={showAddTask}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddTask(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Task</Text>
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
                  backgroundColor: newTaskTitle.trim() ? colors.primary : colors.muted,
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
  heroSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 6,
  },
  heroName: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, marginTop: 8 },
  heroMeta: { fontSize: 14, textAlign: "center" },
  quickActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  actionLabel: { fontSize: 13, fontWeight: "500" as const },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  infoIcon: { width: 22, marginRight: 10 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: "500" as const, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 1 },
  infoValue: { fontSize: 15 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: { flex: 1, fontSize: 12, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.8 },
  addTaskBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  taskCheck: { padding: 2 },
  checkbox: { width: 18, height: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 14 },
  taskDelete: { padding: 4 },
  emptyTasks: { paddingHorizontal: 14, paddingVertical: 16, alignItems: "center" },
  emptyTasksText: { fontSize: 13 },
  intelButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  intelButtonText: { flex: 1, fontSize: 14, fontWeight: "500" as const },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  deleteText: { fontSize: 15, fontWeight: "500" as const },
  editRow: { marginBottom: 14 },
  editLabel: { fontSize: 12, fontWeight: "500" as const, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  editInput: { fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  multilineInput: { minHeight: 80, textAlignVertical: "top" as const },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", paddingBottom: 24 },
  modalContent: { marginHorizontal: 16, padding: 20, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 17, fontWeight: "700" as const },
  modalInput: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  modalButton: { paddingVertical: 14, alignItems: "center" },
  modalButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 15 },
});
