import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { debriefStore } from "@/lib/debriefStore";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type RecorderState = "idle" | "recording" | "processing" | "error";

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function VoiceDebriefScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startPulse = () => {
    pulseAnim.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    pulseAnim.setValue(1);
  };

  const handleStart = async () => {
    setPermissionError(null);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setPermissionError(
          "Microphone access is needed for voice debrief. Please enable it in Settings."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: "aac",
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;

      setState("recording");
      setElapsed(0);
      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (
        err?.message?.includes("permission") ||
        err?.code === "E_MISSING_PERMISSION"
      ) {
        setPermissionError("Microphone permission denied. Enable it in Settings.");
      } else {
        Alert.alert("Error", "Could not start recording. Please try again.");
      }
    }
  };

  const handleStop = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopPulse();
    setState("processing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      const formData = new FormData();
      formData.append("audio", {
        uri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as any);

      const res = await fetch(`${BASE_URL}/api/debrief/transcribe`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Transcription failed");
      }

      const data = await res.json();
      const transcript: string = data.transcript ?? "";

      if (!transcript.trim()) {
        throw new Error("No speech detected. Please try again.");
      }

      debriefStore.setTranscript(transcript);

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/voice-debrief-review" as any);
    } catch (err: any) {
      setState("error");
      Alert.alert(
        "Transcription failed",
        err?.message || "Could not process recording. Please try again.",
        [{ text: "OK", onPress: () => setState("idle") }]
      );
    }
  };

  const s = makeStyles(colors, insets);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Voice Debrief",
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
        }}
      />
      <View style={s.container}>
        {state === "idle" && (
          <>
            {permissionError ? (
              <View style={s.centerGroup}>
                <View style={[s.iconCircle, { backgroundColor: "#FEE2E2" }]}>
                  <Feather name="mic-off" size={32} color="#EF4444" />
                </View>
                <Text style={s.title}>Microphone Access Needed</Text>
                <Text style={s.body}>{permissionError}</Text>
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleStart}
                  activeOpacity={0.85}
                >
                  <Text style={s.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.centerGroup}>
                <View style={[s.iconCircle, { backgroundColor: "#EEF2FF" }]}>
                  <Feather name="mic" size={32} color="#6366F1" />
                </View>
                <Text style={s.title}>Voice Debrief</Text>
                <Text style={s.body}>
                  Tap the mic and speak about your meeting. We'll extract notes,
                  tasks, and reminders automatically.
                </Text>
                <TouchableOpacity
                  style={s.recordBtn}
                  onPress={handleStart}
                  activeOpacity={0.85}
                >
                  <Feather name="mic" size={30} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {state === "recording" && (
          <View style={s.centerGroup}>
            <Text style={s.title}>Recording…</Text>
            <Text style={s.timerText}>{formatTime(elapsed)}</Text>

            <View style={s.pulseWrap}>
              <Animated.View
                style={[
                  s.pulseRing,
                  { transform: [{ scale: pulseAnim }], opacity: 0.3 },
                ]}
              />
              <Animated.View
                style={[
                  s.pulseRing2,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: 0.15,
                  },
                ]}
              />
              <View style={s.recDot}>
                <View style={s.recDotInner} />
                <Text style={s.recText}>REC</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.stopBtn}
              onPress={handleStop}
              activeOpacity={0.85}
            >
              <View style={s.stopSquare} />
            </TouchableOpacity>
            <Text style={s.hintText}>Tap to stop recording</Text>
          </View>
        )}

        {state === "processing" && (
          <View style={s.centerGroup}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={s.title}>Transcribing…</Text>
            <Text style={s.body}>This usually takes a few seconds</Text>
          </View>
        )}

        {state === "error" && (
          <View style={s.centerGroup}>
            <ActivityIndicator size="large" color={colors.mutedForeground} />
          </View>
        )}
      </View>
    </>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: { bottom: number; top: number }
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingBottom: insets.bottom + 24,
    },
    centerGroup: {
      alignItems: "center",
      gap: 20,
      width: "100%",
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },
    timerText: {
      fontSize: 40,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: 2,
      fontVariant: ["tabular-nums"],
    },
    body: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
    },
    recordBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#EF4444",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#EF4444",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    stopBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.foreground,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    stopSquare: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    pulseWrap: {
      width: 120,
      height: 120,
      alignItems: "center",
      justifyContent: "center",
    },
    pulseRing: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "#EF4444",
    },
    pulseRing2: {
      position: "absolute",
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "#EF4444",
    },
    recDot: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    recDotInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#EF4444",
    },
    recText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#EF4444",
      letterSpacing: 1,
    },
    hintText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    primaryBtn: {
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
    },
    cancelText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
  });
}
