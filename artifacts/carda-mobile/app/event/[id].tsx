import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactCard } from "@/components/ContactCard";
import { GlassCard } from "@/components/GlassCard";
import { api, Contact, UpdateUserEventPayload, UserEvent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type Sheet = "none" | "edit" | "add-existing";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  // ── sheets ────────────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<Sheet>("none");

  // ── edit form state ───────────────────────────────────────────────────────
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // ── add-existing search ───────────────────────────────────────────────────
  const [contactSearch, setContactSearch] = useState("");

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: event, isLoading } = useQuery<UserEvent>({
    queryKey: ["user-event", id],
    queryFn: () => api.getUserEvent(Number(id)),
    enabled: !!id,
  });

  const { data: eventContacts = [] } = useQuery<Contact[]>({
    queryKey: ["event-contacts", id],
    queryFn: () => api.getEventContacts(Number(id)),
    enabled: !!id,
  });

  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
    enabled: sheet === "add-existing",
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserEventPayload) => api.updateUserEvent(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-event", id] });
      qc.invalidateQueries({ queryKey: ["user-events"] });
      setSheet("none");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert("Error", "Could not update event."),
  });

  const attachMutation = useMutation({
    mutationFn: (contactId: number) =>
      api.attachContactsToEvent(Number(id), [contactId]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-contacts", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert("Error", "Could not attach contact."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteUserEvent(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-events"] });
      router.back();
    },
    onError: () => Alert.alert("Error", "Could not delete event."),
  });

  // ── handlers ──────────────────────────────────────────────────────────────
  const openEdit = useCallback(() => {
    if (!event) return;
    setEditTitle(event.title);
    setEditNotes(event.notes || "");
    setEditLink(event.eventLink || "");
    setEditTags(event.tags || []);
    setTagInput("");
    const d = event.startedAt ? new Date(event.startedAt) : null;
    setEditDate(d);
    setTempDate(d || new Date());
    setSheet("edit");
  }, [event]);

  const saveEdit = () => {
    updateMutation.mutate({
      title: editTitle.trim() || event?.title,
      notes: editNotes.trim() || null,
      eventLink: editLink.trim() || null,
      tags: editTags.length > 0 ? editTags : null,
      startedAt: editDate ? editDate.toISOString() : undefined,
    });
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !editTags.includes(t)) {
      setEditTags((prev) => [...prev, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setEditTags((prev) => prev.filter((t) => t !== tag));

  const handleToggleActive = async () => {
    if (!event) return;
    try {
      await api.updateUserEvent(event.id, { isActive: !event.isActive });
      qc.invalidateQueries({ queryKey: ["user-event", id] });
      qc.invalidateQueries({ queryKey: ["user-events"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not update event status.");
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete event", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  const handleScanAtEvent = () => {
    router.push(`/(tabs)/scan?eventId=${id}` as any);
  };

  const handleBatchScan = () => {
    const title = encodeURIComponent(event?.title || "");
    router.push(`/batch-scan?eventId=${id}&eventTitle=${title}` as any);
  };

  const handleAttachExisting = (contact: Contact) => {
    const alreadyIn = eventContacts.some((c) => c.id === contact.id);
    if (alreadyIn) {
      Alert.alert("Already added", `${contact.fullName || "This contact"} is already in this event.`);
      return;
    }
    attachMutation.mutate(contact.id);
    setSheet("none");
    setContactSearch("");
  };

  // ── filtered contacts for picker ──────────────────────────────────────────
  const attachedIds = useMemo(() => new Set(eventContacts.map((c) => c.id)), [eventContacts]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase();
    return allContacts.filter((c) => {
      if (attachedIds.has(c.id)) return false;
      if (!q) return true;
      return (
        c.fullName?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    });
  }, [allContacts, attachedIds, contactSearch]);

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (isLoading || !event) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: event.title,
          headerRight: () => (
            <TouchableOpacity onPress={openEdit} style={{ marginRight: 4, padding: 6 }}>
              <Feather name="edit-2" size={18} color={colors.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom }}
      >
        {/* ── Event Info Card ───────────────────────────────────────────── */}
        <GlassCard style={{ margin: 16 }}>
          <View style={styles.eventHeader}>
            <View
              style={[
                styles.eventIconContainer,
                {
                  backgroundColor: event.isActive ? colors.primary + "22" : colors.secondary,
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Feather
                name="calendar"
                size={28}
                color={event.isActive ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={styles.eventHeaderContent}>
              <Text style={[styles.eventName, { color: colors.foreground }]}>{event.title}</Text>
              <View style={styles.badgeRow}>
                {event.isActive ? (
                  <View style={styles.activeBadge}>
                    <View style={[styles.activeDot, { backgroundColor: "#22C55E" }]} />
                    <Text style={[styles.activeText, { color: "#22C55E" }]}>Active</Text>
                  </View>
                ) : null}
                {eventContacts.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="users" size={11} color={colors.primary} />
                    <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                      {eventContacts.length} {eventContacts.length === 1 ? "attendee" : "attendees"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {event.locationLabel ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>{event.locationLabel}</Text>
            </View>
          ) : null}

          {event.startedAt ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>{formatDate(event.startedAt)}</Text>
            </View>
          ) : null}

          {event.tags && event.tags.length > 0 ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="tag" size={14} color={colors.mutedForeground} />
              <View style={styles.tagRow}>
                {event.tags.map((tag) => (
                  <View key={tag} style={[styles.tagChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.tagChipText, { color: colors.foreground }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {event.notes ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="file-text" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, styles.notesText, { color: colors.foreground }]}>{event.notes}</Text>
            </View>
          ) : null}

          {event.eventLink ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="external-link" size={14} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={1}>{event.eventLink}</Text>
            </View>
          ) : null}
        </GlassCard>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <View style={[styles.actionsGrid, { marginHorizontal: 16, marginBottom: 16 }]}>
          <TouchableOpacity
            onPress={handleScanAtEvent}
            style={[styles.actionTile, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Feather name="camera" size={20} color="#fff" />
            <Text style={styles.actionTilePrimaryText}>Scan Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBatchScan}
            style={[styles.actionTile, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, borderWidth: 1 }]}
          >
            <Feather name="layers" size={20} color={colors.foreground} />
            <Text style={[styles.actionTileText, { color: colors.foreground }]}>Batch Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setContactSearch(""); setSheet("add-existing"); }}
            style={[styles.actionTile, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, borderWidth: 1 }]}
          >
            <Feather name="user-plus" size={20} color={colors.foreground} />
            <Text style={[styles.actionTileText, { color: colors.foreground }]}>Add Existing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleActive}
            style={[styles.actionTile, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius, borderWidth: 1 }]}
          >
            <Feather name={event.isActive ? "pause-circle" : "play-circle"} size={20} color={event.isActive ? colors.mutedForeground : colors.primary} />
            <Text style={[styles.actionTileText, { color: event.isActive ? colors.mutedForeground : colors.primary }]}>
              {event.isActive ? "Deactivate" : "Activate"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Contacts List ─────────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 16, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
            CONTACTS ({eventContacts.length})
          </Text>
        </View>

        {eventContacts.length === 0 ? (
          <View style={styles.emptyContacts}>
            <Feather name="users" size={28} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No contacts yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
              Scan cards or add existing contacts
            </Text>
          </View>
        ) : (
          eventContacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onPress={() => router.push(`/contact/${c.id}` as any)}
            />
          ))
        )}

        {/* ── Danger Zone ───────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
          style={[styles.deleteButton, { borderColor: colors.destructive + "44", borderRadius: colors.radius, marginHorizontal: 16, marginTop: 24 }]}
        >
          {deleteMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <>
              <Feather name="trash-2" size={15} color={colors.destructive} />
              <Text style={[styles.deleteButtonText, { color: colors.destructive }]}>Delete Event</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Edit Event Sheet ──────────────────────────────────────────────── */}
      <Modal
        visible={sheet === "edit"}
        animationType="slide"
        transparent
        onRequestClose={() => setSheet("none")}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetOverlay}
        >
          <View style={[styles.sheetContent, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Edit Event</Text>
              <TouchableOpacity onPress={() => setSheet("none")}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EVENT NAME</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}
                placeholderTextColor={colors.mutedForeground}
                placeholder="Event name"
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>DATE</Text>
              <TouchableOpacity
                onPress={() => { setTempDate(editDate || new Date()); setShowDatePicker(true); }}
                style={[styles.textInput, styles.dateTouchable, { backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <Feather name="calendar" size={15} color={colors.mutedForeground} />
                <Text style={{ color: editDate ? colors.foreground : colors.mutedForeground, fontSize: 15, flex: 1 }}>
                  {editDate
                    ? editDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "Tap to set date (optional)"}
                </Text>
                {editDate && (
                  <TouchableOpacity onPress={() => setEditDate(null)}>
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>TAGS</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                  style={[styles.tagTextInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder="Add tag…"
                />
                <TouchableOpacity
                  onPress={addTag}
                  style={[styles.tagAddBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 2 }]}
                >
                  <Feather name="plus" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              {editTags.length > 0 && (
                <View style={styles.editTagsRow}>
                  {editTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => removeTag(tag)}
                      style={[styles.editTagChip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
                    >
                      <Text style={[styles.editTagChipText, { color: colors.primary }]}>{tag}</Text>
                      <Feather name="x" size={11} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>NOTES</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                style={[styles.textInput, styles.multilineInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}
                placeholderTextColor={colors.mutedForeground}
                placeholder="Notes about this event…"
                multiline
                numberOfLines={4}
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>EVENT LINK</Text>
              <TextInput
                value={editLink}
                onChangeText={setEditLink}
                style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}
                placeholderTextColor={colors.mutedForeground}
                placeholder="https://…"
                autoCapitalize="none"
                keyboardType="url"
              />

              <TouchableOpacity
                onPress={saveEdit}
                disabled={updateMutation.isPending || !editTitle.trim()}
                style={[
                  styles.saveEditBtn,
                  {
                    backgroundColor: editTitle.trim() ? colors.primary : colors.muted,
                    borderRadius: colors.radius,
                    marginTop: 20,
                  },
                ]}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveEditBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Date Picker Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showDatePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: insets.bottom + 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" as const }}>Event Date</Text>
              <TouchableOpacity onPress={() => { setEditDate(tempDate); setShowDatePicker(false); }}>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" as const }}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, date) => {
                if (date) setTempDate(date);
                if (Platform.OS === "android") {
                  setEditDate(date || tempDate);
                  setShowDatePicker(false);
                }
              }}
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Add Existing Contact Sheet ────────────────────────────────────── */}
      <Modal
        visible={sheet === "add-existing"}
        animationType="slide"
        transparent
        onRequestClose={() => setSheet("none")}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContent, styles.sheetContentTall, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add Existing Contact</Text>
              <TouchableOpacity onPress={() => setSheet("none")}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder="Search contacts…"
              autoCapitalize="none"
            />

            <FlatList
              data={filteredContacts}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleAttachExisting(item)}
                  style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                  disabled={attachMutation.isPending}
                >
                  <View style={[styles.pickerAvatar, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="user" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.fullName || "Unknown"}
                    </Text>
                    {(item.jobTitle || item.companyName) ? (
                      <Text style={[styles.pickerMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {[item.jobTitle, item.companyName].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="plus-circle" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyPicker}>
                  <Text style={[styles.emptyPickerText, { color: colors.mutedForeground }]}>
                    {contactSearch ? "No matches" : "All contacts already added"}
                  </Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // event header
  eventHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  eventIconContainer: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  eventHeaderContent: { flex: 1 },
  eventName: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  activeDot: { width: 7, height: 7, borderRadius: 3.5 },
  activeText: { fontSize: 12, fontWeight: "600" as const },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  countBadgeText: { fontSize: 11, fontWeight: "600" as const },

  // meta rows
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
  metaText: { fontSize: 14, flex: 1 },
  notesText: { lineHeight: 20 },
  linkText: { fontSize: 13, flex: 1 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  tagChipText: { fontSize: 12, fontWeight: "500" as const },

  // action grid
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionTile: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  actionTilePrimaryText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  actionTileText: { fontSize: 13, fontWeight: "500" as const },

  // section header
  sectionHeader: { fontSize: 12, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.8 },

  // empty state
  emptyContacts: { alignItems: "center", paddingTop: 32, gap: 8, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: "500" as const, marginTop: 8 },
  emptySubtext: { fontSize: 13, textAlign: "center" },

  // delete button
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1 },
  deleteButtonText: { fontSize: 14, fontWeight: "500" as const },

  // sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheetContent: { maxHeight: "75%", marginHorizontal: 8, marginBottom: 8, padding: 20 },
  sheetContentTall: { maxHeight: "85%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.2)", alignSelf: "center", marginBottom: 16 },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700" as const },

  // edit form
  fieldLabel: { fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  textInput: { paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, borderWidth: 1 },
  multilineInput: { minHeight: 90, textAlignVertical: "top" as const },
  tagInputRow: { flexDirection: "row", gap: 8 },
  tagTextInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, borderWidth: 1 },
  tagAddBtn: { width: 44, alignItems: "center", justifyContent: "center" },
  editTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  editTagChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  editTagChipText: { fontSize: 13, fontWeight: "500" as const },
  dateTouchable: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  saveEditBtn: { paddingVertical: 14, alignItems: "center" },
  saveEditBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },

  // contact picker
  searchInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, marginBottom: 12 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pickerName: { fontSize: 15, fontWeight: "500" as const },
  pickerMeta: { fontSize: 12, marginTop: 1 },
  emptyPicker: { paddingVertical: 32, alignItems: "center" },
  emptyPickerText: { fontSize: 14 },
});
