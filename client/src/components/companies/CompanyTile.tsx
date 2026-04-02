/**
 * CompanyTile - Clean, minimal company tile with logo support
 * Supports two variants:
 *   "grid" (default) — vertical card layout for grid displays
 *   "list"           — horizontal row layout matching the People tab
 */

import { ChevronRight, MoreHorizontal, Users, Globe, Network, StickyNote } from "lucide-react";
import { Company } from "@/lib/companiesStorage";
import { CompanyAvatar } from "./CompanyAvatar";

interface CompanyTileProps {
  company: Company;
  contactCount: number;
  contactEmails?: string[];
  onClick: () => void;
  onOpenOrg?: () => void;
  onAddNote?: () => void;
  onDelete?: () => void;
  variant?: "grid" | "list";
}

export function CompanyTile({
  company,
  contactCount,
  contactEmails = [],
  onClick,
  onOpenOrg,
  onAddNote,
  onDelete,
  variant = "grid",
}: CompanyTileProps) {

  // ── LIST VARIANT — horizontal row matching People tab ──
  if (variant === "list") {
    return (
      <div
        className="relative bg-white rounded-xl border border-black/10 shadow-sm flex items-center gap-3 px-4 py-3 cursor-pointer active:opacity-75 transition-opacity w-full"
        onClick={onClick}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        data-testid={`company-tile-${company.id}`}
      >
        {/* Logo — square, favicon or monogram */}
        <CompanyAvatar
          name={company.name}
          domain={company.domain ?? undefined}
          contactEmails={contactEmails}
          size="md"
          className="rounded-xl shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-bold text-foreground truncate"
            data-testid={`company-tile-name-${company.id}`}
            title={company.name}
          >
            {company.name}
          </div>
          <div className="text-[12px] font-medium text-muted-foreground mt-0.5">
            {contactCount} {contactCount !== 1 ? "contacts" : "contact"}
            {company.domain ? ` · ${company.domain}` : ""}
          </div>
        </div>

        {/* ··· delete button */}
        {onDelete && (
          <button
            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0 transition-colors hover:bg-black/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{ touchAction: "manipulation" }}
            aria-label="Company options"
            data-testid={`button-delete-company-${company.id}`}
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      </div>
    );
  }

  // ── GRID VARIANT (default) — vertical card, unchanged ──
  const hasSecondaryActions = !!onOpenOrg || !!onAddNote;

  return (
    <div
      className="relative bg-white rounded-2xl border border-black/10 shadow-sm p-4 cursor-pointer active:opacity-75 transition-opacity"
      onClick={onClick}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      data-testid={`company-tile-${company.id}`}
    >
      {/* ··· delete button — top right */}
      {onDelete && (
        <button
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/5 flex items-center justify-center text-muted-foreground hover:bg-black/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ touchAction: "manipulation" }}
          aria-label="Delete company"
          data-testid={`button-delete-company-${company.id}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      <div className="flex flex-col min-w-0">
        {/* Logo */}
        <CompanyAvatar
          name={company.name}
          domain={company.domain ?? undefined}
          contactEmails={contactEmails}
          size="md"
          className="mb-3"
        />

        {/* Company name */}
        <h3
          className="text-[14px] font-bold text-foreground leading-snug mb-1 min-w-0 pr-6"
          data-testid={`company-tile-name-${company.id}`}
          title={company.name}
        >
          <span className="block truncate">{company.name}</span>
        </h3>

        {/* Contact count */}
        <div className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
          <Users className="w-3 h-3 shrink-0" />
          <span>{contactCount} contact{contactCount !== 1 ? "s" : ""}</span>
        </div>

        {/* Domain */}
        {company.domain && (
          <div className="mt-1.5 min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground max-w-full">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate">{company.domain}</span>
            </span>
          </div>
        )}

        {/* Secondary actions (Org, Note) */}
        {hasSecondaryActions && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-black/[0.06]">
            {onOpenOrg && (
              <button
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenOrg();
                }}
                style={{ touchAction: "manipulation" }}
                aria-label="View organization chart"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Org</span>
              </button>
            )}
            {onAddNote && (
              <button
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNote();
                }}
                style={{ touchAction: "manipulation" }}
                aria-label="Add note"
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>Note</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
