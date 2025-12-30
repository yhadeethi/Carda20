/**
 * CompanyTile - Premium company card (UI refresh) with logo support
 * Single-tap opens company - secondary actions shown as icon buttons
 * Logic unchanged (props/callbacks preserved)
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
      {/* Top row: avatar + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <CompanyAvatar
            name={company.name}
            domain={company.domain}
            contactEmails={contactEmails}
            size="md"
            className="shrink-0"
          />

          <div className="min-w-0">
            {/* Company name */}
            <div
              className="font-semibold leading-5 truncate"
              title={company.name}
              data-testid={`company-tile-name-${company.id}`}
            >
              {company.name}
            </div>

            {/* Secondary row: contact count + domain */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="rounded-full">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {contactCount} contact{contactCount !== 1 ? "s" : ""}
                </span>
              </Badge>

              {company.domain ? (
                <span
                  className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1 max-w-[180px]"
                  title={company.domain}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span className="truncate">{company.domain}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Kebab menu for secondary actions (keeps UI clean) */}
        {(onOpenOrg || onAddNote) ? (
          <div onClick={(e) => e.stopPropagation()}>
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
                  <DropdownMenuItem
                    onClick={() => onOpenOrg()}
                    data-testid={`company-open-org-${company.id}`}
                  >
                    <Network className="w-4 h-4 mr-2" />
                    Open org map
                  </DropdownMenuItem>
                ) : null}

                {onAddNote ? (
                  <>
                    {onOpenOrg ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      onClick={() => onAddNote()}
                      data-testid={`company-add-note-${company.id}`}
                    >
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

      {/* Optional quick actions row (tap-friendly icons) */}
      {(onOpenOrg || onAddNote) ? (
        <div
          className="mt-4 pt-3 border-t flex items-center justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-muted-foreground">
            Quick actions
          </div>

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
