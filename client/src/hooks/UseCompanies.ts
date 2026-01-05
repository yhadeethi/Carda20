import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";

export interface DbCompany {
  id: number;
  userId: number;
  name: string;
  domain: string | null;
  createdAt: string | null;
}

export function useCompanies() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery<DbCompany[]>({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  /**
   * NEW — delete a company (contacts will be unlinked, not deleted)
   */
  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await apiRequest("DELETE", `/api/companies/${companyId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  return {
    companies,
    isLoading,

    // NEW
    deleteCompany: deleteMutation.mutateAsync,

    isDeletingCompany: deleteMutation.isPending,
  };
}
