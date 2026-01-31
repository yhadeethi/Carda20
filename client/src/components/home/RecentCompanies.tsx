import { Building2, ChevronRight, Sparkles } from "lucide-react";
import { CompanyAvatar } from "@/components/companies/CompanyAvatar";
import type { CompanySummary, SuggestedCompany } from "@/hooks/useScoreboard";

type RecentCompaniesProps = {
  companies: CompanySummary[];
  suggestedCompany: SuggestedCompany | null;
  onSelectCompany: (companyId: string, tab?: "contacts" | "orgmap" | "notes") => void;
  onViewAllCompanies: () => void;
};

function percentLabel(p: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(p)));
  return `${clamped}%`;
}

export function RecentCompanies({
  companies,
  suggestedCompany,
  onSelectCompany,
  onViewAllCompanies,
}: RecentCompaniesProps) {
  const top = companies.slice(0, 4);

  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-medium text-muted-foreground">Recent companies</h2>
        {companies.length > 0 && (
          <button
            onClick={onViewAllCompanies}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View all
          </button>
        )}
      </div>

      {top.length > 0 ? (
        <div
          className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4"
          style={{
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {/* Compact strip */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {top.map((c) => (
              <button
                key={c.companyId}
                onClick={() => onSelectCompany(c.companyId, "contacts")}
                className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 hover:bg-muted/20 transition-colors px-3 py-2 shrink-0"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <CompanyAvatar name={c.name} domain={c.domain} size="sm" />
                <span className="text-sm font-medium max-w-[140px] truncate">{c.name}</span>
              </button>
            ))}
          </div>

          {/* Suggested action card */}
          {suggestedCompany && (
            <div className="mt-4 rounded-2xl bg-background/40 border border-border/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyAvatar name={suggestedCompany.name} domain={suggestedCompany.domain} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{suggestedCompany.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {suggestedCompany.contactsCount} contact{suggestedCompany.contactsCount !== 1 ? "s" : ""} · {percentLabel(suggestedCompany.completeness)} complete
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onSelectCompany(suggestedCompany.companyId, "contacts")}
                  className="h-9 px-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors flex items-center gap-2 shrink-0"
                >
                  <span className="text-xs font-medium">View</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => onSelectCompany(suggestedCompany.companyId, "contacts")}
                  className="text-xs font-medium rounded-full bg-primary/10 text-primary px-3 py-1 hover:bg-primary/15 transition-colors"
                >
                  {suggestedCompany.contactsCount} contacts
                </button>
                <button
                  onClick={() => onSelectCompany(suggestedCompany.companyId, suggestedCompany.nextAction === "finish_profile" ? "notes" : "notes")}
                  className="text-xs font-medium rounded-full bg-muted/40 px-3 py-1 hover:bg-muted/60 transition-colors"
                >
                  {suggestedCompany.nextAction === "finish_profile" ? "Finish profile" : "Add intel"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 p-4"
          style={{
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">No companies yet</div>
              <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Scan a business card to start building your company database
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
