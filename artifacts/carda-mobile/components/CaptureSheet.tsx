import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { debriefStore } from "@/lib/debriefStore";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

type SheetMode = "menu" | "paste" | "qr" | "voice";

interface Props {
  visible: boolean;
  onClose: () => void;
  initialMode?: SheetMode;
}

const MENU_ITEMS = [
  {
    id: "voice" as const,
    icon: "mic" as const,
    label: "Voice Debrief",
    subtitle: "After a meeting",
    color: "#7B5CF0",
    bg: "#7B5CF026",
  },
  {
    id: "scan" as const,
    icon: "camera" as const,
    label: "Scan Card",
    subtitle: "Photo of a business card",
    color: "#4B68F5",
    bg: "#4B68F526",
  },
  {
    id: "paste" as const,
    icon: "credit-card" as const,
    label: "Paste Signature",
    subtitle: "Extract from email text",
    color: "#34C759",
    bg: "#34C75926",
  },
  {
    id: "qr" as const,
    icon: "grid" as const,
    label: "Share My QR",
    subtitle: "Let them scan your card",
    color: "#4B68F5",
    bg: "#4B68F526",
  },
];

export function CaptureSheet({ visible, onClose, initialMode = "menu" }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [mode, setMode] = useState<SheetMode>(initialMode);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (visible) setMode(initialMode);
  }, [visible, initialMode]);

  const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const handleClose = () => {
    setMode("menu");
    setPasteText("");
    onClose();
  };

  const handleScanCard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleClose();
    setTimeout(() => router.push("/(tabs)/scan" as any), 220);
  };

  const handlePasteExtract = async () => {
    if (!pasteText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setParsing(true);
    try {
      const res = await fetch(`${BASE_URL}/api/parse-ai`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const { contact } = await res.json();
      const saved = await api.createContact({
        fullName: contact.name,
        email: contact.email,
        phone: contact.phone,
        jobTitle: contact.title,
        companyName: contact.company,
        website: contact.website,
        linkedinUrl: contact.linkedinUrl,
        rawText: pasteText,
      });
      qc.invalidateQueries({ queryKey: ["/api/contacts"] });
      handleClose();
      setTimeout(() => router.push(`/contact/${saved.id}` as any), 220);
    } catch {
      Alert.alert(
        "Extraction failed",
        "Couldn't parse that text. Make sure it contains contact details and try again."
      );
    } finally {
      setParsing(false);
    }
  };

  const vCard = useMemo(() => {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Carda User";
    const email = user?.email ?? "";
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\n${email ? `EMAIL:${email}\n` : ""}END:VCARD`;
  }, [user]);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(vCard)}`;
  const s = makeStyles(colors, insets);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "position" : undefined} style={s.sheetOuter}>
        <View style={s.sheet}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={88} tint="systemChromeMaterial" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassBg }]} />
          )}

          <View style={s.handle} />

          {mode === "menu" && (
            <>
              <Text style={s.sheetTitle}>Add to Network</Text>
              <View style={s.menuList}>
                {MENU_ITEMS.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.menuRow, index < MENU_ITEMS.length - 1 && s.menuRowBorder]}
                    activeOpacity={0.72}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (item.id === "scan") handleScanCard();
                      else setMode(item.id);
                    }}
                  >
                    <View style={[s.menuIcon, { backgroundColor: item.bg }]}>
                      <Feather name={item.icon} size={21} color={item.color} />
                    </View>
                    <View style={s.menuText}>
                      <Text style={s.menuLabel}>{item.label}</Text>
                      <Text style={s.menuSub}>{item.subtitle}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {mode === "paste" && (
            <>
              <View style={s.subHeader}>
                <TouchableOpacity onPress={() => setMode("menu")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="arrow-left" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={s.subTitle}>Paste Signature</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <Text style={s.subBody}>Email signature or business card text. Carda will extract the contact details.</Text>
              <TextInput
                style={[s.textArea, { color: colors.foreground }]}
                value={pasteText}
                onChangeText={setPasteText}
                placeholder={"John Smith\nVP of Sales, Acme Corp\njohn@acme.com\n+1 555-0123"}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoFocus
              />
              <TouchableOpacity
                style={[s.primaryBtn, (!pasteText.trim() || parsing) && { opacity: 0.5 }]}
                onPress={handlePasteExtract}
                disabled={!pasteText.trim() || parsing}
                activeOpacity={0.85}
              >
                {parsing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Extract Contact</Text>}
              </TouchableOpacity>
            </>
          )}

          {mode === "voice" && (
            <>
              <View style={s.subHeader}>
                <TouchableOpacity onPress={() => setMode("menu")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="arrow-left" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={s.subTitle}>Voice Debrief</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.centeredSection}>
                <View style={[s.voiceIconWrap, { backgroundColor: "#7B5CF026" }]}> 
                  <Feather name="mic" size={32} color="#7B5CF0" />
                </View>
                <Text style={s.voiceTitle}>Voice Debrief</Text>
                <Text style={s.voiceBody}>Record a quick note after a meeting. Carda will extract tasks, reminders, and a summary.</Text>
                <TouchableOpacity
                  style={s.primaryBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    debriefStore.setContactId(null);
                    handleClose();
                    setTimeout(() => router.push("/voice-debrief" as any), 220);
                  }}
                >
                  <Text style={s.primaryBtnText}>Start Recording</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === "qr" && (
            <>
              <View style={s.subHeader}>
                <TouchableOpacity onPress={() => setMode("menu")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="arrow-left" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={s.subTitle}>Share My QR</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.centeredSection}>
                <Text style={s.qrName}>{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Your Profile"}</Text>
                {user?.email && <Text style={s.qrEmail}>{user.email}</Text>}
                <View style={s.qrWrap}>
                  <Image source={{ uri: qrImageUrl }} style={s.qrImage} resizeMode="contain" />
                </View>
                <Text style={s.qrHint}>Let others scan this to save your contact info instantly.</Text>
              </View>
            </>
          )}

          <View style={{ height: insets.bottom + 8 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: { bottom: number }) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.22)",
    },
    sheetOuter: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingBottom: Math.max(8, insets.bottom),
    },
    sheet: {
      borderRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 24,
      overflow: "hidden",
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.mutedForeground,
      opacity: 0.22,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 8,
    },
    menuList: { overflow: "hidden", borderRadius: 20 },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 68,
      paddingVertical: 9,
      paddingHorizontal: 2,
    },
    menuRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    menuIcon: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    menuText: { flex: 1 },
    menuLabel: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    menuSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    subHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    subTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    subBody: {
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 19,
      marginBottom: 14,
    },
    textArea: {
      backgroundColor: colors.muted,
      borderRadius: 18,
      padding: 14,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 126,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primaryBtn: {
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 6,
    },
    primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    centeredSection: { alignItems: "center", paddingVertical: 16, gap: 12 },
    voiceIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    voiceTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    voiceBody: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 10,
    },
    qrName: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    qrEmail: { fontSize: 13, color: colors.mutedForeground },
    qrWrap: {
      backgroundColor: "#fff",
      borderRadius: 18,
      padding: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    qrImage: { width: 200, height: 200 },
    qrHint: {
      fontSize: 12,
      color: colors.mutedForeground,
      textAlign: "center",
      opacity: 0.72,
      paddingHorizontal: 20,
    },
  });
}
