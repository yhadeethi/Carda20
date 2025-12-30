/**
 * CompanyGrid - Responsive grid layout for company tiles
 * UI hardened: mobile 1-col, cleaner empty states, no redundant footer count
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
  onAddCompany,
  searchQuery,
}: CompanyGridProps) {
  // Empty state - no companies at all
  if (companies.length === 0 && !searchQuery) {
    return (
      <div className="rounded-2xl border bg-muted/20 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="font-medium">No companies yet</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Companies are auto-created from scanned contacts, or add one manually.
          </p>

          {onAddCompany && (
            <Button onClick={onAddCompany} className="gap-2 mt-5 rounded-2xl" data-testid="button-add-company-empty">
              <Plus className="w-4 h-4" />
              Add Company
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Empty state - no search results
  if (companies.length === 0 && searchQuery) {
    return (
      <div className="rounded-2xl border bg-muted/20 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="font-medium">No matching companies</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Try searching by a shorter name or the domain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3"
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
          />
        ))}
      </div>
    </div>
  );
}
