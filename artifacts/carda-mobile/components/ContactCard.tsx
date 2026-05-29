import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "./Avatar";
import colors from "@/constants/colors";
import type { Contact } from "@/lib/api";

export type StripeStatus = "new" | "overdue" | "due-today" | "default";

interface ContactCardProps {
  contact: Contact;
  onPress: () => void;
  stripeStatus?: StripeStatus;
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

export function ContactCard({ contact, onPress, stripeStatus }: ContactCardProps) {
  const displayName = contact.fullName || contact.email || "No name";
  const status = stripeStatus ?? deriveStripe(contact);
  const stripe = stripeColor(status);

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
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
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
});
