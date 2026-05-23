import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ContactCard } from "@/components/ContactCard";
import { GlassCard } from "@/components/GlassCard";
import { api, Company, Contact, IntelResult } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intel, setIntel] = useState<IntelResult | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: api.getCompanies,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: api.getContacts,
  });

  const company = companies?.find((c) => String(c.id) === id);
  const companyContacts = (contacts ?? []).filter(
    (c) => c.companyId === company?.id || c.companyName === company?.name
  );

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

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (!company) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: company.name }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom }}
      >
        <View
          style={[
            styles.heroSection,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <LinearGradient
            colors={[colors.gradientStart + "33", colors.gradientEnd + "33"]}
            style={[styles.companyIcon, { borderRadius: colors.radius }]}
          >
            <Text style={[styles.companyInitial, { color: colors.primary }]}>
              {(company.name[0] ?? "?").toUpperCase()}
            </Text>
          </LinearGradient>
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
            <Text style={[styles.intelButtonText, { color: colors.primary }]}>
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
                  <Text style={[styles.intelSectionTitle, { color: colors.mutedForeground }]}>
                    About
                  </Text>
                  <Text style={[styles.intelText, { color: colors.foreground }]}>
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
                  <View key={item.label} style={[styles.intelRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.intelLabel, { color: colors.mutedForeground }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.intelValue, { color: colors.foreground }]}>
                      {item.value}
                    </Text>
                  </View>
                ))}
            </GlassCard>

            {intel.recentNews?.length ? (
              <GlassCard style={{ marginBottom: 12, padding: 0 }}>
                <Text style={[styles.sectionHeader, { color: colors.foreground, padding: 14 }]}>
                  Recent News
                </Text>
                {intel.recentNews.map((item, i) => (
                  <View
                    key={i}
                    style={[styles.newsItem, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.newsTitle, { color: colors.foreground }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.newsSummary, { color: colors.mutedForeground }]}>
                      {item.summary}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            ) : null}

            {intel.keyPeople?.length ? (
              <GlassCard style={{ marginBottom: 12 }}>
                <Text style={[styles.sectionHeader, { color: colors.foreground, marginBottom: 8 }]}>
                  Key People
                </Text>
                {intel.keyPeople.map((p, i) => (
                  <Text key={i} style={[styles.bulletItem, { color: colors.foreground }]}>
                    • {p}
                  </Text>
                ))}
              </GlassCard>
            ) : null}
          </View>
        ) : null}

        {companyContacts.length > 0 ? (
          <>
            <Text
              style={[
                styles.contactsHeader,
                { color: colors.mutedForeground, marginLeft: 20 },
              ]}
            >
              Contacts ({companyContacts.length})
            </Text>
            {companyContacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onPress={() => router.push(`/contact/${c.id}`)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    gap: 6,
  },
  companyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  companyInitial: { fontSize: 32, fontWeight: "700" as const },
  companyName: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  industry: { fontSize: 14 },
  domain: { fontSize: 14 },
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
    textTransform: "uppercase",
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
  contactsHeader: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
});
