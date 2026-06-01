import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaptureSheet } from "@/components/CaptureSheet";
import { useCapture } from "@/context/CaptureContext";
import { useColors } from "@/hooks/useColors";

function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const capture = useCapture();
  const colors = useColors();

  const TAB_BAR_HEIGHT = 56 + insets.bottom;

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.foreground + "66",
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          tabBarStyle: {
            position: "absolute",
            height: TAB_BAR_HEIGHT,
            backgroundColor: isIOS ? "transparent" : colors.card,
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarItemStyle: {
            paddingBottom: insets.bottom > 0 ? 0 : 6,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.1,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={80}
                tint="systemChromeMaterial"
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Scoreboard",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="house.fill" tintColor={color} size={22} />
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
                <SymbolView name="person.2.fill" tintColor={color} size={22} />
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
                <View style={fabCircle}>
                  <LinearGradient
                    colors={["#4B68F5", "#7B5CF0"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 27 }]}
                  />
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
                <SymbolView name="person.fill" tintColor={color} size={22} />
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
  width: 54,
  height: 54,
  borderRadius: 27,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  shadowColor: "#4B68F5",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
  marginTop: -12,
};

export default TabLayout;
