import { LinearGradient } from "expo-linear-gradient";
import React from "react";
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

export default function LoginScreen() {
  const { login, loading, checkAuth } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = React.useState(false);

  const handleCheckAuth = async () => {
    setChecking(true);
    await checkAuth();
    setChecking(false);
  };

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
          <Text style={[styles.appName, { color: colors.foreground }]}>
            Carda
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Business card intelligence
          </Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: "camera" as const, text: "Scan business cards instantly" },
            { icon: "cpu" as const, text: "AI contact extraction" },
            { icon: "zap" as const, text: "HubSpot & Salesforce sync" },
          ].map((item) => (
            <View key={item.icon} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  {
                    backgroundColor: colors.primary + "1A",
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather name={item.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.foreground }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={login}
            activeOpacity={0.85}
            style={styles.loginButton}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.loginGradient, { borderRadius: colors.radius }]}
            >
              <Text style={styles.loginText}>Sign in with Replit</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCheckAuth}
            activeOpacity={0.7}
            style={styles.recheckButton}
            disabled={checking || loading}
          >
            {checking || loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[styles.recheckText, { color: colors.mutedForeground }]}
              >
                Already signed in? Tap to continue
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Your contacts are private and secure
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    paddingTop: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    textAlign: "center",
  },
  features: {
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 15,
    fontWeight: "500" as const,
  },
  actions: {
    gap: 14,
  },
  loginButton: {
    shadowColor: "#4B68F5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  loginGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
  },
  recheckButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  recheckText: {
    fontSize: 14,
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    paddingBottom: 8,
  },
});
