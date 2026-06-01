import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContactCard } from "@/components/ContactCard";
import { CompanyCard } from "@/components/CompanyCard";
import { api, Contact } from "@/lib/api";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

type SegTab = "people" | "companies";

type DeptFilter =
  | "ALL"
  | "EXEC"
  | "SALES"
  | "OPS"
  | "FINANCE"
  | "LEGAL"
  | "PROJECT_DELIVERY"
  | "UNKNOWN";

const DEPT_ORDER: DeptFilter[] = [
  "EXEC",
  "SALES",
  "PROJECT_DELIVERY",
  "OPS",
  "FINANCE",
  "LEGAL",
  "UNKNOWN",
];

const DEPT_LABELS: Record<string, string> = {
  EXEC: "Exec",
  SALES: "Sales",
  PROJECT_DELIVERY: "Delivery",
  OPS: "Ops",
  FINANCE: "Finance",
  LEGAL: "Legal",
  UNKNOWN: "Other",
};

const DEPT_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  EXEC: { bar: "#5856D6", bg: "#EDE9FE", text: "#5856D6" },
  SALES: { bar: "#FF3B30", bg: "#FFE4E1", text: "#FF3B30" },
  PROJECT_DELIVERY: { bar: "#00C7BE", bg: "#CCFBF1", text: "#0D9488" },
  OPS: { bar: "#34C759", bg: "#DCFCE7", text: "#16A34A" },
  FINANCE: { bar: "#F59E0B", bg: "#FEF3C7", text: "#D97706" },
  LEGAL: { bar: "#6366F1", bg: "#E0E7FF", text: "#6366F1" },
  UNKNOWN: { bar: "#8E8E93", bg: "#F3F4F6", text: "#6B7280" },
};

function findDuplicateGroups(contacts: Contact[]): Contact[][] {
  const groups: Contact[][] = [];
  const seenIds = new Set<number>();

  const byName = new Map<string, Contact[]>();
  contacts.forEach((c) => {
    if (!c.fullName) return;
    const key = c.fullName.trim().toLowerCase().replace(/\s+/g, " ");
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
    const newContacts = group.filter((c) => !seenIds.has(c.id));
    if (newContacts.length < 2) return;
    newContacts.slice(0, 2).forEach((c) => seenIds.add(c.id));
    groups.push(group.slice(0, 2));
  });

  return groups;
}

