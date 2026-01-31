import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  listUserEvents,
  createUserEvent,
  updateUserEvent,
  deleteUserEvent,
  type UserEvent,
  type CreateUserEventInput,
  type UpdateUserEventInput,
} from "@/lib/userEventsApi";

export function useUserEvents() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<UserEvent[]>({
    queryKey: ["/api/user-events"],
    enabled: isAuthenticated, // requires auth (server enforces anyway)
    queryFn: () => listUserEvents(200),
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateUserEventInput) => createUserEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateUserEventInput }) =>
      updateUserEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteUserEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
    },
  });

  return {
    events,
    isLoading,
    createEvent: createMutation.mutateAsync,
    updateEvent: updateMutation.mutateAsync,
    deleteEvent: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
