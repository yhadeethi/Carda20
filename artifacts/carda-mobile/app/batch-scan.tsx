import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { useQueryClient } from "@tanstack/react-query";
import { api, Contact } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type Phase = "capture" | "scanning" | "review" | "saving";

interface BatchItem {
  id: string;
  uri: string;
  phase: "queued" | "scanning" | "done" | "failed";
  result?: Partial<Contact>;
  error?: string;
  approved: boolean;
  editForm?: Partial<Contact>;
}

let _idCounter = 0;
function nextId() { return String(++_idCounter); }

export default function BatchScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { eventId: eventIdParam, eventTitle: eventTitleParam } =
    useLocalSearchParams<{ eventId?: string; eventTitle?: string }>();
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const eventTitle = eventTitleParam ? decodeURIComponent(eventTitleParam) : undefined;

  const [phase, setPhase] = useState<Phase>("capture");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [totalToScan, setTotalToScan] = useState(0);
  const [reviewIndex, setReviewIndex] = useState(0);

  const editingItem = editingId ? items.find((i) => i.id === editingId) : null;

  // ── pick image(s) ─────────────────────────────────────────────────────────
  const pickImages = async (useCamera: boolean) => {
    const perms = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perms.status !== "granted") {
      Alert.alert("Permission required", `Please allow ${useCamera ? "camera" : "photo library"} access in Settings.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.85, allowsMultipleSelection: true });

    if (result.canceled || !result.assets.length) return;

    const newItems: BatchItem[] = result.assets.map((a) => ({
      id: nextId(),
      uri: a.uri,
      phase: "queued",
      approved: false,
    }));
    setItems((prev) => [...prev, ...newItems]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // ── start scanning all queued items ───────────────────────────────────────
  const startScan = async () => {
    const queued = items.filter((i) => i.phase === "queued");
    if (!queued.length) return;

    setPhase("scanning");
    setTotalToScan(queued.length);
    setScanProgress(0);

    const updated = [...items];
    for (const item of updated) {
      if (item.phase === "queued") item.phase = "scanning";
    }
    setItems([...updated]);

    let done = 0;
    await Promise.all(
      queued.map(async (item) => {
        try {
          const formData = new FormData();
          formData.append("image", { uri: item.uri, type: "image/jpeg", name: "card.jpg" } as any);
          const scanResult = await api.scanCard(formData);
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, phase: "done", result: scanResult.contact, approved: true }
                : i
            )
          );
        } catch (err: any) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, phase: "failed", error: err?.message || "Scan failed" }
                : i
            )
          );
        } finally {
          done++;
          setScanProgress(done);
        }
      })
    );

    setReviewIndex(0);
    setPhase("review");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── approve / reject ──────────────────────────────────────────────────────
  const toggleApprove = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, approved: !i.approved } : i)));
  };

  const approveAll = () => {
    setItems((prev) => prev.map((i) => (i.phase === "done" ? { ...i, approved: true } : i)));
  };

  // ── edit a single scanned result ──────────────────────────────────────────
  const openEdit = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, editForm: { ...i.result } } : i))
    );
    setEditingId(id);
  };

  const closeEdit = () => setEditingId(null);

  const updateEditForm = (key: keyof Contact, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === editingId ? { ...i, editForm: { ...i.editForm, [key]: value } } : i))
    );
  };

  const saveEdit = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === editingId
          ? { ...i, result: { ...i.editForm }, approved: true }
          : i
      )
    );
    setEditingId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── save all approved contacts ────────────────────────────────────────────
  const saveApproved = async () => {
    const approved = items.filter((i) => i.phase === "done" && i.approved && i.result);
    if (!approved.length) {
      Alert.alert("Nothing to save", "Approve at least one contact first.");
      return;
    }
    setPhase("saving");

    const savedIds: number[] = [];
    for (const item of approved) {
      try {
        const contact = await api.createContact(item.result!);
        if (contact.id) savedIds.push(contact.id);
      } catch {
        // continue with remaining
      }
    }

    if (eventId && savedIds.length > 0) {
      try {
        await api.attachContactsToEvent(eventId, savedIds);
        await qc.invalidateQueries({ queryKey: ["event-contacts", String(eventId)] });
      } catch {
        // non-fatal
      }
    }

    await qc.invalidateQueries({ queryKey: ["contacts"] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert(
      `${savedIds.length} contact${savedIds.length !== 1 ? "s" : ""} saved`,
      eventId ? "Contacts attached to the event." : undefined,
      [{ text: "OK", onPress: () => (eventId ? router.push(`/event/${eventId}` as any) : router.back()) }]
    );
  };

  const approvedCount = items.filter((i) => i.phase === "done" && i.approved).length;
  const doneCount = items.filter((i) => i.phase === "done" || i.phase === "failed").length;
  const failedCount = items.filter((i) => i.phase === "failed").length;

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  // ── Edit Modal ────────────────────────────────────────────────────────────
  const EditModal = () => {
    if (!editingItem) return null;
    const form = editingItem.editForm || editingItem.result || {};
    const ef = (label: string, key: keyof Contact, multiline = false) => (
      <View key={key} style={styles.editField}>
        <Text style={[styles.editFieldLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
        <TextInput
          value={(form[key] as string) || ""}
          onChangeText={(v) => updateEditForm(key, v)}
          style={[styles.editFieldInput, { color: colors.foreground, borderBottomColor: colors.border }, multiline && styles.multiline]}
          placeholderTextColor={colors.mutedForeground}
          placeholder={label}
          multiline={multiline}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    );

    return (
      <Modal visible animationType="slide" transparent onRequestClose={closeEdit}>
        <View style={styles.editOverlay}>
          <View style={[styles.editSheet, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.editSheetHeader}>
              <TouchableOpacity onPress={closeEdit}>
                <Text style={[styles.editCancel, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.editSheetTitle, { color: colors.foreground }]}>Edit Contact</Text>
              <TouchableOpacity onPress={saveEdit}>
                <Text style={[styles.editSave, { color: colors.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Image source={{ uri: editingItem.uri }} style={[styles.editThumb, { borderRadius: colors.radius, borderColor: colors.border }]} resizeMode="cover" />
              {ef("Full Name", "fullName")}
              {ef("Job Title", "jobTitle")}
              {ef("Company", "companyName")}
              {ef("Email", "email")}
              {ef("Phone", "phone")}
              {ef("Website", "website")}
              {ef("LinkedIn", "linkedinUrl")}
              {ef("Notes", "notes", true)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Scanning phase ────────────────────────────────────────────────────────
  if (phase === "scanning") {
    return (
      <>
        <Stack.Screen options={{ title: "Scanning…", headerBackVisible: false }} />
        <View style={[styles.container, styles.centeredFull, { backgroundColor: colors.background }]}>
          <LinearGradient
            colors={[colors.gradientStart + "22", colors.gradientEnd + "22"]}
            style={[styles.scanningCard, { borderRadius: colors.radius * 2 }]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.scanningTitle, { color: colors.foreground }]}>
              Scanning {scanProgress} of {totalToScan}…
            </Text>
            <Text style={[styles.scanningSubtitle, { color: colors.mutedForeground }]}>
              AI is extracting contact info
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${totalToScan > 0 ? (scanProgress / totalToScan) * 100 : 0}%` },
                ]}
              />
            </View>
          </LinearGradient>
        </View>
      </>
    );
  }

  // ── Saving phase ──────────────────────────────────────────────────────────
  if (phase === "saving") {
    return (
      <>
        <Stack.Screen options={{ title: "Saving…", headerBackVisible: false }} />
        <View style={[styles.container, styles.centeredFull, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.scanningTitle, { color: colors.foreground }]}>Saving contacts…</Text>
          {eventId ? <Text style={[styles.scanningSubtitle, { color: colors.mutedForeground }]}>Attaching to event</Text> : null}
        </View>
      </>
    );
  }

  // ── Review phase (one-by-one carousel) ───────────────────────────────────
  if (phase === "review") {
    const safeIndex = Math.min(reviewIndex, items.length - 1);
    const currentItem = items[safeIndex];
    const total = items.length;
    const isFirst = safeIndex === 0;
    const isLast = safeIndex === total - 1;
    const isFailed = currentItem?.phase === "failed";
    const c = currentItem?.result || {};

    const goNext = () => {
      if (!isLast) setReviewIndex((i) => i + 1);
    };
    const goPrev = () => {
      if (!isFirst) setReviewIndex((i) => i - 1);
    };

    return (
      <>
        <Stack.Screen
          options={{
            title: `Review Cards`,
            headerRight: () => (
              <TouchableOpacity onPress={approveAll} style={{ marginRight: 4, padding: 6 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" as const, fontSize: 14 }}>Approve All</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <EditModal />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* progress nav bar */}
          <View style={[styles.carouselNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={isFirst}
              style={[styles.carouselNavBtn, isFirst && { opacity: 0.3 }]}
            >
              <Feather name="chevron-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text style={[styles.carouselCounter, { color: colors.foreground }]}>
                Card {safeIndex + 1} of {total}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {approvedCount} approved · {failedCount} failed
              </Text>
            </View>
            <TouchableOpacity
              onPress={goNext}
              disabled={isLast}
              style={[styles.carouselNavBtn, isLast && { opacity: 0.3 }]}
            >
              <Feather name="chevron-right" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* card display */}
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: paddingBottom + 140 }}
            showsVerticalScrollIndicator={false}
          >
            {isFailed ? (
              <View style={[styles.carouselCard, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={40} color={colors.destructive} />
                <Text style={[styles.carouselFailTitle, { color: colors.destructive }]}>Scan Failed</Text>
                <Text style={[styles.carouselFailMsg, { color: colors.mutedForeground }]}>
                  {currentItem?.error || "Could not parse this card."}
                </Text>
              </View>
            ) : (
              <View style={[styles.carouselCard, {
                backgroundColor: currentItem?.approved ? "#22C55E08" : colors.card,
                borderColor: currentItem?.approved ? "#22C55E66" : colors.border,
              }]}>
                <Image
                  source={{ uri: currentItem?.uri }}
                  style={[styles.carouselImage, { borderColor: colors.border, borderRadius: colors.radius }]}
                  resizeMode="cover"
                />
                {currentItem?.approved && (
                  <View style={styles.carouselApprovedBadge}>
                    <Feather name="check-circle" size={18} color="#22C55E" />
                    <Text style={{ color: "#22C55E", fontWeight: "600" as const, fontSize: 13 }}>Approved</Text>
                  </View>
                )}
                <View style={styles.carouselDetails}>
                  <Text style={[styles.carouselName, { color: colors.foreground }]}>
                    {c.fullName || "Unknown Name"}
                  </Text>
                  {(c.jobTitle || c.companyName) ? (
                    <Text style={[styles.carouselMeta, { color: colors.mutedForeground }]}>
                      {[c.jobTitle, c.companyName].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                  {c.email ? (
                    <Text style={[styles.carouselMeta, { color: colors.mutedForeground }]}>{c.email}</Text>
                  ) : null}
                  {c.phone ? (
                    <Text style={[styles.carouselMeta, { color: colors.mutedForeground }]}>{c.phone}</Text>
                  ) : null}
                  {c.website ? (
                    <Text style={[styles.carouselMeta, { color: colors.mutedForeground }]}>{c.website}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => currentItem && openEdit(currentItem.id)}
                  style={[styles.carouselEditBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Edit details</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* dot indicators */}
            <View style={styles.dotRow}>
              {items.map((item, idx) => (
                <TouchableOpacity key={item.id} onPress={() => setReviewIndex(idx)}>
                  <View style={[
                    styles.dot,
                    {
                      backgroundColor: idx === safeIndex
                        ? colors.primary
                        : item.approved
                          ? "#22C55E"
                          : item.phase === "failed"
                            ? colors.destructive
                            : colors.border,
                      width: idx === safeIndex ? 20 : 8,
                    },
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* action buttons */}
          {!isFailed && (
            <View style={[styles.carouselActions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => { removeItem(currentItem!.id); if (!isFirst) setReviewIndex((i) => i - 1); }}
                style={[styles.carouselActionBtn, { borderColor: colors.destructive + "55", borderRadius: colors.radius }]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontWeight: "500" as const }}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { toggleApprove(currentItem!.id); if (!isLast) goNext(); }}
                style={[
                  styles.carouselActionBtn,
                  {
                    backgroundColor: currentItem?.approved ? "#22C55E" : colors.primary,
                    borderColor: "transparent",
                    borderRadius: colors.radius,
                    flex: 2,
                  },
                ]}
              >
                <Feather name={currentItem?.approved ? "x" : "check"} size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600" as const }}>
                  {currentItem?.approved ? "Unapprove" : "Approve"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {isFailed && (
            <View style={[styles.carouselActions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => { removeItem(currentItem!.id); if (!isFirst) setReviewIndex((i) => i - 1); }}
                style={[styles.carouselActionBtn, { borderColor: colors.destructive + "55", borderRadius: colors.radius, flex: 1 }]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontWeight: "500" as const }}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* save bar */}
          <View style={[styles.saveBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity
              onPress={saveApproved}
              disabled={approvedCount === 0}
              style={[
                styles.saveBarBtn,
                { backgroundColor: approvedCount > 0 ? colors.primary : colors.muted, borderRadius: colors.radius },
              ]}
            >
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.saveBarBtnText}>
                Save {approvedCount} Contact{approvedCount !== 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // ── Capture phase ─────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ title: eventTitle ? `Batch Scan · ${eventTitle}` : "Batch Scan" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: paddingBottom + 80 }}>
          {/* header */}
          <View style={styles.captureHeader}>
            <Text style={[styles.captureTitle, { color: colors.foreground }]}>Capture Cards</Text>
            <Text style={[styles.captureSubtitle, { color: colors.mutedForeground }]}>
              Add multiple cards, then scan them all at once
            </Text>
          </View>

          {/* capture buttons */}
          <View style={styles.captureButtons}>
            <TouchableOpacity onPress={() => pickImages(true)} style={styles.capturePrimaryBtn}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.captureGradient, { borderRadius: colors.radius }]}
              >
                <Feather name="camera" size={18} color="#fff" />
                <Text style={styles.capturePrimaryText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => pickImages(false)}
              style={[styles.captureSecondaryBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <Feather name="image" size={18} color={colors.foreground} />
              <Text style={[styles.captureSecondaryText, { color: colors.foreground }]}>Choose from Library</Text>
            </TouchableOpacity>
          </View>

          {/* thumbnails grid */}
          {items.length > 0 ? (
            <>
              <Text style={[styles.queueHeader, { color: colors.mutedForeground }]}>
                QUEUE · {items.length} CARD{items.length !== 1 ? "S" : ""}
              </Text>
              <View style={styles.thumbGrid}>
                {items.map((item) => (
                  <View key={item.id} style={[styles.thumbWrap, { borderRadius: colors.radius, borderColor: colors.border }]}>
                    <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.thumbRemove}>
                      <Feather name="x" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyQueue}>
              <Feather name="layers" size={40} color={colors.border} />
              <Text style={[styles.emptyQueueText, { color: colors.mutedForeground }]}>No cards yet</Text>
              <Text style={[styles.emptyQueueSub, { color: colors.mutedForeground }]}>
                Take photos or pick from your library
              </Text>
            </View>
          )}
        </ScrollView>

        {/* scan all button */}
        {items.length > 0 && (
          <View style={[styles.saveBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              onPress={startScan}
              style={[styles.saveBarBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.saveBarBtnText}>Scan {items.length} Card{items.length !== 1 ? "s" : ""}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredFull: { alignItems: "center", justifyContent: "center", gap: 16 },

  // scanning
  scanningCard: { padding: 40, alignItems: "center", gap: 14, margin: 32 },
  scanningTitle: { fontSize: 18, fontWeight: "600" as const },
  scanningSubtitle: { fontSize: 14, textAlign: "center" },
  progressBar: { width: "100%", height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },

  // carousel review
  carouselNav: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 10, borderBottomWidth: 1 },
  carouselNavBtn: { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const },
  carouselCounter: { fontSize: 16, fontWeight: "600" as const },
  carouselCard: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center" as const, gap: 12, marginBottom: 20 },
  carouselImage: { width: "100%" as const, height: 200, borderWidth: 1 },
  carouselApprovedBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  carouselDetails: { width: "100%" as const, gap: 4 },
  carouselName: { fontSize: 18, fontWeight: "700" as const, textAlign: "center" as const },
  carouselMeta: { fontSize: 14, textAlign: "center" as const },
  carouselEditBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, marginTop: 4 },
  carouselFailTitle: { fontSize: 17, fontWeight: "600" as const, textAlign: "center" as const },
  carouselFailMsg: { fontSize: 14, textAlign: "center" as const },
  carouselActions: { flexDirection: "row" as const, gap: 10, padding: 12, borderTopWidth: 1 },
  carouselActionBtn: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6, paddingVertical: 13, borderWidth: 1 },
  dotRow: { flexDirection: "row" as const, gap: 5, justifyContent: "center" as const, marginTop: 4 },
  dot: { height: 8, borderRadius: 4 },

  // review (list, kept for reference)
  reviewSummary: { flexDirection: "row", justifyContent: "center", gap: 32, paddingVertical: 12, borderBottomWidth: 1 },
  reviewSummaryItem: { alignItems: "center" },
  reviewSummaryNum: { fontSize: 22, fontWeight: "700" as const },
  reviewSummaryLabel: { fontSize: 12, marginTop: 2 },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  reviewRowFailed: {},
  reviewThumb: { width: 48, height: 60, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  reviewName: { fontSize: 14, fontWeight: "600" as const },
  reviewMeta: { fontSize: 12, marginTop: 2 },
  reviewActions: { flexDirection: "row", gap: 2 },
  reviewBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 6 },

  // save bar
  saveBar: { borderTopWidth: 1, padding: 12 },
  saveBarBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  saveBarBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },

  // capture
  captureHeader: { alignItems: "center", paddingVertical: 20, gap: 6 },
  captureTitle: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  captureSubtitle: { fontSize: 14, textAlign: "center" },
  captureButtons: { gap: 10, marginBottom: 24 },
  capturePrimaryBtn: { shadowColor: "#3B82F6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  captureGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  capturePrimaryText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  captureSecondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderWidth: 1 },
  captureSecondaryText: { fontSize: 15, fontWeight: "500" as const },
  queueHeader: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumbWrap: { width: 80, height: 100, borderWidth: 1, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  thumbRemove: {
    position: "absolute", top: 4, right: 4,
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },
  emptyQueue: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyQueueText: { fontSize: 16, fontWeight: "500" as const, marginTop: 8 },
  emptyQueueSub: { fontSize: 13, textAlign: "center" },

  // edit modal
  editOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  editSheet: { maxHeight: "90%" },
  editSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  editSheetTitle: { fontSize: 16, fontWeight: "700" as const },
  editCancel: { fontSize: 15 },
  editSave: { fontSize: 15, fontWeight: "600" as const },
  editThumb: { height: 120, marginBottom: 16, borderWidth: 1 },
  editField: { marginBottom: 12 },
  editFieldLabel: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  editFieldInput: { fontSize: 15, paddingVertical: 6, borderBottomWidth: 1 },
  multiline: { minHeight: 60, textAlignVertical: "top" as const },
});
