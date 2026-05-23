/**
 * CompanyGrid - Responsive grid layout for company tiles
 */

import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Company } from "@/lib/companiesStorage";
import { CompanyTile } from "./CompanyTile";

interface CompanyGridProps {
  companies: Company[];
  getContactCount: (companyId: string) => number;
  getContactEmails?: (companyId: string) => string[];
  onSelectCompany: (companyId: string) => void;
  onOpenOrg?: (companyId: string) => void;
  onAddNote?: (companyId: string) => void;
  onDeleteCompany?: (companyId: string) => void;
  onAddCompany?: () => void;
  searchQuery?: string;
}

export function CompanyGrid({
  companies,
  getContactCount,
  getContactEmails,
  onSelectCompany,
  onOpenOrg,
  onAddNote,
  onDeleteCompany,
  onAddCompany,
  searchQuery,
}: CompanyGridProps) {
  // Empty state — no companies at all
  if (companies.length === 0 && !searchQuery) {
    return (
      <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#4B68F5]/10 flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-6 h-6 text-[#4B68F5]" />
        </div>
        <div className="text-[15px] font-bold text-foreground">No companies yet</div>
        <p className="text-[13px] font-medium text-muted-foreground/70 mt-1 max-w-xs mx-auto">
          Companies are auto-created from scanned contacts, or add one manually.
        </p>
        {onAddCompany && (
          <Button
            onClick={onAddCompany}
            className="gap-2 mt-5 rounded-2xl bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] text-white font-bold border-0 h-12"
            data-testid="button-add-company-empty"
          >
            <Plus className="w-4 h-4" />
            Add Company
          </Button>
        )}
      </div>
    );
  }

  // Empty state — no search results
  if (companies.length === 0 && searchQuery) {
    return (
      <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#4B68F5]/10 flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-6 h-6 text-[#4B68F5]" />
        </div>
        <div className="text-[15px] font-bold text-foreground">No matching companies</div>
        <p className="text-[13px] font-medium text-muted-foreground/70 mt-1 max-w-xs mx-auto">
          Try searching by a shorter name or the domain.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2"
      data-testid="companies-grid"
    >
      {companies.map((company) => (
        <CompanyTile
          key={company.id}
          company={company}
          contactCount={getContactCount(company.id)}
          contactEmails={getContactEmails?.(company.id) || []}
          onClick={() => onSelectCompany(company.id)}
          onOpenOrg={onOpenOrg ? () => onOpenOrg(company.id) : undefined}
          onAddNote={onAddNote ? () => onAddNote(company.id) : undefined}
          onDelete={onDeleteCompany ? () => onDeleteCompany(company.id) : undefined}
        />
      ))}
    </div>
  );
}
