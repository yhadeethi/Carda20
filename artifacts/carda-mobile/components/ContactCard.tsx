import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "./Avatar";
import { useColors } from "@/hooks/useColors";
import type { Contact } from "@/lib/api";

interface ContactCardProps {
  contact: Contact;
  onPress: () => void;
}

export function ContactCard({ contact, onPress }: ContactCardProps) {
  const colors = useColors();
  const displayName = contact.fullName || contact.email || "No name";

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
      <Avatar name={displayName} size={46} />
      <View style={styles.content}>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {(contact.jobTitle || contact.companyName) ? (
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {[contact.jobTitle, contact.companyName].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {contact.email ? (
          <Text
            style={[styles.email, { color: colors.primary }]}
            numberOfLines={1}
          >
            {contact.email}
          </Text>
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
  subtitle: {
    fontSize: 13,
    marginBottom: 1,
  },
  email: {
    fontSize: 12,
  },
});
