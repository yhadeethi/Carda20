import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaptureSheet } from "@/components/CaptureSheet";
import { useCapture } from "@/context/CaptureContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const capture = useCapture();
  const colors = useColors();
  const { resolvedTheme } = useTheme();

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
              <BlurView
                intensity={90}
                tint={resolvedTheme === "dark" ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Scoreboard",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={22} />
              ) : (
                <Feather name="home" size={21} color={color} />
              ),
          }}
        />

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

        <Tabs.Screen
          name="capture"
          options={{
            title: "",
            tabBarButton: () => (
              <TouchableOpacity
                style={fabWrapper}
                onPress={() => {
                  if (capture.isOpen) {
                    capture.closeCapture();
                  } else {
                    capture.openCapture("menu");
                  }
                }}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    fabCircle,
                    {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                    },
                  ]}
                >
                  {capture.isOpen ? (
                    <Feather name="x" size={26} color="#fff" />
                  ) : (
                    <Feather name="plus" size={26} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            ),
          }}
        />

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

      <CaptureSheet
        visible={capture.isOpen}
        onClose={capture.closeCapture}
        initialMode={capture.initialMode}
      />
    </>
  );
}

const fabWrapper: object = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingBottom: 6,
};

const fabCircle: object = {
  width: 52,
  height: 52,
  borderRadius: 26,
  alignItems: "center",
  justifyContent: "center",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 6,
  marginTop: -12,
};

export default TabLayout;
