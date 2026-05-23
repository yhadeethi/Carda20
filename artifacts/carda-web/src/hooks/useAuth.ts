import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5,
  });

  const user = error ? null : (data ?? null);

  return {
    user,
    isLoading: isLoading && !error,
    isAuthenticated: !!user && !error,
    refetch,
  };
}
