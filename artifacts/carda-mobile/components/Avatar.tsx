import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface AvatarProps {
  name?: string;
  size?: number;
  square?: boolean;
}

export function getInitials(name?: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return (words[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export function Avatar({ name, size = 44, square = false }: AvatarProps) {
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.36);
  const borderRadius = square ? Math.round(size * 0.28) : size / 2;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#3A3A3F",
    fontWeight: "800" as const,
    letterSpacing: 0.3,
  },
});
