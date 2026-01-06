import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Company as LocalCompany,
  getCompanies as getLocalCompanies,
  deleteCompany as deleteLocalCompany,
} from "@/lib/companiesStorage";

export interface DbCompany {
  id: number;
  domain: string | null;
  name: string | null;
  industry: string | null;
  sizeBand: string | null;
  hqCountry: string | null;
  hqCity: string | null;
  lastEnrichedAt: string | null;
}

function dbCompanyToLocal(company: DbCompany): LocalCompany {
  const now = new Date().toISOString();
  return {
    id: String(company.id),
    name: company.name || company.domain || "Unknown Company",
    domain: company.domain,
    city: company.hqCity || null,
    state: null,
    country: company.hqCountry || null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function useCompanies() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: dbCompanies = [], isLoading } = useQuery<DbCompany[]>({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  const companies: LocalCompany[] = useMemo(() => {
    if (isAuthenticated) return dbCompanies.map(dbCompanyToLocal);
    return getLocalCompanies();
  }, [isAuthenticated, dbCompanies]);

  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      if (!isAuthenticated) {
        deleteLocalCompany(companyId);
        return { success: true, deleted: true };
      }
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
    isLoading: isAuthenticated ? isLoading : false,
    deleteCompany: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
