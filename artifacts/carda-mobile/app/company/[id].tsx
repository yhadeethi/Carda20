import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { ContactCard } from "@/components/ContactCard";
import { GlassCard } from "@/components/GlassCard";
import { OrgChartTree } from "@/components/OrgChartTree";
import { api, Company, Contact, IntelResult } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type TabId = "people" | "org" | "brief";

type Department = "EXEC" | "SALES" | "OPS" | "FINANCE" | "LEGAL" | "PROJECT_DELIVERY" | "UNKNOWN";

const DEPT_ORDER: Department[] = [
  "EXEC",
  "SALES",
  "PROJECT_DELIVERY",
  "OPS",
  "FINANCE",
  "LEGAL",
  "UNKNOWN",
];

const DEPT_LABELS: Record<Department, string> = {
  EXEC: "Exec",
  SALES: "Sales",
  PROJECT_DELIVERY: "Delivery",
  OPS: "Ops",
  FINANCE: "Finance",
  LEGAL: "Legal",
  UNKNOWN: "Other",
};

const DEPT_COLORS: Record<Department, { bar: string; bg: string; text: string }> = {
  EXEC: { bar: "#5856D6", bg: "#EDE9FE", text: "#5856D6" },
  SALES: { bar: "#FF3B30", bg: "#FFE4E1", text: "#FF3B30" },
  PROJECT_DELIVERY: { bar: "#00C7BE", bg: "#CCFBF1", text: "#0D9488" },
  OPS: { bar: "#34C759", bg: "#DCFCE7", text: "#16A34A" },
  FINANCE: { bar: "#F59E0B", bg: "#FEF3C7", text: "#D97706" },
  LEGAL: { bar: "#6366F1", bg: "#E0E7FF", text: "#6366F1" },
  UNKNOWN: { bar: "#8E8E93", bg: "#F3F4F6", text: "#6B7280" },
};

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>("people");
  const [deptFilter, setDeptFilter] = useState<Department | "ALL">("ALL");
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intel, setIntel] = useState<IntelResult | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [autoGrouping, setAutoGrouping] = useState(false);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: api.getCompanies,
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
  });

  const company = companies?.find((c) => String(c.id) === id);
  const companyContacts = useMemo(
    () =>
      contacts.filter(
        (c) => c.companyId === company?.id || c.companyName === company?.name
      ),
    [contacts, company]
  );

  const filteredContacts = useMemo(() => {
    if (deptFilter === "ALL") return companyContacts;
    return companyContacts.filter(
      (c) => (c.orgDepartment ?? "UNKNOWN").toUpperCase() === deptFilter
    );
  }, [companyContacts, deptFilter]);

  const groupedByDept = useMemo(() => {
    const map = new Map<Department, Contact[]>();
    DEPT_ORDER.forEach((d) => map.set(d, []));
    filteredContacts.forEach((c) => {
      const dept = ((c.orgDepartment ?? "UNKNOWN").toUpperCase()) as Department;
      const key = DEPT_ORDER.includes(dept) ? dept : "UNKNOWN";
      map.get(key)!.push(c);
    });
    return map;
  }, [filteredContacts]);

  const deptCounts = useMemo(() => {
    const map = new Map<Department, number>();
    DEPT_ORDER.forEach((d) => {
      map.set(d, companyContacts.filter(
        (c) => (c.orgDepartment ?? "UNKNOWN").toUpperCase() === d
      ).length);
    });
    return map;
  }, [companyContacts]);

  const ungroupedCount = companyContacts.filter(
    (c) => !c.orgDepartment || c.orgDepartment.toUpperCase() === "UNKNOWN"
  ).length;

  const fetchIntel = async () => {
    if (!company) return;
    setLoadingIntel(true);
    setIntelError(null);
    try {
      const result = await api.getIntel(company.name, company.domain);
      setIntel(result);
    } catch {
      setIntelError("Could not load company intelligence. Try again.");
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleAutoGroup = async () => {
    if (ungroupedCount === 0) {
      Alert.alert("No changes", "All contacts already have departments assigned.");
      return;
    }
    setAutoGrouping(true);
    try {
      const { changed } = await api.autoGroupCompanyContacts(companyContacts);
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Auto-group complete",
        changed > 0
          ? `Grouped ${changed} contact${changed !== 1 ? "s" : ""} by department.`
          : "No contacts could be matched to a department by title."
      );
    } catch {
      Alert.alert("Error", "Could not auto-group contacts.");
    } finally {
      setAutoGrouping(false);
    }
  };

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (!company) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: "people", label: "People", icon: "users" },
    { id: "org", label: "Org", icon: "git-branch" },
    { id: "brief", label: "Brief", icon: "zap" },
  ];

  return (
    <>
      <Stack.Screen options={{ title: company.name }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Hero */}
        <View
          style={[
            styles.heroSection,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Avatar name={company.name} size={60} square />
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={[styles.companyName, { color: colors.foreground }]}>
              {company.name}
            </Text>
            {company.industry ? (
              <Text style={[styles.industry, { color: colors.mutedForeground }]}>
                {company.industry}
              </Text>
            ) : null}
            {company.domain ? (
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    company.domain!.startsWith("http")
                      ? company.domain!
                      : `https://${company.domain}`
                  )
                }
              >
                <Text style={[styles.domain, { color: colors.primary }]}>
                  {company.domain}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={[styles.contactCount, { color: colors.mutedForeground }]}>
            {companyContacts.length} contact{companyContacts.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Tab bar */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tab,
                  active && {
                    borderBottomWidth: 2,
                    borderBottomColor: colors.primary,
                  },
                ]}
              >
                <Feather
                  name={tab.icon as any}
                  size={14}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? colors.primary : colors.mutedForeground },
                    active && { fontWeight: "600" as const },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* People tab */}
        {activeTab === "people" && (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={{ paddingBottom }}
          >
            {/* Dept filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                onPress={() => setDeptFilter("ALL")}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      deptFilter === "ALL" ? colors.primary : colors.secondary,
                    borderColor:
                      deptFilter === "ALL" ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        deptFilter === "ALL" ? "#fff" : colors.mutedForeground,
                    },
                  ]}
                >
                  All ({companyContacts.length})
                </Text>
              </TouchableOpacity>
              {DEPT_ORDER.filter((d) => (deptCounts.get(d) ?? 0) > 0).map(
                (dept) => {
                  const active = deptFilter === dept;
                  const dc = DEPT_COLORS[dept];
                  return (
                    <TouchableOpacity
                      key={dept}
                      onPress={() => setDeptFilter(dept)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: active ? dc.bar : dc.bg,
                          borderColor: active ? dc.bar : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: active ? "#fff" : dc.text },
                        ]}
                      >
                        {DEPT_LABELS[dept]} ({deptCounts.get(dept)})
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>

            {/* Auto-group button */}
            {ungroupedCount > 0 && (
              <TouchableOpacity
                onPress={handleAutoGroup}
                disabled={autoGrouping}
                style={[
                  styles.autoGroupBtn,
                  {
                    backgroundColor: colors.primary + "12",
                    borderColor: colors.primary + "40",
                    borderRadius: colors.radius,
                  },
                ]}
              >
                {autoGrouping ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="layers" size={15} color={colors.primary} />
                )}
                <Text style={[styles.autoGroupText, { color: colors.primary }]}>
                  {autoGrouping
                    ? "Grouping…"
                    : `Auto-group ${ungroupedCount} ungrouped contact${ungroupedCount !== 1 ? "s" : ""}`}
                </Text>
              </TouchableOpacity>
            )}

            {/* Grouped contacts */}
            {DEPT_ORDER.map((dept) => {
              const group = groupedByDept.get(dept) ?? [];
              if (group.length === 0) return null;
              const dc = DEPT_COLORS[dept];
              return (
                <View key={dept}>
                  <View style={styles.deptHeader}>
                    <View
                      style={[styles.deptBar, { backgroundColor: dc.bar }]}
                    />
                    <Text
                      style={[styles.deptHeaderText, { color: dc.text }]}
                    >
                      {DEPT_LABELS[dept]}
                    </Text>
                    <Text
                      style={[
                        styles.deptCount,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {group.length}
                    </Text>
                  </View>
                  {group.map((c) => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      onPress={() => router.push(`/contact/${c.id}`)}
                      showDepartment={true}
                    />
                  ))}
                </View>
              );
            })}

            {filteredContacts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No contacts in this company
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Org tab */}
        {activeTab === "org" && (
          <View style={{ flex: 1 }}>
            {companyContacts.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="git-branch" size={36} color={colors.mutedForeground} />
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  No contacts to chart
                </Text>
              </View>
            ) : (
              <>
                {ungroupedCount === companyContacts.length && (
                  <View
                    style={[
                      styles.orgHint,
                      { backgroundColor: colors.card, borderBottomColor: colors.border },
                    ]}
                  >
                    <Feather name="info" size={13} color={colors.mutedForeground} />
                    <Text
                      style={[styles.orgHintText, { color: colors.mutedForeground }]}
                    >
                      Set reporting lines on contact profiles to build the chart
                    </Text>
                  </View>
                )}
                <OrgChartTree
                  contacts={companyContacts}
                  onNodePress={(c) => router.push(`/contact/${c.id}`)}
                />
              </>
            )}
          </View>
        )}

        {/* Brief tab */}
        {activeTab === "brief" && (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={{ paddingBottom }}
          >
            {!intel && (
              <TouchableOpacity
                onPress={fetchIntel}
                disabled={loadingIntel}
                style={[
                  styles.intelButton,
                  {
                    margin: 16,
                    backgroundColor: colors.primary + "1A",
                    borderColor: colors.primary + "44",
                    borderRadius: colors.radius,
                  },
                ]}
              >
                {loadingIntel ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="zap" size={18} color={colors.primary} />
                )}
                <Text
                  style={[styles.intelButtonText, { color: colors.primary }]}
                >
                  {loadingIntel
                    ? "Generating company intelligence…"
                    : "Get AI Company Intelligence"}
                </Text>
              </TouchableOpacity>
            )}

            {intelError ? (
              <Text
                style={[
                  styles.intelError,
                  { color: colors.destructive, marginHorizontal: 16 },
                ]}
              >
                {intelError}
              </Text>
            ) : null}

            {intel ? (
              <View style={{ marginHorizontal: 16 }}>
                <GlassCard style={{ marginBottom: 12 }}>
                  {intel.description ? (
                    <>
                      <Text
                        style={[
                          styles.intelSectionTitle,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        About
                      </Text>
                      <Text
                        style={[styles.intelText, { color: colors.foreground }]}
                      >
                        {intel.description}
                      </Text>
                    </>
                  ) : null}
                  {[
                    { label: "Industry", value: intel.industry },
                    { label: "Founded", value: intel.founded },
                    { label: "Size", value: intel.size },
                    { label: "Headquarters", value: intel.headquarters },
                    { label: "Funding", value: intel.funding },
                  ]
                    .filter((i) => i.value)
                    .map((item) => (
                      <View
                        key={item.label}
                        style={[
                          styles.intelRow,
                          { borderTopColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.intelLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            styles.intelValue,
                            { color: colors.foreground },
                          ]}
                        >
                          {item.value}
                        </Text>
                      </View>
                    ))}
                </GlassCard>

                {intel.recentNews?.length ? (
                  <GlassCard style={{ marginBottom: 12, padding: 0 }}>
                    <Text
                      style={[
                        styles.sectionHeader,
                        { color: colors.foreground, padding: 14 },
                      ]}
                    >
                      Recent News
                    </Text>
                    {intel.recentNews.map((item, i) => (
                      <View
                        key={i}
                        style={[
                          styles.newsItem,
                          { borderTopColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.newsTitle,
                            { color: colors.foreground },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[
                            styles.newsSummary,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {item.summary}
                        </Text>
                      </View>
                    ))}
                  </GlassCard>
                ) : null}

                {intel.keyPeople?.length ? (
                  <GlassCard style={{ marginBottom: 12 }}>
                    <Text
                      style={[
                        styles.sectionHeader,
                        { color: colors.foreground, marginBottom: 8 },
                      ]}
                    >
                      Key People
                    </Text>
                    {intel.keyPeople.map((p, i) => (
                      <Text
                        key={i}
                        style={[styles.bulletItem, { color: colors.foreground }]}
                      >
                        • {p}
                      </Text>
                    ))}
                  </GlassCard>
                ) : null}

                {intel.products?.length ? (
                  <GlassCard style={{ marginBottom: 12 }}>
                    <Text
                      style={[
                        styles.sectionHeader,
                        { color: colors.foreground, marginBottom: 8 },
                      ]}
                    >
                      Products
                    </Text>
                    {intel.products.map((p, i) => (
                      <Text
                        key={i}
                        style={[styles.bulletItem, { color: colors.foreground }]}
                      >
                        • {p}
                      </Text>
                    ))}
                  </GlassCard>
                ) : null}

                {intel.competitors?.length ? (
                  <GlassCard style={{ marginBottom: 12 }}>
                    <Text
                      style={[
                        styles.sectionHeader,
                        { color: colors.foreground, marginBottom: 8 },
                      ]}
                    >
                      Competitors
                    </Text>
                    {intel.competitors.map((p, i) => (
                      <Text
                        key={i}
                        style={[styles.bulletItem, { color: colors.foreground }]}
                      >
                        • {p}
                      </Text>
                    ))}
                  </GlassCard>
                ) : null}

                <TouchableOpacity
                  onPress={() => {
                    setIntel(null);
                    fetchIntel();
                  }}
                  style={[
                    styles.refreshBtn,
                    { borderColor: colors.border, borderRadius: colors.radius },
                  ]}
                >
                  <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.refreshBtnText, { color: colors.mutedForeground }]}>
                    Refresh Intelligence
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroSection: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 4,
  },
  companyName: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  industry: { fontSize: 13 },
  domain: { fontSize: 13 },
  contactCount: { fontSize: 12 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 5,
  },
  tabText: { fontSize: 13, fontWeight: "500" as const },
  tabContent: { flex: 1 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: "500" as const },
  autoGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
  },
  autoGroupText: { fontSize: 13, fontWeight: "500" as const, flex: 1 },
  deptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  deptBar: { width: 3, height: 14, borderRadius: 2 },
  deptHeaderText: {
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    flex: 1,
  },
  deptCount: { fontSize: 12, fontWeight: "500" as const },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14 },
  orgHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  orgHintText: { fontSize: 12, flex: 1 },
  intelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderWidth: 1,
  },
  intelButtonText: { flex: 1, fontSize: 15, fontWeight: "500" as const },
  intelError: { fontSize: 13, marginBottom: 12 },
  intelSectionTitle: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  intelText: { fontSize: 14, lineHeight: 20 },
  intelRow: { flexDirection: "row", paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
  intelLabel: { width: 100, fontSize: 13 },
  intelValue: { flex: 1, fontSize: 13, fontWeight: "500" as const },
  sectionHeader: { fontSize: 15, fontWeight: "600" as const },
  newsItem: { padding: 14, borderTopWidth: 1 },
  newsTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 3 },
  newsSummary: { fontSize: 13, lineHeight: 18 },
  bulletItem: { fontSize: 14, lineHeight: 22 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    justifyContent: "center",
  },
  refreshBtnText: { fontSize: 13 },
});
