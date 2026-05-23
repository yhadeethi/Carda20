import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactCard } from "@/components/ContactCard";
import { GlassCard } from "@/components/GlassCard";
import { api, Contact, UserEvent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [togglingActive, setTogglingActive] = useState(false);

  const { data: event, isLoading } = useQuery<UserEvent>({
    queryKey: ["user-event", id],
    queryFn: () => api.getUserEvent(Number(id)),
    enabled: !!id,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["event-contacts", id],
    queryFn: () => api.getEventContacts(Number(id)),
    enabled: !!id,
  });

  const handleToggleActive = async () => {
    if (!event) return;
    setTogglingActive(true);
    try {
      await api.updateUserEvent(event.id, { isActive: !event.isActive });
      await qc.invalidateQueries({ queryKey: ["user-event", id] });
      await qc.invalidateQueries({ queryKey: ["user-events"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not update event status.");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete event", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!event) return;
          try {
            await api.deleteUserEvent(event.id);
            await qc.invalidateQueries({ queryKey: ["user-events"] });
            router.back();
          } catch {
            Alert.alert("Error", "Could not delete event.");
          }
        },
      },
    ]);
  };

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (isLoading || !event) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: event.title }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom }}
      >
        <GlassCard style={{ margin: 16 }}>
          <View style={styles.eventHeader}>
            <View
              style={[
                styles.eventIconContainer,
                {
                  backgroundColor: event.isActive
                    ? colors.primary + "22"
                    : colors.secondary,
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Feather
                name="calendar"
                size={28}
                color={event.isActive ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={styles.eventHeaderContent}>
              <Text style={[styles.eventName, { color: colors.foreground }]}>
                {event.title}
              </Text>
              {event.isActive ? (
                <View style={styles.activeBadge}>
                  <View
                    style={[
                      styles.activeDot,
                      { backgroundColor: "#22C55E" },
                    ]}
                  />
                  <Text style={[styles.activeText, { color: "#22C55E" }]}>
                    Active
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {event.locationLabel ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {event.locationLabel}
              </Text>
            </View>
          ) : null}

          {event.startedAt ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {formatDate(event.startedAt)}
              </Text>
            </View>
          ) : null}

          {(contacts?.length ?? 0) > 0 ? (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Feather name="users" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {contacts!.length} contact{contacts!.length !== 1 ? "s" : ""}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleToggleActive}
              disabled={togglingActive}
              style={[
                styles.actionButton,
                {
                  backgroundColor: event.isActive
                    ? colors.muted
                    : colors.primary + "1A",
                  borderColor: event.isActive ? colors.border : colors.primary + "44",
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              {togglingActive ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather
                    name={event.isActive ? "pause-circle" : "play-circle"}
                    size={16}
                    color={event.isActive ? colors.mutedForeground : colors.primary}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      { color: event.isActive ? colors.mutedForeground : colors.primary },
                    ]}
                  >
                    {event.isActive ? "Mark Inactive" : "Mark Active"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.destructive + "1A",
                  borderColor: colors.destructive + "44",
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[styles.actionText, { color: colors.destructive }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {(contacts?.length ?? 0) > 0 ? (
          <>
            <Text
              style={[
                styles.contactsHeader,
                { color: colors.mutedForeground, marginLeft: 20, marginBottom: 8 },
              ]}
            >
              Contacts
            </Text>
            {contacts!.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onPress={() => router.push(`/contact/${c.id}`)}
              />
            ))}
          </>
        ) : (
          <View style={styles.emptyContacts}>
            <Feather name="users" size={28} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No contacts in this event yet
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.mutedForeground }]}
            >
              Contacts are added when you scan cards during an active event
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  eventHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  eventIconContainer: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  eventHeaderContent: { flex: 1 },
  eventName: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.2 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  activeDot: { width: 7, height: 7, borderRadius: 3.5 },
  activeText: { fontSize: 12, fontWeight: "600" as const },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  metaText: { fontSize: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: "500" as const },
  contactsHeader: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
  },
  emptyContacts: {
    alignItems: "center",
    paddingTop: 40,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 15, fontWeight: "500" as const, marginTop: 8 },
  emptySubtext: { fontSize: 13, textAlign: "center" },
});
