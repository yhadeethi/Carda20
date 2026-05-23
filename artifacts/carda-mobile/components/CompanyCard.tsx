import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Company } from "@/lib/api";

interface CompanyCardProps {
  company: Company;
  contactCount?: number;
  onPress: () => void;
}

export function CompanyCard({
  company,
  contactCount,
  onPress,
}: CompanyCardProps) {
  const colors = useColors();
  const initial = (company.name?.[0] ?? "?").toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <LinearGradient
        colors={[colors.gradientStart + "33", colors.gradientEnd + "33"]}
        style={[styles.iconContainer, { borderRadius: colors.radius - 4 }]}
      >
        <Text style={[styles.initial, { color: colors.primary }]}>{initial}</Text>
      </LinearGradient>
      <View style={styles.content}>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {company.name}
        </Text>
        {company.industry ? (
          <Text
            style={[styles.industry, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {company.industry}
          </Text>
        ) : null}
        {contactCount !== undefined && contactCount > 0 ? (
          <View style={styles.badge}>
            <Feather name="users" size={11} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {contactCount} contact{contactCount !== 1 ? "s" : ""}
            </Text>
          </View>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  industry: {
    fontSize: 13,
    marginBottom: 3,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
});
