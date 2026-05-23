import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CompanyCard } from "@/components/CompanyCard";
import { SearchBar } from "@/components/SearchBar";
import { api, Company, Contact } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function CompaniesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const companiesQ = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: api.getCompanies,
  });

  const contactsQ = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
  });

  const contactCountByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contactsQ.data ?? []) {
      if (c.companyName) map[c.companyName] = (map[c.companyName] ?? 0) + 1;
    }
    return map;
  }, [contactsQ.data]);

  const filtered = useMemo(() => {
    const list = companiesQ.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q)
    );
  }, [companiesQ.data, search]);

  const isLoading = companiesQ.isLoading;
  const error = companiesQ.error;

  const paddingBottom = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 : 8 },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Companies
        </Text>
        {companiesQ.data ? (
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {companiesQ.data.length}
          </Text>
        ) : null}
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search companies…"
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Failed to load companies
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              contactCount={contactCountByCompany[item.name]}
              onPress={() => router.push(`/company/${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom }}
          refreshControl={
            <RefreshControl
              refreshing={companiesQ.isRefetching}
              onRefresh={() => companiesQ.refetch()}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!filtered.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="briefcase" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matching companies" : "No companies yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Companies appear when you add contacts with a company name
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  count: { fontSize: 18, fontWeight: "500" as const, marginTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14 },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
