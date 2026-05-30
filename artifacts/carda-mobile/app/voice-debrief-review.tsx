import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { GlassCard } from "@/components/GlassCard";
import { useColors } from "@/hooks/useColors";
import { api, Contact } from "@/lib/api";
import { debriefStore } from "@/lib/debriefStore";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface ParsedTask {
  title: string;
  dueDescription: string | null;
  accepted: boolean;
  editing: boolean;
  editText: string;
}

interface ParsedReminder {
  label: string;
  whenDescription: string | null;
}

interface ParseResult {
  matchedContact: {
    id: string | null;
    name: string;
    matchedName: string;
    company: string;
    confidence: "high" | "medium" | "low";
  } | null;
  noteSummary: string;
  sentiment: "positive" | "neutral" | "negative";
  warmthLevel: "hot" | "warm" | "neutral" | "cold";
  tasks: Array<{ title: string; dueDescription: string | null }>;
  reminders: ParsedReminder[];
  communicationIntents: Array<{
    recipientName: string;
    recipientCompany: string;
    intentDescription: string;
    suggestedTone: string;
  }>;
  rawTranscript: string;
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "#10B981",
  neutral: "#6B7280",
  negative: "#EF4444",
};

const WARMTH_LABEL: Record<string, string> = {
  hot: "🔥 Hot",
  warm: "☀️ Warm",
  neutral: "😐 Neutral",
  cold: "🧊 Cold",
};

