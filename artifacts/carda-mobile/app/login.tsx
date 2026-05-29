import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const DEV_CODE_LENGTH = 4;

export default function LoginScreen() {
  const { checkAuth } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const handleDigit = async (d: string) => {
    if (loading) return;
    const next = [...digits, d];
    setDigits(next);
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (next.length === DEV_CODE_LENGTH) {
      const code = next.join("");
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/dev-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include",
        });
        if (res.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await checkAuth();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError("Wrong code — try again");
          setDigits([]);
        }
      } catch {
        setError("Connection error — try again");
        setDigits([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setDigits((prev) => prev.slice(0, -1));
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
          },
        ]}
      >
        <View style={styles.logoSection}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.logoContainer, { borderRadius: colors.radius * 2 }]}
          >
            <Feather name="credit-card" size={36} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.appName, { color: colors.foreground }]}>Carda</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Enter your access code
          </Text>
        </View>

        <View style={styles.dotsRow}>
          {Array.from({ length: DEV_CODE_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i < digits.length ? colors.primary : "transparent",
                  borderColor:
                    i < digits.length ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : (
          <View style={styles.errorPlaceholder} />
        )}

        {loading ? (
          <View style={styles.keypadPlaceholder}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={styles.keypad}>
            {keys.map((key, i) => {
              if (key === "") return <View key={i} style={styles.keyEmpty} />;
              const isDelete = key === "⌫";
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => (isDelete ? handleDelete() : handleDigit(key))}
                  activeOpacity={0.7}
                  style={[
                    styles.key,
                    {
                      backgroundColor: isDelete
                        ? "transparent"
                        : colors.secondary,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.keyText,
                      {
                        color: isDelete ? colors.mutedForeground : colors.foreground,
                        fontSize: isDelete ? 22 : 26,
                      },
                    ]}
                  >
                    {key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoSection: { alignItems: "center", paddingTop: 32, gap: 10 },
  logoContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { fontSize: 36, fontWeight: "700" as const, letterSpacing: -0.5 },
  tagline: { fontSize: 15, textAlign: "center" },
  dotsRow: { flexDirection: "row", gap: 18, marginTop: 8 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  error: { fontSize: 14, textAlign: "center", marginTop: 4 },
  errorPlaceholder: { height: 20 },
  keypadPlaceholder: {
    height: 300,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  keypad: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    paddingBottom: 8,
  },
  key: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  keyEmpty: { width: 80, height: 80 },
  keyText: { fontWeight: "400" as const },
});
