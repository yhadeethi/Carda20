/**
 * CompanyTile - Premium company card with hardening against overflow
 * Single-tap opens company. Secondary actions in kebab menu + optional quick buttons.
 * Logic unchanged (same props, same callbacks).
 */

import { Users, Globe, Network, StickyNote, MoreHorizontal } from "lucide-react";
import { Company } from "@/lib/companiesStorage";
import { CompanyAvatar } from "./CompanyAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const hasActions = Boolean(onOpenOrg || onAddNote);

  return (
    <div
      className="relative rounded-2xl border bg-card p-4 cursor-pointer transition hover:bg-muted/30 shadow-sm active:scale-[0.99]"
      onClick={onClick}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      data-testid={`company-tile-${company.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        {/* Left stack must be min-w-0 for truncation */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <CompanyAvatar
            name={company.name}
            domain={company.domain}
            contactEmails={contactEmails}
            size="md"
            className="shrink-0"
          />

          <div className="min-w-0 flex-1">
            {/* Company name – clamp to avoid height blowups */}
            <div
              className="font-semibold leading-5 line-clamp-2"
              title={company.name}
              data-testid={`company-tile-name-${company.id}`}
            >
              {company.name}
            </div>

            {/* Meta row */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="rounded-full">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {contactCount} contact{contactCount !== 1 ? "s" : ""}
                </span>
              </Badge>

              {company.domain ? (
                <span
                  className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1 max-w-[220px]"
                  title={company.domain}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span className="truncate">{company.domain}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions menu */}
        {hasActions ? (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl opacity-70 hover:opacity-100"
                  aria-label="Company actions"
                  data-testid={`company-actions-${company.id}`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {onOpenOrg ? (
                  <DropdownMenuItem onClick={() => onOpenOrg()} data-testid={`company-open-org-${company.id}`}>
                    <Network className="w-4 h-4 mr-2" />
                    Open org map
                  </DropdownMenuItem>
                ) : null}

                {onAddNote ? (
                  <>
                    {onOpenOrg ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem onClick={() => onAddNote()} data-testid={`company-add-note-${company.id}`}>
                      <StickyNote className="w-4 h-4 mr-2" />
                      Add note
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {/* Quick actions row (optional) – consistent placement; won't overflow */}
      {hasActions ? (
        <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-muted-foreground">Quick</div>
          <div className="flex items-center gap-2">
            {onOpenOrg ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl h-9"
                onClick={() => onOpenOrg()}
                data-testid={`company-quick-org-${company.id}`}
              >
                <Network className="w-4 h-4 mr-2" />
                Org
              </Button>
            ) : null}
            {onAddNote ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl h-9"
                onClick={() => onAddNote()}
                data-testid={`company-quick-note-${company.id}`}
              >
                <StickyNote className="w-4 h-4 mr-2" />
                Note
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
