import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: number;
  onPress?: () => void;
  radius?: number;
  noBorder?: boolean;
  testID?: string;
  blurIntensity?: number;
}

export function GlassCard({
  children,
  style,
  padding = 16,
  onPress,
  radius,
  noBorder = false,
  testID,
  blurIntensity = 60,
}: GlassCardProps) {
  const colors = useColors();
  const borderRadius = radius ?? colors.radiusLg;

  const cardStyle: ViewStyle[] = [
    {
      borderRadius,
      borderWidth: noBorder ? 0 : StyleSheet.hairlineWidth * 2,
      borderColor: noBorder ? "transparent" : "rgba(255,255,255,0.60)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
      elevation: 3,
      overflow: "hidden",
    },
    ...(Array.isArray(style) ? style : style ? [style] : []),
  ];

  const innerStyle: ViewStyle = {
    padding,
  };

  const content =
    Platform.OS === "ios" ? (
      <BlurView intensity={blurIntensity} tint="light" style={StyleSheet.absoluteFill} />
    ) : null;

  const body = (
    <View style={cardStyle} testID={testID}>
      {content}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.52)" : colors.card },
        ]}
      />
      <View style={[innerStyle, { position: "relative" }]}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.82} onPress={onPress} testID={testID ? `${testID}-touch` : undefined}>
        {body}
      </TouchableOpacity>
    );
  }

  return body;
}
