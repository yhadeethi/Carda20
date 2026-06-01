import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as DocumentPicker from "expo-document-picker";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { useMyProfile, MyProfile } from "@/hooks/useMyProfile";

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
          { backgroundColor: colors.primary + "1A", borderRadius: colors.radius - 4 },
        ]}
      >
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.integrationContent}>
        <Text style={[styles.integrationName, { color: colors.foreground }]}>{name}</Text>
        <Text style={[styles.integrationStatus, { color: connected ? "#22C55E" : colors.mutedForeground }]}>
          {connected ? "Connected" : "Not connected"}
        </Text>
      </View>
      {connected ? (
        <TouchableOpacity
          onPress={onSync}
          style={[styles.syncButton, { backgroundColor: colors.primary + "1A", borderRadius: colors.radius - 4 }]}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.syncText, { color: colors.primary }]}>Sync</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onConnect}
          style={[styles.connectButton, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
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
  const { user, logout, checkAuth } = useAuth();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "User";

  const { profile, saveProfile, isLoaded } = useMyProfile({
    name: fullName,
    email: user?.email,
  });

  const [formData, setFormData] = useState<MyProfile>(profile);

  const startEdit = () => {
    setFormData({ ...profile });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateUserProfile(formData);
      await saveProfile(formData);
      await checkAuth();
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "Could not save profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleField = (field: keyof MyProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const hubspotQ = useQuery({ queryKey: ["hubspot-status"], queryFn: api.getHubSpotStatus });
  const salesforceQ = useQuery({ queryKey: ["salesforce-status"], queryFn: api.getSalesforceStatus });

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
      Alert.alert("Connection failed", err?.message || "Could not start OAuth flow. Try again.");
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (crm: "hubspot" | "salesforce") => {
    setSyncing(crm);
    try {
      if (crm === "hubspot") await api.syncHubSpot();
      else await api.syncSalesforce();
      Alert.alert("Sync complete", `All contacts synced to ${crm === "hubspot" ? "HubSpot" : "Salesforce"}.`);
    } catch {
      Alert.alert("Sync failed", "Check your connection and try again.");
    } finally {
      setSyncing(null);
    }
  };

  const handleImportVcf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/vcard", "text/x-vcard", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      setImporting(true);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name ?? "contacts.vcf",
        type: file.mimeType ?? "text/vcard",
      } as any);

      const res = await fetch(`${BASE_URL}/api/contacts/import-vcf`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.status === 404) {
        Alert.alert("Coming soon", "VCF import is not yet available. Check back in a future update.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const count = body.imported ?? body.count ?? "some";
      qc.invalidateQueries({ queryKey: ["/api/contacts"] });
      Alert.alert("Import complete", `${count} contact${count === 1 ? "" : "s"} imported successfully.`);
    } catch (e: any) {
      if (!e?.message?.includes("coming soon") && !e?.message?.includes("canceled")) {
        Alert.alert("Import failed", e?.message || "Could not import contacts. Please try again.");
      }
    } finally {
      setImporting(false);
    }
  };


  const paddingBottom = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  const inputStyle = [
    styles.editInput,
    {
      backgroundColor: colors.input,
      color: colors.foreground,
    },
  ];

  const displayName = isLoaded && (profile.fullName || profile.jobTitle || profile.companyName)
    ? profile.fullName || fullName
    : fullName;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: Platform.OS === "web" ? 67 : 8,
          paddingBottom,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.screenTitle, { color: colors.foreground, marginLeft: 16 }]}>
          Profile
        </Text>

        {/* ── Hero card ───────────────────────────────────────────── */}
        <View style={styles.profileSection}>
          {editing ? (
            <GlassCard>
              <Text style={[styles.editSectionTitle, { color: colors.foreground }]}>
                Edit your card
              </Text>

              <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Full name</Text>
              <TextInput
                style={inputStyle}
                value={formData.fullName}
                onChangeText={(v) => handleField("fullName", v)}
                placeholder="Jane Smith"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />

              <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Job title</Text>
              <TextInput
                style={inputStyle}
                value={formData.jobTitle}
                onChangeText={(v) => handleField("jobTitle", v)}
                placeholder="VP of Sales"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />

              <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Company</Text>
              <TextInput
                style={inputStyle}
                value={formData.companyName}
                onChangeText={(v) => handleField("companyName", v)}
                placeholder="Acme Corp"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />

              <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Email</Text>
              <TextInput
                style={inputStyle}
                value={formData.email}
                onChangeText={(v) => handleField("email", v)}
                placeholder="jane@acme.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Phone</Text>
              <TextInput
                style={inputStyle}
                value={formData.phone}
                onChangeText={(v) => handleField("phone", v)}
                placeholder="+1 555 000 0000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                returnKeyType="next"
              />

              <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>LinkedIn URL</Text>
              <TextInput
                style={inputStyle}
                value={formData.linkedinUrl}
                onChangeText={(v) => handleField("linkedinUrl", v)}
                placeholder="linkedin.com/in/username"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="done"
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={cancelEdit}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={styles.saveBtnText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.profileBg} radius={18} padding={20}>
              <Avatar name={displayName} size="xl" />
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {displayName}
              </Text>
              {(isLoaded && profile.jobTitle) || (isLoaded && profile.companyName) ? (
                <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
                  {[profile.jobTitle, profile.companyName].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
              {user?.email ? (
                <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
                  {user.email}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={startEdit}
                style={[styles.editBtn, { borderColor: colors.primary + "66", backgroundColor: colors.primary + "1A" }]}
              >
                <Feather name="edit-2" size={13} color={colors.primary} />
                <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit card</Text>
              </TouchableOpacity>
            </GlassCard>
          )}
        </View>

        {/* ── My Profile row ────────────────────────────────────── */}
        {!editing && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MY PROFILE</Text>
            <GlassCard style={{ marginHorizontal: 16, padding: 0 }} radius={14}>
              <TouchableOpacity
                onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                style={[styles.menuRow, { borderBottomColor: "transparent" }]}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.primary + "1A", borderRadius: colors.radiusSm }]}>
                  <Feather name="user" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuText, { color: colors.foreground }]}>My profile</Text>
                  <Text style={[styles.menuSubText, { color: colors.mutedForeground }]}>
                    {displayName}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </GlassCard>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CRM INTEGRATIONS</Text>
            <GlassCard style={{ marginHorizontal: 16, padding: 0 }} radius={14}>
              {(syncing || connecting) ? (
                <View style={[styles.syncingOverlay, { backgroundColor: colors.background + "CC" }]}>
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

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATA</Text>
            <GlassCard style={{ marginHorizontal: 16, padding: 0 }} radius={14}>
              <TouchableOpacity
                onPress={handleImportVcf}
                disabled={importing}
                style={[styles.menuRow, { borderBottomColor: "transparent" }]}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.primary + "1A", borderRadius: colors.radius - 4 }]}>
                  {importing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="upload" size={16} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuText, { color: colors.foreground }]}>Import contacts (.vcf)</Text>
                  <Text style={[styles.menuSubText, { color: colors.mutedForeground }]}>
                    From Google Contacts, LinkedIn export…
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </GlassCard>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Account</Text>
            <GlassCard style={{ marginHorizontal: 16, padding: 0 }}>
              <TouchableOpacity
                onPress={handleLogout}
                style={[styles.menuRow, { borderBottomColor: "transparent" }]}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.destructive + "1A", borderRadius: colors.radiusSm }]}>
                  <Feather name="log-out" size={16} color={colors.destructive} />
                </View>
                <Text style={[styles.menuText, { color: colors.destructive }]}>Sign Out</Text>
              </TouchableOpacity>
            </GlassCard>

            <Text style={[styles.footer, { color: colors.mutedForeground }]}>
              Carda 2.0 · Contact Intelligence
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: 6,
  },
  profileName: { fontSize: 20, fontWeight: "700" as const, marginTop: 4 },
  profileMeta: { fontSize: 13 },
  profileEmail: { fontSize: 14 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontWeight: "600" as const },

  editSectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  editInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },

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
  connectButton: { paddingHorizontal: 12, paddingVertical: 6 },
  connectText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  syncingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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
  menuIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  menuText: { fontSize: 15, fontWeight: "500" as const },
  menuSubText: { fontSize: 12, marginTop: 1 },
  footer: { textAlign: "center", fontSize: 12, marginTop: 32, marginBottom: 8 },
  comingSoonBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  comingSoonText: { fontSize: 11, fontWeight: "600" as const },
});
