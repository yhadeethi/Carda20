/**
 * CompanyTile - Clean, minimal company tile with logo support
 */

import { useState } from "react";
import { Building2, MoreHorizontal, Users, Globe, Network, StickyNote } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  
  const monogram = company.name
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');

  // Use Clearbit Logo API if domain is available
  const logoUrl = company.domain && !logoError
    ? `https://logo.clearbit.com/${company.domain}`
    : null;

  return (
    <div
      className="relative p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] active:shadow-sm group"
      onClick={onClick}
      data-testid={`company-tile-${company.id}`}
    >
      {/* Quick action menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            data-testid={`company-menu-${company.id}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <Building2 className="w-4 h-4 mr-2" />
            Open Company
          </DropdownMenuItem>
          {onOpenOrg && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenOrg(); }}>
              <Network className="w-4 h-4 mr-2" />
              Open Org
            </DropdownMenuItem>
          )}
          {onAddNote && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddNote(); }}>
              <StickyNote className="w-4 h-4 mr-2" />
              Add Note
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logo or Monogram */}
      <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border flex items-center justify-center mb-3 overflow-hidden">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${company.name} logo`}
            className="w-8 h-8 object-contain"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setLogoError(true)}
            loading="lazy"
          />
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
    </div>
  );
}
