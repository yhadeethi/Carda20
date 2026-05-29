import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function openCrmConnect(crm: "hubspot" | "salesforce") {
  const endpoint = crm === "hubspot" ? "/api/hubspot/connect" : "/api/salesforce/connect";
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const { url } = await res.json();
  if (!url) throw new Error("No auth URL returned");
  if (Platform.OS === "web") {
    window.location.href = url;
  } else {
    await WebBrowser.openBrowserAsync(url, { showTitle: true });
  }
}

function IntegrationRow({
  name,
  icon,
  connected,
  onConnect,
  onSync,
}: {
  name: string;
  icon: string;
  connected: boolean;
  onConnect: () => void;
  onSync: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.integrationRow, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.integrationIcon,
          {
            backgroundColor: colors.primary + "1A",
            borderRadius: colors.radius - 4,
          },
        ]}
      >
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.integrationContent}>
        <Text style={[styles.integrationName, { color: colors.foreground }]}>
          {name}
        </Text>
        <Text
          style={[
            styles.integrationStatus,
            { color: connected ? "#22C55E" : colors.mutedForeground },
          ]}
        >
          {connected ? "Connected" : "Not connected"}
        </Text>
      </View>
      {connected ? (
        <TouchableOpacity
          onPress={onSync}
          style={[
            styles.syncButton,
            {
              backgroundColor: colors.primary + "1A",
              borderRadius: colors.radius - 4,
            },
          ]}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.syncText, { color: colors.primary }]}>
            Sync
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onConnect}
          style={[
            styles.connectButton,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius - 4,
            },
          ]}
        >
          <Text style={styles.connectText}>Connect</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [connecting, setConnecting] = React.useState<string | null>(null);

  const hubspotQ = useQuery({
    queryKey: ["hubspot-status"],
    queryFn: api.getHubSpotStatus,
  });

  const salesforceQ = useQuery({
    queryKey: ["salesforce-status"],
    queryFn: api.getSalesforceStatus,
  });

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  const handleConnect = async (crm: "hubspot" | "salesforce") => {
    setConnecting(crm);
    try {
      await openCrmConnect(crm);
    } catch (err: any) {
      Alert.alert(
        "Connection failed",
        err?.message || "Could not start OAuth flow. Try again."
      );
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (crm: "hubspot" | "salesforce") => {
    setSyncing(crm);
    try {
      if (crm === "hubspot") await api.syncHubSpot();
      else await api.syncSalesforce();
      Alert.alert(
        "Sync complete",
        `All contacts synced to ${crm === "hubspot" ? "HubSpot" : "Salesforce"}.`
      );
    } catch {
      Alert.alert("Sync failed", "Check your connection and try again.");
    } finally {
      setSyncing(null);
    }
  };

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "User";

  const paddingBottom = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: Platform.OS === "web" ? 67 : 8,
        paddingBottom,
      }}
    >
      <Text
        style={[styles.screenTitle, { color: colors.foreground, marginLeft: 16 }]}
      >
        Profile
      </Text>

      <View style={styles.profileSection}>
        <LinearGradient
          colors={[colors.primary + "22", colors.purple + "22"]}
          style={[styles.profileBg, { borderRadius: colors.radius * 2 }]}
        >
          <Avatar name={fullName} size={72} />
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {fullName}
          </Text>
          {user?.email ? (
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {user.email}
            </Text>
          ) : null}
        </LinearGradient>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        CRM Integrations
      </Text>
      <GlassCard style={{ marginHorizontal: 16, padding: 0 }}>
        {(syncing || connecting) ? (
          <View style={styles.syncingOverlay}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 8 }}>
              {connecting ? "Connecting…" : "Syncing…"}
            </Text>
          </View>
        ) : null}
        <IntegrationRow
          name="HubSpot"
          icon="database"
          connected={hubspotQ.data?.connected ?? false}
          onConnect={() => handleConnect("hubspot")}
          onSync={() => handleSync("hubspot")}
        />
        <IntegrationRow
          name="Salesforce"
          icon="cloud"
          connected={salesforceQ.data?.connected ?? false}
          onConnect={() => handleConnect("salesforce")}
          onSync={() => handleSync("salesforce")}
        />
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        Account
      </Text>
      <GlassCard style={{ marginHorizontal: 16, padding: 0 }}>
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.menuRow, { borderBottomColor: "transparent" }]}
        >
          <View
            style={[
              styles.menuIcon,
              {
                backgroundColor: colors.destructive + "1A",
                borderRadius: colors.radius - 4,
              },
            ]}
          >
            <Feather name="log-out" size={16} color={colors.destructive} />
          </View>
          <Text style={[styles.menuText, { color: colors.destructive }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </GlassCard>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Carda 2.0 · Contact Intelligence
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  profileSection: { paddingHorizontal: 16, marginBottom: 24 },
  profileBg: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  profileName: { fontSize: 20, fontWeight: "700" as const, marginTop: 4 },
  profileEmail: { fontSize: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 20,
    marginBottom: 8,
    marginTop: 20,
  },
  integrationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  integrationIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  integrationContent: { flex: 1 },
  integrationName: { fontSize: 15, fontWeight: "500" as const },
  integrationStatus: { fontSize: 12, marginTop: 2 },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  syncText: { fontSize: 13, fontWeight: "500" as const },
  connectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  connectText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  syncingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { fontSize: 15, fontWeight: "500" as const },
  footer: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 32,
    marginBottom: 8,
  },
});
