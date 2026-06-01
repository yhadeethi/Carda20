import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "./Avatar";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import type { Contact } from "@/lib/api";

export type StripeStatus = "new" | "overdue" | "due-today" | "default";

interface ContactCardProps {
  contact: Contact;
  onPress: () => void;
  stripeStatus?: StripeStatus;
  showDepartment?: boolean;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function resolveStripe(contact: Contact, stripeStatus?: StripeStatus): StripeStatus {
  if (stripeStatus) return stripeStatus;
  if (contact.createdAt && Date.now() - new Date(contact.createdAt).getTime() < SEVEN_DAYS) {
    return "new";
  }
  return "default";
}

export function ContactCard({ contact, onPress, stripeStatus }: ContactCardProps) {
  const colors = useColors();

  const displayName =
    contact.fullName ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    contact.email ||
    "No name";

  const resolved = resolveStripe(contact, stripeStatus);
  const isNew = resolved === "new";

  const stripeColor = {
    new: colors.stripeNew,
    overdue: colors.stripeOverdue,
    "due-today": colors.stripeDueToday,
    default: colors.stripeDefault,
  }[resolved];

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: "rgba(0,0,0,0.07)" }]}
    >
      {/* Status stripe */}
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      {/* Main row */}
      <View style={styles.inner}>
        <Avatar name={displayName} size="md" />

        <View style={styles.content}>
          {/* Name + New badge */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isNew && (
              <View style={[styles.newBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "30" }]}>
                <Text style={[styles.newBadgeText, { color: colors.primary }]}>New</Text>
              </View>
            )}
          </View>

          {/* Job title */}
          {contact.jobTitle ? (
            <Text style={[styles.jobTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {contact.jobTitle}
            </Text>
          ) : null}

          {/* Company row */}
          {contact.companyName ? (
            <View style={styles.companyRow}>
              <Feather name="briefcase" size={10} color={colors.mutedForeground} style={{ opacity: 0.7 }} />
              <Text style={[styles.companyName, { color: colors.mutedForeground }]} numberOfLines={1}>
                {contact.companyName}
              </Text>
            </View>
          ) : contact.email && !contact.jobTitle ? (
            <Text style={[styles.jobTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {contact.email}
            </Text>
          ) : null}
        </View>

        <Feather name="chevron-right" size={16} color={colors.mutedForeground + "60"} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stripe: {
    width: 3,
    alignSelf: "stretch",
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: Fonts.bold,
    letterSpacing: 0.2,
  },
  jobTitle: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  companyName: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    flex: 1,
  },
});
