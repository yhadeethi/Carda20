import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "./Avatar";
import { useColors } from "@/hooks/useColors";
import type { Company } from "@/lib/api";

interface CompanyCardProps {
  company: Company;
  contactCount?: number;
  onPress: () => void;
}

export function CompanyCard({ company, contactCount, onPress }: CompanyCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
    >
      <Avatar name={company.name} size={42} square />
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {company.name}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {contactCount !== undefined
            ? `${contactCount} ${contactCount === 1 ? "contact" : "contacts"}`
            : ""}
          {company.domain
            ? contactCount !== undefined
              ? ` · ${company.domain}`
              : company.domain
            : ""}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  content: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700" as const, marginBottom: 2 },
  meta: { fontSize: 12, fontWeight: "500" as const },
});
