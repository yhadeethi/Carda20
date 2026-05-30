import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaptureSheet } from "@/components/CaptureSheet";
import colors from "@/constants/colors";

function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const [captureOpen, setCaptureOpen] = useState(false);

  const TAB_BAR_HEIGHT = 56 + insets.bottom;

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          tabBarStyle: {
            position: "absolute",
            height: TAB_BAR_HEIGHT,
            backgroundColor: isIOS ? "transparent" : colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 0,
          },
          tabBarItemStyle: {
            paddingBottom: insets.bottom > 0 ? 0 : 6,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
            ) : null,
        }}
      >
        {/* ── Home ────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={22} />
              ) : (
                <Feather name="home" size={21} color={color} />
              ),
          }}
        />

        {/* ── Network ─────────────────────────────────────────────── */}
        <Tabs.Screen
          name="network"
          options={{
            title: "Network",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="person.2" tintColor={color} size={22} />
              ) : (
                <Feather name="users" size={21} color={color} />
              ),
          }}
        />

        {/* ── Centre Capture FAB ────────────────────────────────── */}
        <Tabs.Screen
          name="capture"
          options={{
            title: "",
            tabBarButton: () => (
              <TouchableOpacity
                style={fabStyles.wrapper}
                onPress={() => {
                  setCaptureOpen(true);
                }}
                activeOpacity={0.85}
              >
                <View style={fabStyles.circle}>
                  <Feather name="plus" size={26} color="#fff" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />

        {/* ── Events ──────────────────────────────────────────────── */}
        <Tabs.Screen
          name="events"
          options={{
            title: "Events",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="calendar" tintColor={color} size={22} />
              ) : (
                <Feather name="calendar" size={21} color={color} />
              ),
          }}
        />

        {/* ── Profile ─────────────────────────────────────────────── */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="person" tintColor={color} size={22} />
              ) : (
                <Feather name="user" size={21} color={color} />
              ),
          }}
        />

        {/* ── Hidden tabs (still routable) ────────────────────────── */}
        <Tabs.Screen
          name="scan"
          options={{
            tabBarButton: () => null,
            headerShown: true,
            title: "Scan Card",
          }}
        />
        <Tabs.Screen
          name="companies"
          options={{
            tabBarButton: () => null,
            headerShown: true,
            title: "Companies",
          }}
        />
      </Tabs>

      {/* ── Capture bottom sheet ─────────────────────────────────── */}
      <CaptureSheet visible={captureOpen} onClose={() => setCaptureOpen(false)} />
    </>
  );
}

const fabStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 6,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginTop: -12,
  },
});

export default TabLayout;
