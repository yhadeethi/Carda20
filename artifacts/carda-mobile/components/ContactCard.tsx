import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "./Avatar";
import colors from "@/constants/colors";
import type { Contact } from "@/lib/api";

export type StripeStatus = "new" | "overdue" | "due-today" | "default";

const DEPT_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  EXEC: { bg: "#EDE9FE", text: "#5856D6" },
  SALES: { bg: "#FFE4E1", text: "#FF3B30" },
  OPS: { bg: "#DCFCE7", text: "#16A34A" },
  FINANCE: { bg: "#FEF3C7", text: "#D97706" },
  LEGAL: { bg: "#E0E7FF", text: "#6366F1" },
  PROJECT_DELIVERY: { bg: "#CCFBF1", text: "#0D9488" },
};

const DEPT_LABELS: Record<string, string> = {
  EXEC: "Exec",
  SALES: "Sales",
  OPS: "Ops",
  FINANCE: "Finance",
  LEGAL: "Legal",
  PROJECT_DELIVERY: "Delivery",
};

interface ContactCardProps {
  contact: Contact;
  onPress: () => void;
  stripeStatus?: StripeStatus;
  showDepartment?: boolean;
}

function deriveStripe(contact: Contact): StripeStatus {
  if (contact.createdAt) {
    const days = (Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 7) return "new";
  }
  return "default";
}

function stripeColor(status: StripeStatus): string {
  switch (status) {
    case "overdue": return colors.stripeOverdue;
    case "due-today": return colors.stripeDueToday;
    case "new": return colors.stripeNew;
    default: return colors.stripeDefault;
  }
}

export function ContactCard({ contact, onPress, stripeStatus, showDepartment }: ContactCardProps) {
  const displayName = contact.fullName || contact.email || "No name";
  const status = stripeStatus ?? deriveStripe(contact);
  const stripe = stripeColor(status);
  const dept = contact.orgDepartment?.toUpperCase();
  const deptChip = showDepartment && dept && dept !== "UNKNOWN" && DEPT_CHIP_COLORS[dept];
  const deptLabel = dept ? DEPT_LABELS[dept] : null;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.container}
    >
      <View style={[styles.stripe, { backgroundColor: stripe }]} />
      <View style={styles.inner}>
        <Avatar name={displayName} size={40} />
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{displayName}</Text>
            {deptChip && deptLabel ? (
              <View style={[styles.deptChip, { backgroundColor: deptChip.bg }]}>
                <Text style={[styles.deptChipText, { color: deptChip.text }]}>{deptLabel}</Text>
              </View>
            ) : null}
          </View>
          {(contact.jobTitle || contact.companyName) ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {[contact.jobTitle, contact.companyName].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          {contact.email && !contact.jobTitle && !contact.companyName ? (
            <Text style={styles.email} numberOfLines={1}>{contact.email}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  stripe: {
    width: 3,
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingLeft: 12,
    gap: 12,
  },
  content: { flex: 1 },
  name: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: colors.foreground,
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: colors.mutedForeground,
  },
  email: {
    fontSize: 12,
    color: colors.primary,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1,
  },
  deptChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  deptChipText: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
});
