import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "./Avatar";
import { useColors } from "@/hooks/useColors";
import type { Contact } from "@/lib/api";

export type StripeStatus = "new" | "overdue" | "due-today" | "default";

interface ContactCardProps {
  contact: Contact;
  onPress: () => void;
  stripeStatus?: StripeStatus;
  showDepartment?: boolean;
  isLast?: boolean;
}

export function ContactCard({ contact, onPress, isLast = false }: ContactCardProps) {
  const colors = useColors();

  const displayName =
    contact.fullName ||
    ([contact.firstName, contact.lastName].filter(Boolean).join(" ")) ||
    contact.email ||
    "No name";

  const subtitle = [contact.jobTitle, contact.companyName].filter(Boolean).join(" · ");

  return (
    <TouchableOpacity
      activeOpacity={0.68}
      onPress={onPress}
      style={styles.row}
    >
      <Avatar name={displayName} size="md" />
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {displayName}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : contact.email && !contact.jobTitle && !contact.companyName ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {contact.email}
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground + "70"} />
      {!isLast && (
        <View
          style={[
            styles.separator,
            { backgroundColor: colors.separator },
          ]}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 60,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 13,
  },
  separator: {
    position: "absolute",
    bottom: 0,
    left: 68,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
