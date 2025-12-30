/**
 * CompanyTile - Clean, minimal company tile with logo support
 * Single-tap opens company - secondary actions shown inline at bottom
 *
 * UI hardening:
 * - fixed layout overflow (long names/domains) with min-w-0 + truncation
 * - removed hover translate to prevent grid jitter
 * - ensured actions sit at bottom consistently
 */

import { Users, Globe, Network, StickyNote } from "lucide-react";
import { Company } from "@/lib/companiesStorage";
import { CompanyAvatar } from "./CompanyAvatar";

interface CompanyTileProps {
  company: Company;
  contactCount: number;
  contactEmails?: string[];
  onClick: () => void;
  onOpenOrg?: () => void;
  onAddNote?: () => void;
}

export function CompanyTile({
  company,
  contactCount,
  contactEmails = [],
  onClick,
  onOpenOrg,
  onAddNote,
}: CompanyTileProps) {
  const hasActions = !!onOpenOrg || !!onAddNote;

  return (
    <div
      className="relative h-full p-4 rounded-xl border bg-card cursor-pointer transition-shadow duration-200 hover:shadow-md active:scale-[0.99] group"
      onClick={onClick}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      data-testid={`company-tile-${company.id}`}
    >
      <div className="flex flex-col h-full min-w-0">
        {/* Logo */}
        <CompanyAvatar
          name={company.name}
          domain={company.domain}
          contactEmails={contactEmails}
          size="md"
          className="mb-3"
        />

        {/* Company name (allow 2 lines max) */}
        <h3
          className="font-medium text-sm leading-snug mb-1 min-w-0"
          data-testid={`company-tile-name-${company.id}`}
          title={company.name}
        >
          <span className="block truncate">{company.name}</span>
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5">
            <Users className="w-3 h-3" />
            <span>{contactCount} contact{contactCount !== 1 ? "s" : ""}</span>
          </span>
        </div>

        {company.domain && (
          <div className="mt-1 min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground max-w-full">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate">{company.domain}</span>
            </span>
          </div>
        )}

        {/* Spacer to push actions to bottom */}
        {hasActions && <div className="flex-1" />}

        {/* Quick actions */}
        {hasActions && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            {onOpenOrg && (
              <button
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenOrg();
                }}
                style={{ touchAction: "manipulation" }}
              >
                <Network className="w-3 h-3" />
                <span>Org</span>
              </button>
            )}
            {onAddNote && (
              <button
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNote();
                }}
                style={{ touchAction: "manipulation" }}
              >
                <StickyNote className="w-3 h-3" />
                <span>Note</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
