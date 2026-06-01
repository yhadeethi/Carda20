import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureSheet } from "@/components/CaptureSheet";
import { useCapture } from "@/context/CaptureContext";
import { useColors } from "@/hooks/useColors";

const BRAND_START = "#4B68F5";
const BRAND_END = "#7B5CF0";

function LiquidTabButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : undefined}
      onPress={onPress}
      activeOpacity={0.72}
      style={styles.tabButton}
    >
      <Feather
        name={icon}
        size={21}
        color={active ? BRAND_START : `${colors.foreground}73`}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: active ? BRAND_START : `${colors.foreground}73` },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LiquidTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const capture = useCapture();
  const colors = useColors();
  const activeRoute = state.routes[state.index]?.name;
  const activeIndex = activeRoute === "network" ? 1 : 0;

  // Keep detail/utility screens clean, same principle as the web shell hiding nav
  // when a focused experience is open.
  if (activeRoute === "scan") return null;

  const goTo = (routeName: "index" | "network") => {
    const event = navigation.emit({
      type: "tabPress",
      target: state.routes.find((r: any) => r.name === routeName)?.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) navigation.navigate(routeName);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.navWrap,
        { paddingBottom: Math.max(8, insets.bottom) },
      ]}
    >
      <View style={styles.leftPill}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint="systemChromeMaterial"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `${colors.card}E6` },
            ]}
          />
        )}
        <View
          pointerEvents="none"
          style={[
            styles.activeBubble,
            {
              backgroundColor: `${colors.background}CC`,
              transform: [{ translateX: activeIndex * 86 }],
            },
          ]}
        />
        <LiquidTabButton
          active={activeRoute === "index"}
          label="Scoreboard"
          icon="home"
          onPress={() => goTo("index")}
        />
        <LiquidTabButton
          active={activeRoute === "network"}
          label="Network"
          icon="users"
          onPress={() => goTo("network")}
        />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Capture"
        onPress={() => {
          if (capture.isOpen) capture.closeCapture();
          else capture.openCapture("menu");
        }}
        activeOpacity={0.75}
        style={styles.fab}
      >
        <LinearGradient
          colors={[BRAND_START, BRAND_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Feather name={capture.isOpen ? "x" : "plus"} size={25} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function TabLayout() {
  const capture = useCapture();
  const colors = useColors();

  return (
    <>
      <Tabs
        tabBar={(props) => <LiquidTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Scoreboard" }} />
        <Tabs.Screen name="network" options={{ title: "Network" }} />

        {/* Utility routes stay addressable but are not visible in the main nav. */}
        <Tabs.Screen name="capture" options={{ href: null }} />
        <Tabs.Screen name="events" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="scan" options={{ href: null, title: "Scan Card" }} />
      </Tabs>

      <CaptureSheet
        visible={capture.isOpen}
        onClose={capture.closeCapture}
        initialMode={capture.initialMode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    pointerEvents: "box-none",
  },
  leftPill: {
    height: 50,
    width: 180,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  activeBubble: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 86,
    height: 42,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    zIndex: 1,
    width: 86,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.05,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_START,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 10,
  },
});

export default TabLayout;
