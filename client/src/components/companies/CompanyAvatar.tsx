/**
 * CompanyAvatar - Reusable company logo component with fallbacks
 * Used in both CompanyTile and CompanyDetail
 */

import { useState } from "react";
import { Building2 } from "lucide-react";
import { extractDomainFromEmail } from "@/lib/companiesStorage";

interface CompanyAvatarProps {
  name: string;
  domain?: string | null;
  website?: string | null;
  contactEmails?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CONFIG = {
  sm: { container: "w-8 h-8", image: "w-6 h-6", icon: "w-4 h-4", text: "text-xs" },
  md: { container: "w-10 h-10", image: "w-8 h-8", icon: "w-5 h-5", text: "text-sm" },
  lg: { container: "w-12 h-12", image: "w-10 h-10", icon: "w-6 h-6", text: "text-lg" },
};

function getMostCommonEmailDomain(emails: string[]): string | null {
  if (!emails.length) return null;
  const domainCounts: Record<string, number> = {};
  for (const email of emails) {
    const domain = extractDomainFromEmail(email);
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  }
  let bestDomain: string | null = null;
  let bestCount = 0;
  for (const domain of Object.keys(domainCounts)) {
    if (domainCounts[domain] > bestCount) {
      bestDomain = domain;
      bestCount = domainCounts[domain];
    }
  }
  return bestDomain;
}

function extractDomainFromWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function CompanyAvatar({ name, domain, website, contactEmails = [], size = "md", className = "" }: CompanyAvatarProps) {
  const [logoError, setLogoError] = useState(false);
  const [logoLoading, setLogoLoading] = useState(true);

  // Fallback order: domain -> website -> email domain
  const effectiveDomain = domain || extractDomainFromWebsite(website) || getMostCommonEmailDomain(contactEmails);

  const logoUrl = effectiveDomain && !logoError
    ? `https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=128`
    : null;

  const monogram = name
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');

  const { container, image, icon, text } = SIZE_CONFIG[size];

  return (
    <div className={`${container} rounded-lg bg-white dark:bg-gray-800 border flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
      {logoUrl ? (
        <>
          {logoLoading && (
            <div className={`${image} rounded bg-muted animate-pulse`} />
          )}
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className={`${image} object-contain ${logoLoading ? 'hidden' : ''}`}
            onLoad={() => setLogoLoading(false)}
            onError={() => { setLogoError(true); setLogoLoading(false); }}
            loading="lazy"
          />
        </>
      ) : monogram ? (
        <span className={`${text} font-semibold text-primary`}>{monogram}</span>
      ) : (
        <Building2 className={`${icon} text-primary`} />
      )}
    </div>
  );
}
