/**
 * CompanyTile - Clean, minimal company tile with logo support
 * Single-tap opens company - secondary actions shown inline at bottom
 */

import { useState } from "react";
import { Building2, Users, Globe, Network, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Company } from "@/lib/companiesStorage";

interface CompanyTileProps {
  company: Company;
  contactCount: number;
  onClick: () => void;
  onOpenOrg?: () => void;
  onAddNote?: () => void;
}

export function CompanyTile({ company, contactCount, onClick, onOpenOrg, onAddNote }: CompanyTileProps) {
  const [logoError, setLogoError] = useState(false);
  const [logoLoading, setLogoLoading] = useState(true);
  
  const monogram = company.name
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');

  // Use Google Favicon API for better reliability
  const logoUrl = company.domain && !logoError
    ? `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`
    : null;

  return (
    <div
      className="relative p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] active:shadow-sm group"
      onClick={onClick}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      data-testid={`company-tile-${company.id}`}
    >
      {/* Logo or Monogram */}
      <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border flex items-center justify-center mb-3 overflow-hidden">
        {logoUrl ? (
          <>
            {logoLoading && (
              <div className="w-8 h-8 rounded bg-muted animate-pulse" />
            )}
            <img
              src={logoUrl}
              alt={`${company.name} logo`}
              className={`w-8 h-8 object-contain ${logoLoading ? 'hidden' : ''}`}
              onLoad={() => setLogoLoading(false)}
              onError={() => { setLogoError(true); setLogoLoading(false); }}
              loading="lazy"
            />
          </>
        ) : monogram ? (
          <span className="text-sm font-semibold text-primary">{monogram}</span>
        ) : (
          <Building2 className="w-5 h-5 text-primary" />
        )}
      </div>

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
