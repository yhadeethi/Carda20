import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ContactCard } from "@/components/ContactCard";
import { SearchBar } from "@/components/SearchBar";
import { api, Contact } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function ContactsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, isRefetching, error } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        [c.firstName, c.lastName, c.email, c.company, c.title]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleRefresh = () => qc.invalidateQueries({ queryKey: ["contacts"] });

  const paddingBottom =
    Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Contacts
        </Text>
        {data ? (
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {data.length}
          </Text>
        ) : null}
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search contacts…"
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Failed to load contacts
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              onPress={() => router.push(`/contact/${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!filtered.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matching contacts" : "No contacts yet"}
              </Text>
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                {search
                  ? "Try a different search"
                  : "Scan a business card to get started"}
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
    borderBottomWidth: 0,
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  count: {
    fontSize: 18,
    fontWeight: "500" as const,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
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
