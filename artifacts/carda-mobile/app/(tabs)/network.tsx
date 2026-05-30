import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
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
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type SegTab = "people" | "companies";

export default function NetworkScreen() {
  const colors = useColors();
  const router = useRouter();

  const [tab, setTab] = useState<SegTab>("people");
  const [query, setQuery] = useState("");

  const {
    data: contacts = [],
    isLoading: loadingContacts,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
  });

  const {
    data: companies = [],
    isLoading: loadingCompanies,
    refetch: refetchCompanies,
  } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: () => api.getCompanies(),
  });

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter((c) =>
      [c.fullName, c.companyName, c.jobTitle, c.email]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    );
  }, [contacts, query]);

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

  const peopleLabel = contacts.length > 0 ? `People · ${contacts.length}` : "People";
  const companiesLabel = companies.length > 0 ? `Companies · ${companies.length}` : "Companies";

  return (
    <SafeAreaView style={s.bg} edges={["top"]}>
      {/* ── Fixed header ─────────────────────────────────────── */}
      <View style={s.header}>
        {/* Segment control */}
        <View style={s.segWrap}>
          <TouchableOpacity
            style={[s.segBtn, tab === "people" && s.segBtnActive]}
            onPress={() => setTab("people")}
            activeOpacity={0.75}
          >
            <Text style={[s.segText, tab === "people" && s.segTextActive]}>
              {peopleLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segBtn, tab === "companies" && s.segBtnActive]}
            onPress={() => setTab("companies")}
            activeOpacity={0.75}
          >
            <Text style={[s.segText, tab === "companies" && s.segTextActive]}>
              {companiesLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Feather name="search" size={15} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder={tab === "people" ? "Search people…" : "Search companies…"}
            placeholderTextColor={colors.mutedForeground}
            clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && Platform.OS !== "ios" && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
              <Text style={s.emptyTitle}>{query ? "No results" : "No contacts yet"}</Text>
              <Text style={s.emptyBody}>
                {query ? "Try a different search term" : "Scan your first card to get started"}
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
              <Text style={s.emptyTitle}>{query ? "No results" : "No companies yet"}</Text>
              <Text style={s.emptyBody}>
                {query
                  ? "Try a different search term"
                  : "Companies appear automatically when contacts have a company name"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.background },

    header: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 4,
      backgroundColor: colors.background,
    },

    segWrap: {
      flexDirection: "row",
      backgroundColor: "rgba(0,0,0,0.05)",
      borderRadius: 10,
      padding: 3,
      marginBottom: 10,
    },
    segBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 7,
      borderRadius: 8,
    },
    segBtnActive: {
      backgroundColor: colors.card,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 3,
      elevation: 2,
    },
    segText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    segTextActive: { color: colors.foreground },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    searchInput: { flex: 1, fontSize: 14, padding: 0, margin: 0 },

    listContent: { paddingHorizontal: 16, paddingBottom: 130, paddingTop: 4 },
    listContentCompanies: { paddingBottom: 130, paddingTop: 4 },
    itemWrap: { marginBottom: 8 },

    empty: { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    emptyBody: { fontSize: 14, color: colors.mutedForeground, textAlign: "center" },
  });
}
