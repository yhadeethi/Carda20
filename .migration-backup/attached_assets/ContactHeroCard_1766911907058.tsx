import { Phone, Mail, Globe, ChevronRight, ExternalLink, MoreHorizontal, MapPin } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  linkedinUrl?: string;
  address?: string;
  lastTouchedAt?: string | Date;
  scannedAt?: string | Date;
  syncedToHubspot?: boolean;
}

interface ContactHeroCardProps {
  contact: Contact;
  onOpenWebsite?: () => void;
  onOpenLinkedIn?: () => void;
  onCall?: () => void;
  onEmail?: () => void;
  onMore?: () => void;
}

function getInitials(contact: Contact): string {
  if (contact.firstName && contact.lastName) {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  }
  if (contact.name) {
    const parts = contact.name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || "?";
  }
  return "?";
}

function getDisplayName(contact: Contact): string {
  if (contact.firstName && contact.lastName) {
    return `${contact.firstName} ${contact.lastName}`;
  }
  return contact.name || "Unknown";
}

function getRoleCompany(contact: Contact): string {
  const parts = [contact.title || contact.role, contact.company].filter(Boolean);
  return parts.join(" at ");
}

function formatRelativeTime(date: string | Date | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getLinkedInSearchUrl(contact: Contact): string {
  const firstName = contact.firstName || contact.name?.split(" ")[0] || "";
  const lastName = contact.lastName || contact.name?.split(" ").slice(1).join(" ") || "";
  const searchTerms = [firstName, lastName, contact.company || contact.role].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchTerms)}`;
}

function getMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

interface ActionRowProps {
  icon: typeof Phone;
  iconClassName?: string;
  label: string;
  value: string;
  onClick?: () => void;
  external?: boolean;
}

function ActionRow({ icon: Icon, iconClassName, label, value, onClick, external }: ActionRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 px-4 hover-elevate active-elevate-2 transition-all"
      data-testid={`row-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${iconClassName || "text-muted-foreground"}`} />
      <div className="flex-1 text-left min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      {external ? (
        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

export function ContactHeroCard({
  contact,
  onOpenWebsite,
  onOpenLinkedIn,
  onCall,
  onEmail,
  onMore,
}: ContactHeroCardProps) {
  const displayName = getDisplayName(contact);
  const roleCompany = getRoleCompany(contact);
  const initials = getInitials(contact);
  const lastTouched = formatRelativeTime(contact.lastTouchedAt);
  const scanned = formatRelativeTime(contact.scannedAt);

  const rows: ActionRowProps[] = [];

  if (contact.phone) {
    rows.push({
      icon: Phone,
      iconClassName: "text-green-500",
      label: "Phone",
      value: contact.phone,
      onClick: onCall,
    });
  }

  if (contact.email) {
    rows.push({
      icon: Mail,
      iconClassName: "text-blue-500",
      label: "Email",
      value: contact.email,
      onClick: onEmail,
    });
  }


  if (contact.address) {
    rows.push({
      icon: MapPin,
      iconClassName: "text-orange-500",
      label: "Address",
      value: contact.address,
      onClick: () => {
        window.open(getMapsUrl(contact.address!), "_blank", "noopener,noreferrer");
      },
      external: true,
    });
  }

  if (contact.linkedinUrl) {
    rows.push({
      icon: SiLinkedin,
      iconClassName: "text-[#0A66C2]",
      label: "LinkedIn",
      value: "View profile",
      onClick: onOpenLinkedIn,
      external: true,
    });
  } else {
    rows.push({
      icon: SiLinkedin,
      iconClassName: "text-muted-foreground",
      label: "LinkedIn",
      value: "Find on LinkedIn",
      onClick: () => {
        window.open(getLinkedInSearchUrl(contact), "_blank", "noopener,noreferrer");
      },
      external: true,
    });
  }

  if (contact.website) {
    rows.push({
      icon: Globe,
      iconClassName: "text-purple-500",
      label: "Website",
      value: contact.website.replace(/^https?:\/\//, ""),
      onClick: onOpenWebsite,
      external: true,
    });
  }

  const visibleRows = rows.slice(0, 4);
  const hasMore = rows.length > 4;

  return (
    <div
      className="rounded-2xl bg-background/50 backdrop-blur-xl border border-white/10 shadow-lg overflow-hidden"
      data-testid="contact-hero-card"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="w-14 h-14 shrink-0">
            <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold leading-tight" data-testid="text-hero-name">
              {displayName}
            </h2>
            {roleCompany && (
              <p className="text-sm text-muted-foreground leading-snug" data-testid="text-hero-role">
                {roleCompany}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {scanned && (
                <Badge variant="secondary" className="text-xs">
                  Scanned {scanned}
                </Badge>
              )}
              {contact.syncedToHubspot && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                  Synced
                </Badge>
              )}
              {lastTouched && (
                <Badge variant="outline" className="text-xs">
                  Last touched {lastTouched}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Rows */}
      <div className="divide-y divide-border/50">
        {visibleRows.map((row, index) => (
          <ActionRow key={index} {...row} />
        ))}
        {hasMore && onMore && (
          <ActionRow
            icon={MoreHorizontal}
            label="More"
            value="View all contact details"
            onClick={onMore}
          />
        )}
      </div>
    </div>
  );
}