export default function NetworkScreen() {
  const colors = useColors();
  const router = useRouter();

  const [tab, setTab] = useState<SegTab>("people");
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("ALL");
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const {
    data: contacts = [],
    isLoading: loadingContacts,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.getContacts(),
  });

  const {
    data: companies = [],
    isLoading: loadingCompanies,
    refetch: refetchCompanies,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.getCompanies(),
  });

  const duplicateGroups = useMemo(
    () => findDuplicateGroups(contacts),
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (deptFilter !== "ALL") {
      list = list.filter(
        (c) =>
          (c.orgDepartment ?? "UNKNOWN").toUpperCase() === deptFilter
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) =>
        [c.fullName, c.companyName, c.jobTitle, c.email]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, query, deptFilter]);

  const filteredCompanies = useMemo(() => {
    if (!query.trim()) return companies;
    const q = query.toLowerCase();
    return companies.filter(
      (co) =>
        co.name.toLowerCase().includes(q) ||
        (co.domain ?? "").toLowerCase().includes(q)
    );
  }, [companies, query]);

  const s = makeStyles(colors);
  const filterActive = deptFilter !== "ALL";

  const peopleLabel =
    contacts.length > 0 ? `People · ${contacts.length}` : "People";
  const companiesLabel =
    companies.length > 0 ? `Companies · ${companies.length}` : "Companies";

  const subheading =
    contacts.length > 0 || companies.length > 0
      ? `${contacts.length} ${contacts.length === 1 ? "person" : "people"} · ${companies.length} ${companies.length === 1 ? "company" : "companies"}`
      : null;

  return (
    <SafeAreaView style={s.bg} edges={["top"]}>
      {/* ── Fixed header ─────────────────────────────────────── */}
      <View style={s.header}>
        {/* Title + search icon */}
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.screenTitle, { color: colors.foreground }]}>
              Network
            </Text>
            {subheading ? (
              <Text style={[s.screenSubtitle, { color: colors.mutedForeground }]}>
                {subheading}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => router.push("/search" as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.searchIconBtn}
          >
            <Feather name="search" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Segment control */}
        <View style={s.segWrap}>
          <TouchableOpacity
            style={[s.segBtn, tab === "people" && s.segBtnActive]}
            onPress={() => setTab("people")}
            activeOpacity={0.75}
          >
            <Text
              style={[s.segText, tab === "people" && s.segTextActive]}
            >
              {peopleLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segBtn, tab === "companies" && s.segBtnActive]}
            onPress={() => setTab("companies")}
            activeOpacity={0.75}
          >
            <Text
              style={[s.segText, tab === "companies" && s.segTextActive]}
            >
              {companiesLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search + Filter row */}
        <View style={s.searchRow}>
          <View style={[s.searchWrap, { flex: 1 }]}>
            <Feather
              name="search"
              size={15}
              color={colors.mutedForeground}
              style={{ opacity: 0.5 }}
            />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              value={query}
              onChangeText={setQuery}
              placeholder={
                tab === "people" ? "Search people…" : "Search companies…"
              }
              placeholderTextColor={colors.mutedForeground}
              clearButtonMode={
                Platform.OS === "ios" ? "while-editing" : "never"
              }
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && Platform.OS !== "ios" && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button — only shown on People tab */}
          {tab === "people" && (
            <TouchableOpacity
              onPress={() => setShowFilterSheet(true)}
              style={[
                s.filterBtn,
                {
                  backgroundColor: filterActive
                    ? colors.primary + "1A"
                    : colors.card,
                  borderColor: filterActive
                    ? colors.primary + "60"
                    : colors.border,
                },
              ]}
            >
              <Feather
                name="filter"
                size={15}
                color={filterActive ? colors.primary : colors.mutedForeground}
              />
              {filterActive && (
                <View
                  style={[
                    s.filterBadge,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={s.filterBadgeText}>1</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Duplicates banner ─────────────────────────────────── */}
      {tab === "people" && duplicateGroups.length > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/duplicates" as any)}
          style={[
            s.dupBanner,
            {
              backgroundColor: "#FEF3C7",
              borderColor: "#FDE68A",
            },
          ]}
          activeOpacity={0.8}
        >
          <Feather name="copy" size={14} color="#D97706" />
          <Text style={s.dupBannerText}>
            {duplicateGroups.length} possible duplicate
            {duplicateGroups.length !== 1 ? "s" : ""} detected
          </Text>
          <Feather name="chevron-right" size={14} color="#D97706" />
        </TouchableOpacity>
      )}

      {/* Active filter pill */}
      {tab === "people" && filterActive && (
        <View style={s.activePillRow}>
          <View
            style={[
              s.activePill,
              {
                backgroundColor:
                  DEPT_COLORS[deptFilter as string]?.bg ?? "#F3F4F6",
              },
            ]}
          >
            <Text
              style={[
                s.activePillText,
                {
                  color:
                    DEPT_COLORS[deptFilter as string]?.text ?? "#6B7280",
                },
              ]}
            >
              {DEPT_LABELS[deptFilter as string] ?? deptFilter}
            </Text>
            <TouchableOpacity
              onPress={() => setDeptFilter("ALL")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="x"
                size={12}
                color={DEPT_COLORS[deptFilter as string]?.text ?? "#6B7280"}
              />
            </TouchableOpacity>
          </View>
          <Text style={[s.filteredCount, { color: colors.mutedForeground }]}>
            {filteredContacts.length} shown
          </Text>
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      {tab === "people" ? (
        <FlatList
          data={filteredContacts}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item: c }) => (
            <View style={s.itemWrap}>
              <ContactCard
                contact={c}
                onPress={() => router.push(`/contact/${c.id}` as any)}
                showDepartment={deptFilter === "ALL"}
              />
            </View>
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loadingContacts}
              onRefresh={refetchContacts}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={40} color={colors.border} />
              <Text style={s.emptyTitle}>
                {query || filterActive ? "No results" : "No contacts yet"}
              </Text>
              <Text style={s.emptyBody}>
                {query
                  ? "Try a different search term"
                  : filterActive
                  ? "No contacts in this department"
                  : "Scan your first card to get started"}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(co) => String(co.id)}
          renderItem={({ item: co }) => (
            <CompanyCard
              company={co}
              contactCount={contacts.filter((c) => c.companyId === co.id).length}
              onPress={() => router.push(`/company/${co.id}` as any)}
            />
          )}
          contentContainerStyle={s.listContentCompanies}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loadingCompanies}
              onRefresh={refetchCompanies}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="briefcase" size={40} color={colors.border} />
              <Text style={s.emptyTitle}>
                {query ? "No results" : "No companies yet"}
              </Text>
              <Text style={s.emptyBody}>
                {query
                  ? "Try a different search term"
                  : "Companies appear automatically when contacts have a company name"}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Department filter bottom sheet ──────────────────── */}
      <DeptFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        value={deptFilter}
        onChange={(v) => {
          setDeptFilter(v);
          setShowFilterSheet(false);
        }}
        contacts={contacts}
        colors={colors}
      />
    </SafeAreaView>
  );
}

interface DeptFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  value: DeptFilter;
  onChange: (v: DeptFilter) => void;
  contacts: Contact[];
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}

function DeptFilterSheet({
  visible,
  onClose,
  value,
  onChange,
  contacts,
  colors,
}: DeptFilterSheetProps) {
  const deptCounts = useMemo(() => {
    const map = new Map<DeptFilter, number>();
    DEPT_ORDER.forEach((d) => {
      map.set(
        d,
        contacts.filter(
          (c) => (c.orgDepartment ?? "UNKNOWN").toUpperCase() === d
        ).length
      );
    });
    return map;
  }, [contacts]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={sheetStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            sheetStyles.sheet,
            { backgroundColor: colors.card },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={sheetStyles.handle} />
          <Text style={[sheetStyles.title, { color: colors.foreground }]}>
            Filter by Department
          </Text>

          <ScrollView
            contentContainerStyle={sheetStyles.chipsWrap}
            showsVerticalScrollIndicator={false}
          >
            {/* All chip */}
            <TouchableOpacity
              onPress={() => onChange("ALL")}
              style={[
                sheetStyles.chip,
                {
                  backgroundColor:
                    value === "ALL" ? colors.primary : colors.secondary,
                  borderColor:
                    value === "ALL" ? colors.primary : colors.border,
                },
              ]}
            >
              {value === "ALL" && (
                <Feather name="check" size={12} color="#fff" />
              )}
              <Text
                style={[
                  sheetStyles.chipText,
                  { color: value === "ALL" ? "#fff" : colors.mutedForeground },
                ]}
              >
                All ({contacts.length})
              </Text>
            </TouchableOpacity>

            {DEPT_ORDER.map((dept) => {
              const count = deptCounts.get(dept) ?? 0;
              const active = value === dept;
              const dc = DEPT_COLORS[dept];
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => onChange(dept)}
                  style={[
                    sheetStyles.chip,
                    {
                      backgroundColor: active ? dc.bar : dc.bg,
                      borderColor: active ? dc.bar : "transparent",
                    },
                  ]}
                >
                  {active && (
                    <Feather name="check" size={12} color="#fff" />
                  )}
                  <Text
                    style={[
                      sheetStyles.chipText,
                      { color: active ? "#fff" : dc.text },
                    ]}
                  >
                    {DEPT_LABELS[dept]} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            style={[
              sheetStyles.closeBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Text style={[sheetStyles.closeBtnText, { color: colors.foreground }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 12,
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
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "500" as const },
  closeBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  closeBtnText: { fontSize: 15, fontWeight: "600" as const },
});

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.background },

    header: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 4,
      backgroundColor: colors.background,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    screenTitle: { fontSize: 28, fontWeight: "700" as const, fontFamily: Fonts.bold, letterSpacing: -0.3 },
    screenSubtitle: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 2 },
    searchIconBtn: {
      paddingTop: 4,
      paddingLeft: 12,
    },

    segWrap: {
      flexDirection: "row",
      backgroundColor: "#F2F2F7",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.1)",
      padding: 4,
      marginBottom: 10,
    },
    segBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 7,
      borderRadius: 12,
    },
    segBtnActive: {
      backgroundColor: colors.card,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 3,
      elevation: 2,
    },
    segText: {
      fontSize: 13,
      fontWeight: "600",
      fontFamily: Fonts.semiBold,
      color: colors.mutedForeground,
    },
    segTextActive: { color: colors.foreground },

    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    searchInput: { flex: 1, fontSize: 14, padding: 0, margin: 0 },

    filterBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    filterBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    filterBadgeText: {
      fontSize: 9,
      fontWeight: "800" as const,
      color: "#fff",
    },

    dupBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    dupBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600" as const,
      color: "#D97706",
    },

    activePillRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 6,
    },
    activePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    activePillText: { fontSize: 12, fontWeight: "600" as const },
    filteredCount: { fontSize: 12 },

    listContent: { paddingBottom: 130, paddingTop: 4 },
    listContentCompanies: { paddingBottom: 130, paddingTop: 4 },
    itemWrap: {},

    empty: {
      alignItems: "center",
      paddingTop: 80,
      gap: 10,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
    },
  });
}
