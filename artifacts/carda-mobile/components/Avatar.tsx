import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const SIZE_MAP = { xs: 24, sm: 32, md: 40, lg: 52, xl: 68 } as const;
type SizeName = keyof typeof SIZE_MAP;

interface AvatarProps {
  name?: string;
  size?: number | SizeName;
  square?: boolean;
  imageUrl?: string;
}

export function getInitials(name?: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "?").toUpperCase();
}

export function Avatar({ name, size = "md", square = false, imageUrl }: AvatarProps) {
  const resolvedSize = typeof size === "string" ? SIZE_MAP[size] : size;
  const fontSize = Math.round(resolvedSize * 0.38);
  const borderRadius = square ? Math.round(resolvedSize * 0.28) : resolvedSize / 2;
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      <View style={{ width: resolvedSize, height: resolvedSize, borderRadius, overflow: "hidden" }}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: resolvedSize, height: resolvedSize }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={{ width: resolvedSize, height: resolvedSize, borderRadius, overflow: "hidden" }}>
      <LinearGradient
        colors={["#4B68F5", "#7B5CF0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, styles.center]}
      >
        <Text style={[styles.initials, { fontSize, lineHeight: resolvedSize }]}>{initials}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  initials: {
    color: "#FFFFFF",
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
