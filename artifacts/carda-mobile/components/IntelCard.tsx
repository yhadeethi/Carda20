import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassCard } from "@/components/GlassCard";
import { api, IntelResult } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface IntelCardProps {
  companyId: number;
  companyName: string;
  domain?: string;
}

export function IntelCard({ companyName, domain }: IntelCardProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<IntelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntel = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getIntel(companyName, domain);
      setIntel(result);
    } catch {
      setError("Could not load company intelligence. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!intel) {
    return (
      <View style={styles.wrapper}>
        <GlassCard style={styles.idleCard}>
          <View style={styles.idleIcon}>
            <Feather name="zap" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.idleTitle, { color: colors.foreground }]}>
            AI Company Intelligence
          </Text>
          <Text style={[styles.idleSubtitle, { color: colors.mutedForeground }]}>
            Get an AI-generated brief including overview, recent news, key people, and more.
          </Text>

          {error ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={fetchIntel}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#4B68F5", "#7B5CF0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fetchBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={14} color="#fff" />
                  <Text style={styles.fetchBtnText}>Get AI Company Intelligence</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {intel.description ? (
        <GlassCard style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
          <Text style={[styles.descText, { color: colors.foreground }]}>{intel.description}</Text>
          {[
            { label: "Industry", value: intel.industry },
            { label: "Founded", value: intel.founded },
            { label: "Size", value: intel.size },
            { label: "Headquarters", value: intel.headquarters },
            { label: "Funding", value: intel.funding },
          ]
            .filter((i) => i.value)
            .map((item) => (
              <View key={item.label} style={[styles.metaRow, { borderTopColor: colors.separator }]}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.value}</Text>
              </View>
            ))}
        </GlassCard>
      ) : null}

      {intel.recentNews?.length ? (
        <GlassCard style={[styles.card, { padding: 0 }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, padding: 14, paddingBottom: 0 }]}>
            RECENT NEWS
          </Text>
          {intel.recentNews.map((item, i) => (
            <View key={i} style={[styles.newsItem, { borderTopColor: i === 0 ? "transparent" : colors.separator }]}>
              <Text style={[styles.newsTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.newsSummary, { color: colors.mutedForeground }]}>{item.summary}</Text>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {intel.keyPeople?.length ? (
        <GlassCard style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>KEY PEOPLE</Text>
          {intel.keyPeople.map((p, i) => (
            <Text key={i} style={[styles.bulletItem, { color: colors.foreground }]}>• {p}</Text>
          ))}
        </GlassCard>
      ) : null}

      {intel.products?.length ? (
        <GlassCard style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRODUCTS</Text>
          {intel.products.map((p, i) => (
            <Text key={i} style={[styles.bulletItem, { color: colors.foreground }]}>• {p}</Text>
          ))}
        </GlassCard>
      ) : null}

      {intel.competitors?.length ? (
        <GlassCard style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>COMPETITORS</Text>
          {intel.competitors.map((p, i) => (
            <Text key={i} style={[styles.bulletItem, { color: colors.foreground }]}>• {p}</Text>
          ))}
        </GlassCard>
      ) : null}

      <TouchableOpacity
        onPress={() => { setIntel(null); fetchIntel(); }}
        style={[styles.refreshBtn, { borderColor: colors.border }]}
      >
        <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
        <Text style={[styles.refreshText, { color: colors.mutedForeground }]}>Refresh Intelligence</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  idleCard: { alignItems: "center", gap: 10, paddingVertical: 24 },
  idleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#4B68F514",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  idleTitle: { fontSize: 16, fontWeight: "700" as const, textAlign: "center" as const },
  idleSubtitle: { fontSize: 13, textAlign: "center" as const, lineHeight: 18, paddingHorizontal: 8 },
  errorText: { fontSize: 13, textAlign: "center" as const },
  fetchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  fetchBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
  card: { marginBottom: 10, gap: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  descText: { fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: "row", paddingTop: 10, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  metaLabel: { width: 100, fontSize: 13 },
  metaValue: { flex: 1, fontSize: 13, fontWeight: "500" as const },
  newsItem: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  newsTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 3 },
  newsSummary: { fontSize: 13, lineHeight: 18 },
  bulletItem: { fontSize: 14, lineHeight: 22 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 2,
  },
  refreshText: { fontSize: 13 },
});
