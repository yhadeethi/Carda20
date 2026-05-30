import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { api, Contact } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type ScanState = "idle" | "scanning" | "review" | "saving";

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();
  const eventId = eventIdParam ? Number(eventIdParam) : null;

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Contact>>({});

  const pickImage = async (useCamera: boolean) => {
    const perms = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perms.status !== "granted") {
      Alert.alert(
        "Permission required",
        `Please allow ${useCamera ? "camera" : "photo library"} access in Settings.`
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.85,
        });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setImageUri(uri);
    await scanImage(uri);
  };

  const scanImage = async (uri: string) => {
    setScanState("scanning");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri,
        type: "image/jpeg",
        name: "card.jpg",
      } as any);
      const result = await api.scanCard(formData);
      setForm(result.contact);
      setScanState("review");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setScanState("idle");
      Alert.alert("Scan failed", err?.message || "Could not extract contact from image.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const saveContact = async () => {
    setScanState("saving");
    try {
      const saved = await api.createContact(form);
      if (eventId && saved.id) {
        try {
          await api.attachContactsToEvent(eventId, [saved.id]);
          await qc.invalidateQueries({ queryKey: ["event-contacts", String(eventId)] });
        } catch {
          Alert.alert(
            "Attach Failed",
            "Contact saved, but could not attach it to the event. You can add it manually from the event screen."
          );
        }
      }
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      if (eventId) {
        router.push(`/event/${eventId}` as any);
      } else {
        router.push("/(tabs)");
      }
    } catch (err: any) {
      setScanState("review");
      Alert.alert("Save failed", err?.message || "Could not save contact.");
    }
  };

  const reset = () => {
    setScanState("idle");
    setImageUri(null);
    setForm({});
  };

  const field = (
    label: string,
    key: keyof Contact,
    icon: string,
    multiline = false
  ) => (
    <View key={key} style={styles.fieldRow}>
      <Feather
        name={icon as any}
        size={15}
        color={colors.mutedForeground}
        style={styles.fieldIcon}
      />
      <View style={styles.fieldContent}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <TextInput
          value={(form[key] as string) || ""}
          onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
          style={[
            styles.fieldInput,
            {
              color: colors.foreground,
              borderBottomColor: colors.border,
            },
            multiline && styles.multilineInput,
          ]}
          multiline={multiline}
          placeholderTextColor={colors.mutedForeground}
          placeholder={`Enter ${label.toLowerCase()}`}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );

  const paddingBottom = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  if (scanState === "scanning") {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={[styles.previewImage, { borderRadius: colors.radius }]}
          />
        )}
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 24 }}
        />
        <Text style={[styles.scanningText, { color: colors.foreground }]}>
          Scanning card…
        </Text>
        <Text style={[styles.scanningSubtext, { color: colors.mutedForeground }]}>
          Extracting contact information with AI
        </Text>
      </View>
    );
  }

  if (scanState === "review" || scanState === "saving") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.reviewHeader,
            {
              paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={reset} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewTitle, { color: colors.foreground }]}>
              Review Contact
            </Text>
            {eventId ? (
              <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>Will attach to event</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={saveContact}
            disabled={scanState === "saving"}
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary, borderRadius: colors.radius },
            ]}
          >
            {scanState === "saving" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingVertical: 16, paddingBottom }}
          keyboardShouldPersistTaps="handled"
        >
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.reviewImage,
                { borderRadius: colors.radius, borderColor: colors.border },
              ]}
              resizeMode="cover"
            />
          )}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                marginHorizontal: 16,
              },
            ]}
          >
            {field("Full Name", "fullName", "user")}
            {field("Job Title", "jobTitle", "briefcase")}
            {field("Company", "companyName", "building")}
            {field("Email", "email", "mail")}
            {field("Phone", "phone", "phone")}
            {field("LinkedIn", "linkedinUrl", "linkedin")}
            {field("Website", "website", "globe")}
            {field("Notes", "notes", "file-text", true)}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.idleContent,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 20,
            paddingBottom,
          },
        ]}
      >
        <View style={styles.idleHeader}>
          <Text style={[styles.idleTitle, { color: colors.foreground }]}>
            Scan Card
          </Text>
          {eventId ? (
            <View style={[styles.eventBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
              <Feather name="calendar" size={13} color={colors.primary} />
              <Text style={[styles.eventBannerText, { color: colors.primary }]}>Scanning for event</Text>
            </View>
          ) : (
            <Text style={[styles.idleSubtitle, { color: colors.mutedForeground }]}>
              Take a photo or choose from your library
            </Text>
          )}
        </View>

        <LinearGradient
          colors={[colors.gradientStart + "1A", colors.gradientEnd + "1A"]}
          style={[
            styles.scanArea,
            {
              borderColor: colors.primary + "44",
              borderRadius: colors.radius * 2,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.scanIcon, { borderRadius: 32 }]}
          >
            <Feather name="camera" size={40} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.scanAreaText, { color: colors.foreground }]}>
            Point camera at a business card
          </Text>
          <Text style={[styles.scanAreaSubtext, { color: colors.mutedForeground }]}>
            AI will extract contact information automatically
          </Text>
        </LinearGradient>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => pickImage(true)}
            style={styles.primaryButton}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.primaryGradient, { borderRadius: colors.radius }]}
            >
              <Feather name="camera" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => pickImage(false)}
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="image" size={20} color={colors.foreground} />
            <Text
              style={[styles.secondaryButtonText, { color: colors.foreground }]}
            >
              Choose from Library
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  previewImage: {
    width: 240,
    height: 150,
    resizeMode: "cover" as const,
  },
  scanningText: { fontSize: 18, fontWeight: "600" as const },
  scanningSubtext: { fontSize: 14, textAlign: "center" },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4, marginRight: 8 },
  reviewTitle: { fontSize: 18, fontWeight: "600" as const },
  reviewSub: { fontSize: 12, marginTop: 1 },
  eventBanner: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  eventBannerText: { fontSize: 13, fontWeight: "600" as const },
  saveButton: { paddingHorizontal: 16, paddingVertical: 8 },
  saveButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 14 },
  reviewImage: {
    height: 140,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  formCard: { borderWidth: 1, padding: 4 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  fieldIcon: { marginTop: 20, marginRight: 10, width: 18 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "500" as const, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldInput: {
    fontSize: 15,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  multilineInput: { minHeight: 60, textAlignVertical: "top" as const },
  idleContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  idleHeader: { alignItems: "center", paddingTop: 8 },
  idleTitle: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3, marginBottom: 6 },
  idleSubtitle: { fontSize: 15, textAlign: "center" },
  scanArea: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    gap: 14,
  },
  scanIcon: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  scanAreaText: { fontSize: 17, fontWeight: "600" as const, textAlign: "center" },
  scanAreaSubtext: { fontSize: 14, textAlign: "center" },
  buttonGroup: { gap: 12 },
  primaryButton: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: "500" as const },
});