export default function VoiceDebriefReviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const transcript = debriefStore.getTranscript();
  const preContactId = debriefStore.getContactId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    preContactId
  );
  const [contactSearch, setContactSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
  });

  useEffect(() => {
    if (!transcript) {
      setError("No transcript found. Please record again.");
      setLoading(false);
      return;
    }

    const contactsForApi = contacts.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      companyName: c.companyName,
    }));

    const run = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/debrief/parse`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, contacts: contactsForApi }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Parse failed");
        }

        const data: ParseResult = await res.json();

        setSummary(data.noteSummary || "");
        setTasks(
          (data.tasks || []).map((t) => ({
            title: t.title,
            dueDescription: t.dueDescription,
            accepted: true,
            editing: false,
            editText: t.title,
          }))
        );

        const intent = data.communicationIntents?.[0];
        if (intent) {
          setFollowUp(
            `Follow up with ${intent.recipientName}${
              intent.recipientCompany ? ` at ${intent.recipientCompany}` : ""
            }: ${intent.intentDescription}`
          );
        }

        if (!preContactId && data.matchedContact?.id) {
          const numId = parseInt(data.matchedContact.id, 10);
          if (!isNaN(numId)) {
            const found = contacts.find((c) => c.id === numId);
            if (found) setSelectedContactId(numId);
          }
        }
      } catch (err: any) {
        setError(err?.message || "Could not analyse debrief. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [transcript, contacts.length]);

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  const handleSave = async () => {
    const acceptedTasks = tasks.filter((t) => t.accepted);

    if (!selectedContactId && acceptedTasks.length === 0) {
      Alert.alert(
        "Nothing to save",
        "Select a contact or keep at least one task."
      );
      return;
    }

    setSaving(true);
    try {
      if (selectedContactId) {
        const summaryText = summary.trim() || "Voice Debrief";
        await api.createContactTask(selectedContactId, {
          clientId: `debrief-${Date.now()}`,
          title: `Voice Debrief: ${summaryText.slice(0, 120)}`,
        });

        for (const task of acceptedTasks) {
          const title = task.editing ? task.editText.trim() : task.title;
          if (!title) continue;
          await api.createContactTask(selectedContactId, {
            clientId: `debrief-task-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,
            title,
          });
        }

        await qc.invalidateQueries({ queryKey: ["contact-tasks", String(selectedContactId)] });
        await qc.invalidateQueries({ queryKey: ["/api/contacts"] });
      }

      debriefStore.clear();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (selectedContactId) {
        router.replace(`/contact/${selectedContactId}` as any);
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert("Discard debrief?", "Your recording and notes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          debriefStore.clear();
          router.back();
        },
      },
    ]);
  };

  const toggleTask = (idx: number) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, accepted: !t.accepted } : t))
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveTaskEdit = (idx: number) => {
    setTasks((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, editing: false, title: t.editText } : t
      )
    );
  };

  const s = makeStyles(colors, insets);

  if (!transcript) {
    return (
      <>
        <Stack.Screen options={{ title: "Voice Debrief", headerShown: true }} />
        <View style={s.centered}>
          <Text style={{ color: colors.mutedForeground }}>
            No recording found.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Analysing…", headerShown: true }} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>
            Analysing your debrief…
          </Text>
          <Text style={[s.loadingSubText, { color: colors.mutedForeground }]}>
            Extracting tasks, notes, and follow-ups
          </Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: "Voice Debrief", headerShown: true }} />
        <View style={s.centered}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Review Debrief",
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={handleDiscard} style={{ paddingRight: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
                Discard
              </Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[s.saveHeaderBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveHeaderText}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Contact Picker ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>ATTACH TO CONTACT</Text>
            <TouchableOpacity
              style={[
                s.pickerRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowPicker(!showPicker)}
              activeOpacity={0.8}
            >
              {selectedContact ? (
                <View style={s.pickerSelected}>
                  <View
                    style={[s.pickerAvatar, { backgroundColor: "#EEF2FF" }]}
                  >
                    <Text style={[s.pickerAvatarText, { color: "#6366F1" }]}>
                      {(selectedContact.fullName ?? "?")[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.pickerName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {selectedContact.fullName ?? "Unknown"}
                    </Text>
                    {selectedContact.companyName ? (
                      <Text
                        style={[
                          s.pickerCompany,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        {selectedContact.companyName}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedContactId(null);
                      setShowPicker(false);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.pickerPlaceholder}>
                  <Feather name="user-plus" size={16} color={colors.mutedForeground} />
                  <Text
                    style={[s.pickerPlaceholderText, { color: colors.mutedForeground }]}
                  >
                    Select a contact (optional)
                  </Text>
                  <Feather
                    name={showPicker ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </View>
              )}
            </TouchableOpacity>

            {showPicker && (
              <GlassCard style={s.pickerDropdown}>
                <TextInput
                  style={[
                    s.pickerSearch,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  value={contactSearch}
                  onChangeText={setContactSearch}
                  placeholder="Search contacts…"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  autoCorrect={false}
                />
                {filteredContacts.slice(0, 8).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      s.pickerItem,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor:
                          selectedContactId === c.id
                            ? colors.primary + "12"
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setSelectedContactId(c.id);
                      setShowPicker(false);
                      setContactSearch("");
                      Haptics.selectionAsync();
                    }}
                  >
                    <View
                      style={[s.pickerAvatar, { backgroundColor: "#EEF2FF" }]}
                    >
                      <Text
                        style={[s.pickerAvatarText, { color: "#6366F1" }]}
                      >
                        {(c.fullName ?? "?")[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[s.pickerName, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {c.fullName ?? c.email ?? "Unknown"}
                      </Text>
                      {c.companyName ? (
                        <Text
                          style={[
                            s.pickerCompany,
                            { color: colors.mutedForeground },
                          ]}
                          numberOfLines={1}
                        >
                          {c.companyName}
                        </Text>
                      ) : null}
                    </View>
                    {selectedContactId === c.id && (
                      <Feather name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                {filteredContacts.length === 0 && (
                  <Text
                    style={[
                      s.pickerEmpty,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    No contacts found
                  </Text>
                )}
              </GlassCard>
            )}
          </View>

          {/* ── Summary ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>MEETING SUMMARY</Text>
            <GlassCard style={s.card}>
              {editingSummary ? (
                <>
                  <TextInput
                    style={[
                      s.summaryInput,
                      { color: colors.foreground, borderColor: colors.border },
                    ]}
                    value={summary}
                    onChangeText={setSummary}
                    multiline
                    autoFocus
                    textAlignVertical="top"
                    placeholderTextColor={colors.mutedForeground}
                    placeholder="Describe what happened in the meeting…"
                  />
                  <TouchableOpacity
                    style={[s.doneBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setEditingSummary(false)}
                  >
                    <Text style={s.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => setEditingSummary(true)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.summaryText,
                      {
                        color: summary ? colors.foreground : colors.mutedForeground,
                      },
                    ]}
                  >
                    {summary || "Tap to add a summary…"}
                  </Text>
                  <Feather
                    name="edit-2"
                    size={14}
                    color={colors.mutedForeground}
                    style={{ marginTop: 8 }}
                  />
                </TouchableOpacity>
              )}
            </GlassCard>
          </View>

          {/* ── Tasks ── */}
          {tasks.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>EXTRACTED TASKS</Text>
              <GlassCard style={s.card}>
                {tasks.map((task, idx) => (
                  <View
                    key={idx}
                    style={[
                      s.taskRow,
                      { borderBottomColor: colors.border },
                      idx === tasks.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => toggleTask(idx)}
                      style={s.taskCheck}
                    >
                      <View
                        style={[
                          s.checkbox,
                          {
                            borderColor: task.accepted
                              ? colors.primary
                              : colors.border,
                            backgroundColor: task.accepted
                              ? colors.primary
                              : "transparent",
                          },
                        ]}
                      >
                        {task.accepted && (
                          <Feather name="check" size={11} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      {task.editing ? (
                        <TextInput
                          style={[
                            s.taskEditInput,
                            {
                              color: colors.foreground,
                              borderColor: colors.primary,
                            },
                          ]}
                          value={task.editText}
                          onChangeText={(v) =>
                            setTasks((prev) =>
                              prev.map((t, i) =>
                                i === idx ? { ...t, editText: v } : t
                              )
                            )
                          }
                          onBlur={() => saveTaskEdit(idx)}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={() => saveTaskEdit(idx)}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() =>
                            setTasks((prev) =>
                              prev.map((t, i) =>
                                i === idx
                                  ? { ...t, editing: true, editText: t.title }
                                  : t
                              )
                            )
                          }
                        >
                          <Text
                            style={[
                              s.taskTitle,
                              {
                                color: task.accepted
                                  ? colors.foreground
                                  : colors.mutedForeground,
                                textDecorationLine: task.accepted
                                  ? "none"
                                  : "line-through",
                              },
                            ]}
                          >
                            {task.title}
                          </Text>
                          {task.dueDescription && (
                            <Text
                              style={[
                                s.taskDue,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Due: {task.dueDescription}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </GlassCard>
              <Text style={[s.taskHint, { color: colors.mutedForeground }]}>
                Tap to check/uncheck • Tap task text to edit
              </Text>
            </View>
          )}

          {/* ── Follow-up ── */}
          {followUp ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>FOLLOW-UP</Text>
              <GlassCard style={s.card}>
                <View style={s.followUpHeader}>
                  <Feather name="send" size={14} color="#6366F1" />
                  <Text style={[s.followUpText, { color: colors.foreground }]}>
                    {followUp}
                  </Text>
                </View>
              </GlassCard>
            </View>
          ) : null}

          {/* ── Raw Transcript ── */}
          <View style={s.section}>
            <TouchableOpacity
              style={s.transcriptToggle}
              onPress={() => setShowTranscript(!showTranscript)}
              activeOpacity={0.8}
            >
              <Text style={[s.sectionLabel, { marginBottom: 0 }]}>
                RAW TRANSCRIPT
              </Text>
              <Feather
                name={showTranscript ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {showTranscript && (
              <GlassCard style={[s.card, { marginTop: 8 }]}>
                <Text
                  style={[s.transcriptText, { color: colors.mutedForeground }]}
                >
                  {transcript}
                </Text>
              </GlassCard>
            )}
          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[
              s.saveBtn,
              { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={s.saveBtnText}>Save Debrief</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: { bottom: number }
) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      gap: 16,
      padding: 32,
    },
    loadingText: {
      fontSize: 17,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 12,
    },
    loadingSubText: {
      fontSize: 13,
      textAlign: "center",
    },
    errorText: {
      fontSize: 15,
      textAlign: "center",
    },
    retryBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 28,
      marginTop: 8,
    },
    retryBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },

    saveHeaderBtn: {
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 14,
      marginLeft: 8,
    },
    saveHeaderText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: insets.bottom + 40,
    },

    section: { marginBottom: 20 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      letterSpacing: 0.8,
      marginBottom: 8,
    },

    card: { padding: 14 },

    pickerRow: {
      borderRadius: 12,
      borderWidth: 1,
      overflow: "hidden",
    },
    pickerSelected: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
    },
    pickerPlaceholder: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 14,
    },
    pickerPlaceholderText: {
      flex: 1,
      fontSize: 14,
    },
    pickerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    pickerAvatarText: {
      fontSize: 15,
      fontWeight: "700",
    },
    pickerName: {
      fontSize: 14,
      fontWeight: "600",
    },
    pickerCompany: {
      fontSize: 12,
      marginTop: 1,
    },
    pickerDropdown: {
      marginTop: 6,
      padding: 8,
      maxHeight: 280,
    },
    pickerSearch: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      marginBottom: 6,
    },
    pickerItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderRadius: 8,
    },
    pickerEmpty: {
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 12,
    },

    summaryInput: {
      fontSize: 14,
      lineHeight: 21,
      minHeight: 80,
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
      textAlignVertical: "top",
    },
    summaryText: {
      fontSize: 14,
      lineHeight: 21,
    },
    doneBtn: {
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: "center",
    },
    doneBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },

    taskRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    taskCheck: {
      paddingTop: 2,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    taskTitle: {
      fontSize: 14,
      lineHeight: 20,
    },
    taskDue: {
      fontSize: 11,
      marginTop: 2,
    },
    taskEditInput: {
      fontSize: 14,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    taskHint: {
      fontSize: 11,
      marginTop: 6,
    },

    followUpHeader: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
    },
    followUpText: {
      fontSize: 14,
      lineHeight: 20,
      flex: 1,
    },

    transcriptToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    transcriptText: {
      fontSize: 13,
      lineHeight: 20,
    },

    saveBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    saveBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
  });
}
