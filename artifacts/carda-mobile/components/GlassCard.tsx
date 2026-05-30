import React from "react";
import { View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: number;
}

export function GlassCard({ children, style, padding = 16 }: GlassCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
