import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { api, Contact } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type DuplicateGroup = [Contact, Contact];

interface MergeField {
  key: keyof Contact;
  label: string;
  icon: string;
}

const MERGE_FIELDS: MergeField[] = [
  { key: "fullName", label: "Name", icon: "user" },
  { key: "jobTitle", label: "Title", icon: "briefcase" },
  { key: "companyName", label: "Company", icon: "building" },
  { key: "email", label: "Email", icon: "mail" },
  { key: "phone", label: "Phone", icon: "phone" },
  { key: "website", label: "Website", icon: "globe" },
];

function normalName(s?: string | null) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findDuplicateGroups(contacts: Contact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<number>();

  const byName = new Map<string, Contact[]>();
  contacts.forEach((c) => {
    if (!c.fullName) return;
    const key = normalName(c.fullName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(c);
  });

  const byEmail = new Map<string, Contact[]>();
  contacts.forEach((c) => {
    if (!c.email) return;
    const key = c.email.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(c);
  });

  [...byName.values(), ...byEmail.values()].forEach((group) => {
    if (group.length < 2) return;
    const fresh = group.filter((c) => !seenIds.has(c.id));
    if (fresh.length < 2) return;
    seenIds.add(fresh[0].id);
    seenIds.add(fresh[1].id);
    groups.push([fresh[0], fresh[1]]);
  });

  return groups;
}

function matchReason(a: Contact, b: Contact): string {
  if (
    a.fullName &&
    b.fullName &&
    normalName(a.fullName) === normalName(b.fullName)
  )
    return "Same name";
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase())
    return "Same email";
  return "Similar contact";
}

function pickBetter(a?: string | null, b?: string | null): "left" | "right" {
  if (!a && b) return "right";
  if (a && !b) return "left";
  if ((a?.length ?? 0) >= (b?.length ?? 0)) return "left";
  return "right";
}

export default function DuplicatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
  });

  const duplicateGroups = useMemo(
    () => findDuplicateGroups(contacts),
    [contacts]
  );

  const [mergeTarget, setMergeTarget] = useState<DuplicateGroup | null>(null);
  const [fieldChoices, setFieldChoices] = useState<
    Record<string, "left" | "right">
  >({});
  const [merging, setMerging] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleGroups = duplicateGroups.filter(
    ([a, b]) => !dismissed.has(`${a.id}:${b.id}`)
  );

  const openMergeSheet = (group: DuplicateGroup) => {
    const [left, right] = group;
    const choices: Record<string, "left" | "right"> = {};
    MERGE_FIELDS.forEach((f) => {
      choices[f.key as string] = pickBetter(
        left[f.key] as string | null | undefined,
        right[f.key] as string | null | undefined
      );
    });
    setFieldChoices(choices);
    setMergeTarget(group);
  };

  const handleMerge = async () => {
    if (!mergeTarget) return;
    const [left, right] = mergeTarget;
    setMerging(true);
    try {
      const mergedFields: Partial<Contact> = {};
      MERGE_FIELDS.forEach((f) => {
        const choice = fieldChoices[f.key as string] ?? "left";
        const val = choice === "left" ? left[f.key] : right[f.key];
        if (val != null) {
          (mergedFields as Record<string, unknown>)[f.key as string] = val;
        }
      });

      await api.updateContact(left.id, mergedFields);
      await api.deleteContact(right.id);
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMergeTarget(null);
    } catch {
      Alert.alert("Error", "Could not merge contacts. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  if (isLoading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ title: "Duplicates" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Possible Duplicates" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Summary header */}
        <View
          style={[
            styles.summaryHeader,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Feather name="copy" size={18} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.summaryTitle, { color: colors.foreground }]}
            >
              {visibleGroups.length} possible duplicate
              {visibleGroups.length !== 1 ? "s" : ""} found
            </Text>
            <Text
              style={[
                styles.summaryBody,
                { color: colors.mutedForeground },
              ]}
            >
              Review and merge contacts that appear to be the same person
            </Text>
          </View>
        </View>

        {visibleGroups.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={48} color="#34C759" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              All clear!
            </Text>
            <Text
              style={[styles.emptyBody, { color: colors.mutedForeground }]}
            >
              No duplicate contacts detected
            </Text>
          </View>
        )}

        {visibleGroups.map(([a, b], idx) => (
          <DuplicateGroupCard
            key={`${a.id}:${b.id}`}
            left={a}
            right={b}
            reason={matchReason(a, b)}
            colors={colors}
            onMerge={() => openMergeSheet([a, b])}
            onDismiss={() =>
              setDismissed((s) => new Set(s).add(`${a.id}:${b.id}`))
            }
            onNavigate={(id) => router.push(`/contact/${id}` as any)}
          />
        ))}
      </ScrollView>

      {/* Merge field-picker sheet */}
      {mergeTarget && (
        <MergeSheet
          group={mergeTarget}
          fieldChoices={fieldChoices}
          onToggleField={(key, side) =>
            setFieldChoices((prev) => ({ ...prev, [key]: side }))
          }
          onConfirm={handleMerge}
          onCancel={() => setMergeTarget(null)}
          merging={merging}
          colors={colors}
        />
      )}
    </>
  );
}

