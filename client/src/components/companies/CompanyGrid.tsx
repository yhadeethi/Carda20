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
  onSelectCompany: (companyId: string) => void;
  onOpenOrg?: (companyId: string) => void;
  onAddNote?: (companyId: string) => void;
  onAddCompany?: () => void;
  searchQuery?: string;
}

export function CompanyGrid({
  companies,
  getContactCount,
  onSelectCompany,
  onOpenOrg,
  onAddNote,
  onAddCompany,
  searchQuery,
}: CompanyGridProps) {
  // Empty state - no companies at all
  if (companies.length === 0 && !searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground mb-4">No companies yet</p>
        {onAddCompany && (
          <Button onClick={onAddCompany} className="gap-1.5" data-testid="button-add-company-empty">
            <Plus className="w-4 h-4" />
            Add Company
          </Button>
        )}
      </div>
    );
  }

  // Empty state - no search results
  if (companies.length === 0 && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No matching companies</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Grid of company tiles */}
      <div 
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        data-testid="companies-grid"
      >
        {companies.map((company) => (
          <CompanyTile
            key={company.id}
            company={company}
            contactCount={getContactCount(company.id)}
            onClick={() => onSelectCompany(company.id)}
            onOpenOrg={onOpenOrg ? () => onOpenOrg(company.id) : undefined}
            onAddNote={onAddNote ? () => onAddNote(company.id) : undefined}
          />
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-center text-muted-foreground pt-2">
        {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
      </p>
    </div>
  );
}
