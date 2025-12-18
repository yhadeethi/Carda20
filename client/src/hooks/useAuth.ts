import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5,
  });

  return {
    user: error ? null : user,
    isLoading: isLoading && !error,
    isAuthenticated: !!user && !error,
    refetch,
  };
}
