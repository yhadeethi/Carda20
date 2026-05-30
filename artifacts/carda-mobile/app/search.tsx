import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { api, Company, Contact, UserEvent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type ResultSection =
  | { title: "People"; data: Contact[]; kind: "people" }
  | { title: "Companies"; data: Company[]; kind: "companies" }
  | { title: "Events"; data: UserEvent[]; kind: "events" };

const MAX_PER_SECTION = 6;

function highlightMatch(text: string, query: string): { pre: string; match: string; post: string } | null {
  if (!query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  return {
    pre: text.slice(0, idx),
    match: text.slice(idx, idx + query.length),
    post: text.slice(idx + query.length),
  };
}

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
    staleTime: 60_000,
  });

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: api.getCompanies,
    staleTime: 60_000,
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery<UserEvent[]>({
    queryKey: ["events"],
    queryFn: api.getUserEvents,
    staleTime: 60_000,
  });

  const isLoading = loadingContacts || loadingCompanies || loadingEvents;

  const sections = useMemo<ResultSection[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matchedContacts = contacts
      .filter((c) =>
        [c.fullName, c.companyName, c.jobTitle, c.email, c.phone]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q))
      )
      .slice(0, MAX_PER_SECTION);

    const matchedCompanies = companies
      .filter(
        (co) =>
          co.name.toLowerCase().includes(q) ||
          (co.domain ?? "").toLowerCase().includes(q) ||
          (co.industry ?? "").toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_SECTION);

    const matchedEvents = events
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.locationLabel ?? "").toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_SECTION);

    const result: ResultSection[] = [];
    if (matchedContacts.length)
      result.push({ title: "People", data: matchedContacts, kind: "people" });
    if (matchedCompanies.length)
      result.push({ title: "Companies", data: matchedCompanies, kind: "companies" });
    if (matchedEvents.length)
      result.push({ title: "Events", data: matchedEvents, kind: "events" });
    return result;
  }, [query, contacts, companies, events]);

  const totalResults = sections.reduce((s, sec) => s + sec.data.length, 0);
  const hasQuery = query.trim().length >= 1;

  const renderSectionHeader = ({ section }: { section: ResultSection }) => (
    <View
      style={[
        styles.sectionHeader,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
        {section.data.length}
        {section.data.length === MAX_PER_SECTION ? "+" : ""}
      </Text>
    </View>
  );

  const renderItem = ({ item, section }: { item: any; section: ResultSection }) => {
    const q = query.trim();

    if (section.kind === "people") {
      const c = item as Contact;
      const name = c.fullName || c.email || "Unknown";
      const hl = highlightMatch(name, q);
      return (
        <TouchableOpacity
          style={[styles.resultRow, { borderBottomColor: colors.border }]}
          onPress={() => router.push(`/contact/${c.id}` as any)}
          activeOpacity={0.75}
        >
          <Avatar name={name} size={38} />
          <View style={styles.resultInfo}>
            <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
              {hl ? (
                <>
                  <Text>{hl.pre}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>{hl.match}</Text>
                  <Text>{hl.post}</Text>
                </>
              ) : (
                name
              )}
            </Text>
            {(c.jobTitle || c.companyName) ? (
              <Text style={[styles.resultMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {[c.jobTitle, c.companyName].filter(Boolean).join(" · ")}
              </Text>
            ) : c.email ? (
              <Text style={[styles.resultMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {c.email}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={colors.border} />
        </TouchableOpacity>
      );
    }

    if (section.kind === "companies") {
      const co = item as Company;
      const hl = highlightMatch(co.name, q);
      return (
        <TouchableOpacity
          style={[styles.resultRow, { borderBottomColor: colors.border }]}
          onPress={() => router.push(`/company/${co.id}` as any)}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.companyIcon,
              { backgroundColor: colors.primary + "18" },
            ]}
          >
            <Text style={[styles.companyIconText, { color: colors.primary }]}>
              {co.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.resultInfo}>
            <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
              {hl ? (
                <>
                  <Text>{hl.pre}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>{hl.match}</Text>
                  <Text>{hl.post}</Text>
                </>
              ) : (
                co.name
              )}
            </Text>
            {(co.industry || co.domain) ? (
              <Text style={[styles.resultMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {[co.industry, co.domain].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={colors.border} />
        </TouchableOpacity>
      );
    }

    if (section.kind === "events") {
      const e = item as UserEvent;
      const hl = highlightMatch(e.title, q);
      return (
        <TouchableOpacity
          style={[styles.resultRow, { borderBottomColor: colors.border }]}
          onPress={() => router.push(`/event/${e.id}` as any)}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.eventIcon,
              { backgroundColor: "#EEF2FF" },
            ]}
          >
            <Feather name="calendar" size={18} color="#6366F1" />
          </View>
          <View style={styles.resultInfo}>
            <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
              {hl ? (
                <>
                  <Text>{hl.pre}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>{hl.match}</Text>
                  <Text>{hl.post}</Text>
                </>
              ) : (
                e.title
              )}
            </Text>
            {e.locationLabel ? (
              <Text style={[styles.resultMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {e.locationLabel}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={colors.border} />
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Search",
          headerShown: false,
        }}
      />
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Custom search header */}
        <View
          style={[
            styles.searchHeader,
            { backgroundColor: colors.background, borderBottomColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather
              name="search"
              size={16}
              color={colors.mutedForeground}
              style={{ opacity: 0.6 }}
            />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.foreground }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search contacts, companies, events…"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
              returnKeyType="search"
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { color: colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {isLoading && !hasQuery ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !hasQuery ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={44} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Search everything
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Find contacts, companies, and events in one place
            </Text>
            <View style={styles.hintRow}>
              {[
                { icon: "users", label: `${contacts.length} people` },
                { icon: "briefcase", label: `${companies.length} companies` },
                { icon: "calendar", label: `${events.length} events` },
              ].map((h) => (
                <View
                  key={h.label}
                  style={[
                    styles.hintChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Feather
                    name={h.icon as any}
                    size={13}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[styles.hintChipText, { color: colors.mutedForeground }]}
                  >
                    {h.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={44} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No results for "{query}"
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Try a different search term
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections as any}
            keyExtractor={(item: any, i) => String(item.id ?? i)}
            renderItem={renderItem as any}
            renderSectionHeader={renderSectionHeader as any}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            ListHeaderComponent={
              totalResults > 0 ? (
                <View
                  style={[
                    styles.resultsBar,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Text
                    style={[styles.resultsCount, { color: colors.mutedForeground }]}
                  >
                    {totalResults} result{totalResults !== 1 ? "s" : ""}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  cancelBtn: { paddingLeft: 4 },
  cancelText: { fontSize: 15, fontWeight: "600" as const },

  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  emptyState: {
    alignItems: "center",
    paddingTop: 72,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center",
    marginTop: 4,
  },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  hintRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  hintChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  hintChipText: { fontSize: 12, fontWeight: "500" as const },

  resultsBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resultsCount: { fontSize: 12 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
  },
  sectionCount: { fontSize: 12 },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: "500" as const },
  resultMeta: { fontSize: 13, marginTop: 1 },

  companyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  companyIconText: { fontSize: 18, fontWeight: "700" as const },

  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
