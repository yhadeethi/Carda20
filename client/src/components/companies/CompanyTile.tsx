/**
 * CompanyTile - Clean, minimal company tile with logo support
 * Single-tap opens company - secondary actions shown inline at bottom
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

export function CompanyTile({ company, contactCount, contactEmails = [], onClick, onOpenOrg, onAddNote }: CompanyTileProps) {
  return (
    <div
      className="relative p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] active:shadow-sm group"
      onClick={onClick}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      data-testid={`company-tile-${company.id}`}
    >
      {/* Logo using shared CompanyAvatar with full fallback chain */}
      <CompanyAvatar 
        name={company.name} 
        domain={company.domain} 
        contactEmails={contactEmails}
        size="md" 
        className="mb-3" 
      />

      {/* Company name */}
      <h3 className="font-medium text-sm truncate mb-1" data-testid={`company-tile-name-${company.id}`}>
        {company.name}
      </h3>

      {/* Contact count */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="w-3 h-3" />
        <span>{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Domain */}
      {company.domain && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
          <Globe className="w-3 h-3 shrink-0" />
          <span className="truncate">{company.domain}</span>
        </div>
      )}

      {/* Quick actions - always visible as small text links */}
      {(onOpenOrg || onAddNote) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          {onOpenOrg && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); onOpenOrg(); }}
              style={{ touchAction: 'manipulation' }}
            >
              <Network className="w-3 h-3" />
              <span>Org</span>
            </button>
          )}
          {onAddNote && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); onAddNote(); }}
              style={{ touchAction: 'manipulation' }}
            >
              <StickyNote className="w-3 h-3" />
              <span>Note</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
