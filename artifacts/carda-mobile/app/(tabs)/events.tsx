import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventCard } from "@/components/EventCard";
import { api, UserEvent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function EventsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isRefetching, error } = useQuery<UserEvent[]>({
    queryKey: ["user-events"],
    queryFn: api.getUserEvents,
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createUserEvent({
        name: newName.trim(),
        location: newLocation.trim() || undefined,
      });
      await qc.invalidateQueries({ queryKey: ["user-events"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreate(false);
      setNewName("");
      setNewLocation("");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create event.");
    } finally {
      setCreating(false);
    }
  };

  const paddingBottom = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 : 8 },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Events
        </Text>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={[
            styles.addButton,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
          ]}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Failed to load events
          </Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => router.push(`/event/${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["user-events"] })}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!(data?.length)}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="calendar" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No events yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Create an event to group contacts from a conference or meeting
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={[
                  styles.emptyButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Text style={styles.emptyButtonText}>Create Event</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius * 1.5,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                New Event
              </Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Event name (e.g. TechConf 2025)"
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            />
            <TextInput
              placeholder="Location (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={newLocation}
              onChangeText={setNewLocation}
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            />

            <TouchableOpacity
              onPress={handleCreate}
              disabled={!newName.trim() || creating}
              style={[
                styles.createButton,
                {
                  backgroundColor:
                    newName.trim() ? colors.primary : colors.muted,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  addButton: { padding: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyButton: { paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingBottom: 24,
  },
  modalContent: {
    marginHorizontal: 16,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" as const },
  modalInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  createButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600" as const,
    fontSize: 16,
  },
});
