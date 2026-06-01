import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import type { Company } from "@/lib/api";

interface CompanyCardProps {
  company: Company;
  contactCount?: number;
  onPress: () => void;
}

export function CompanyCard({ company, contactCount, onPress }: CompanyCardProps) {
  const colors = useColors();
  const initial = (company.name?.[0] ?? "?").toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      {/* Gradient initial square */}
      <View style={styles.iconWrap}>
        <LinearGradient
          colors={colors.BRAND_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.center]}
        />
        <Text style={styles.initial}>{initial}</Text>
      </View>

      {/* Name + domain */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {company.name}
        </Text>
        {company.domain ? (
          <Text style={[styles.domain, { color: colors.mutedForeground }]} numberOfLines={1}>
            {company.domain}
          </Text>
        ) : null}
      </View>

      {/* Count pill + chevron */}
      <View style={styles.right}>
        {contactCount !== undefined && contactCount > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.primary + "14" }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>
              {contactCount} {contactCount === 1 ? "contact" : "contacts"}
            </Text>
          </View>
        ) : null}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground + "70"} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", justifyContent: "center" },
  initial: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.bold,
    lineHeight: 44,
    textAlign: "center",
  },
  content: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: "600", fontFamily: Fonts.semiBold, marginBottom: 2 },
  domain: { fontSize: 12, fontFamily: Fonts.regular },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: { fontSize: 11, fontWeight: "600", fontFamily: Fonts.semiBold },
  chevron: { marginLeft: 4 },
});