function DuplicateGroupCard({
  left,
  right,
  reason,
  colors,
  onMerge,
  onDismiss,
  onNavigate,
}: {
  left: Contact;
  right: Contact;
  reason: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onMerge: () => void;
  onDismiss: () => void;
  onNavigate: (id: number) => void;
}) {
  const leftName = left.fullName || left.email || "Unknown";
  const rightName = right.fullName || right.email || "Unknown";

  return (
    <View
      style={[
        styles.groupCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Match reason badge */}
      <View style={styles.reasonRow}>
        <View
          style={[styles.reasonBadge, { backgroundColor: "#FEF3C7" }]}
        >
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      </View>

      {/* Side-by-side contacts */}
      <View style={styles.sideRow}>
        <TouchableOpacity
          style={[styles.contactSide, { borderColor: colors.border }]}
          onPress={() => onNavigate(left.id)}
          activeOpacity={0.75}
        >
          <Avatar name={leftName} size={40} />
          <Text
            style={[styles.sideName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {leftName}
          </Text>
          {left.jobTitle ? (
            <Text
              style={[styles.sideMeta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {left.jobTitle}
            </Text>
          ) : null}
          {left.companyName ? (
            <Text
              style={[styles.sideMeta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {left.companyName}
            </Text>
          ) : null}
        </TouchableOpacity>

        <View style={styles.mergeArrow}>
          <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
        </View>

        <TouchableOpacity
          style={[styles.contactSide, { borderColor: colors.border }]}
          onPress={() => onNavigate(right.id)}
          activeOpacity={0.75}
        >
          <Avatar name={rightName} size={40} />
          <Text
            style={[styles.sideName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {rightName}
          </Text>
          {right.jobTitle ? (
            <Text
              style={[styles.sideMeta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {right.jobTitle}
            </Text>
          ) : null}
          {right.companyName ? (
            <Text
              style={[styles.sideMeta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {right.companyName}
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={onDismiss}
          style={[styles.dismissBtn, { borderColor: colors.border }]}
        >
          <Feather name="x" size={14} color={colors.mutedForeground} />
          <Text
            style={[styles.dismissBtnText, { color: colors.mutedForeground }]}
          >
            Dismiss
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMerge}
          style={[styles.mergeBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="git-merge" size={14} color="#fff" />
          <Text style={styles.mergeBtnText}>Merge</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MergeSheet({
  group,
  fieldChoices,
  onToggleField,
  onConfirm,
  onCancel,
  merging,
  colors,
}: {
  group: DuplicateGroup;
  fieldChoices: Record<string, "left" | "right">;
  onToggleField: (key: string, side: "left" | "right") => void;
  onConfirm: () => void;
  onCancel: () => void;
  merging: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [left, right] = group;

  const confirmMerge = () => {
    Alert.alert(
      "Merge Contacts",
      `This will keep "${left.fullName || left.email}" and delete "${right.fullName || right.email}". The chosen field values will be applied to the kept contact.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Merge", style: "destructive", onPress: onConfirm },
      ]
    );
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={mergeStyles.overlay}>
        <View
          style={[mergeStyles.sheet, { backgroundColor: colors.card }]}
        >
          <View style={mergeStyles.handle} />
          <Text style={[mergeStyles.title, { color: colors.foreground }]}>
            Choose fields to keep
          </Text>
          <Text style={[mergeStyles.subtitle, { color: colors.mutedForeground }]}>
            Tap a value to select it. The left contact will be kept.
          </Text>

          {/* Column headers */}
          <View style={mergeStyles.colHeaders}>
            <Text
              style={[mergeStyles.colHeader, { color: colors.primary }]}
              numberOfLines={1}
            >
              ← Keep: {left.fullName || left.email || "Contact A"}
            </Text>
            <Text
              style={[
                mergeStyles.colHeader,
                { color: colors.mutedForeground, textAlign: "right" },
              ]}
              numberOfLines={1}
            >
              Delete: {right.fullName || right.email || "Contact B"} →
            </Text>
          </View>

          <ScrollView
            style={{ maxHeight: 360 }}
            showsVerticalScrollIndicator={false}
          >
            {MERGE_FIELDS.map((f) => {
              const leftVal = left[f.key] as string | undefined | null;
              const rightVal = right[f.key] as string | undefined | null;
              if (!leftVal && !rightVal) return null;
              const choice = fieldChoices[f.key as string] ?? "left";

              return (
                <View
                  key={f.key as string}
                  style={[
                    mergeStyles.fieldRow,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View style={mergeStyles.fieldLabelRow}>
                    <Feather
                      name={f.icon as any}
                      size={12}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        mergeStyles.fieldLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </View>
                  <View style={mergeStyles.fieldValues}>
                    <TouchableOpacity
                      onPress={() => onToggleField(f.key as string, "left")}
                      style={[
                        mergeStyles.valueBtn,
                        {
                          backgroundColor:
                            choice === "left"
                              ? colors.primary + "18"
                              : colors.secondary,
                          borderColor:
                            choice === "left"
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                    >
                      {choice === "left" && (
                        <Feather
                          name="check"
                          size={11}
                          color={colors.primary}
                        />
                      )}
                      <Text
                        style={[
                          mergeStyles.valueText,
                          {
                            color:
                              choice === "left"
                                ? colors.primary
                                : colors.foreground,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {leftVal || "—"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onToggleField(f.key as string, "right")}
                      style={[
                        mergeStyles.valueBtn,
                        {
                          backgroundColor:
                            choice === "right"
                              ? colors.primary + "18"
                              : colors.secondary,
                          borderColor:
                            choice === "right"
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                    >
                      {choice === "right" && (
                        <Feather
                          name="check"
                          size={11}
                          color={colors.primary}
                        />
                      )}
                      <Text
                        style={[
                          mergeStyles.valueText,
                          {
                            color:
                              choice === "right"
                                ? colors.primary
                                : colors.foreground,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {rightVal || "—"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={mergeStyles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[
                mergeStyles.cancelBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                },
              ]}
            >
              <Text
                style={[mergeStyles.cancelBtnText, { color: colors.foreground }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmMerge}
              disabled={merging}
              style={[
                mergeStyles.confirmBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              {merging ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="git-merge" size={15} color="#fff" />
                  <Text style={mergeStyles.confirmBtnText}>Merge</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  summaryTitle: { fontSize: 15, fontWeight: "600" as const },
  summaryBody: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" as const },
  emptyBody: { fontSize: 14, textAlign: "center" },
  groupCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  reasonRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  reasonBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reasonText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#D97706",
  },
  sideRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  contactSide: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  sideName: { fontSize: 13, fontWeight: "600" as const, textAlign: "center" },
  sideMeta: { fontSize: 11, textAlign: "center" },
  mergeArrow: { alignItems: "center", paddingHorizontal: 2 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  dismissBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dismissBtnText: { fontSize: 13, fontWeight: "500" as const },
  mergeBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mergeBtnText: { fontSize: 13, fontWeight: "600" as const, color: "#fff" },
});

const mergeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: "700" as const },
  subtitle: { fontSize: 13 },
  colHeaders: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  colHeader: { fontSize: 11, fontWeight: "600" as const, flex: 1 },
  fieldRow: { paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  fieldValues: { flexDirection: "row", gap: 8 },
  valueBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  valueText: { flex: 1, fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600" as const },
  confirmBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#fff" },
});
