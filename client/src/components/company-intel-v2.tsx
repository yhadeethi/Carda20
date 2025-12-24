import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompanyIntelV2 } from "@shared/schema";
import {
  Building2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ExternalLink,
  MapPin,
  Users,
  Globe,
  Newspaper,
} from "lucide-react";
import { SiLinkedin, SiX, SiFacebook, SiInstagram } from "react-icons/si";
import { motion } from "framer-motion";

interface NetworkContact {
  id: string;
  fullName?: string | null;
  jobTitle?: string | null;
}

interface CompanyIntelV2CardProps {
  intel: CompanyIntelV2 | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  companyName?: string | null;
  networkContacts?: NetworkContact[];
}

export function CompanyIntelV2Card({
  intel,
  isLoading,
  error,
  onRefresh,
  companyName,
  networkContacts = [],
}: CompanyIntelV2CardProps) {
  if (isLoading) {
    return (
      <Card className="glass-subtle">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center intel-loading">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Gathering Intel...</CardTitle>
              <p className="text-xs text-muted-foreground">
                {companyName ? `Researching ${companyName}` : "Researching company"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !intel) {
    return (
      <Card className="glass-subtle border-destructive/50">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Intel unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5">
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!intel) return null;

  const lastUpdated = new Date(intel.lastRefreshedAt).toLocaleDateString();

  const hasSocialLinks = intel.linkedinUrl || intel.twitterUrl || intel.facebookUrl || intel.instagramUrl;

  return (
    <Card className="glass-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{intel.companyName}</CardTitle>
              {intel.website && (
                <a
                  href={`https://${intel.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  {intel.website}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Updated {lastUpdated}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              data-testid="button-refresh-intel"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Section 1: Company Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Social Media Icons */}
          {hasSocialLinks && (
            <div className="flex items-center gap-2">
              {intel.linkedinUrl && (
                <a
                  href={intel.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 flex items-center justify-center transition-colors"
                  data-testid="link-linkedin"
                >
                  <SiLinkedin className="w-4 h-4 text-[#0A66C2]" />
                </a>
              )}
              {intel.twitterUrl && (
                <a
                  href={intel.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
                  data-testid="link-twitter"
                >
                  <SiX className="w-4 h-4" />
                </a>
              )}
              {intel.facebookUrl && (
                <a
                  href={intel.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2]/20 flex items-center justify-center transition-colors"
                  data-testid="link-facebook"
                >
                  <SiFacebook className="w-4 h-4 text-[#1877F2]" />
                </a>
              )}
              {intel.instagramUrl && (
                <a
                  href={intel.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#E4405F]/10 hover:bg-[#E4405F]/20 flex items-center justify-center transition-colors"
                  data-testid="link-instagram"
                >
                  <SiInstagram className="w-4 h-4 text-[#E4405F]" />
                </a>
              )}
            </div>
          )}

          {/* Company Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* HQ Location */}
            <div className="p-2.5 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <MapPin className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wide font-medium">HQ</span>
              </div>
              {intel.hq ? (
                <p className="text-sm font-medium">
                  {intel.hq.city}{intel.hq.country ? `, ${intel.hq.country}` : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Unknown</p>
              )}
            </div>

            {/* Company Size */}
            <div className="p-2.5 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Users className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wide font-medium">Size</span>
              </div>
              {intel.headcount ? (
                <p className="text-sm font-medium">{intel.headcount.range} employees</p>
              ) : (
                <p className="text-sm text-muted-foreground">Unknown</p>
              )}
            </div>
          </div>

          {/* Local Branch (if different from HQ) */}
          {intel.localBranch && (
            <div className="p-2.5 rounded-lg bg-accent/30 border border-accent/50">
              <div className="flex items-center gap-1.5 text-accent-foreground mb-1">
                <MapPin className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wide font-medium">Local Office</span>
              </div>
              <p className="text-sm">
                {intel.localBranch.city || intel.localBranch.address}
              </p>
            </div>
          )}
        </motion.div>

        {/* Section 2: What's Happening (News) */}
        {intel.latestSignals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Newspaper className="w-3 h-3" />
              What's Happening
            </h4>
            <ul className="space-y-2">
              {intel.latestSignals.slice(0, 4).map((signal, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <a
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 p-2 rounded-lg hover-elevate"
                    data-testid={`news-item-${i}`}
                  >
                    <ExternalLink className="w-3 h-3 mt-1 text-muted-foreground group-hover:text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {signal.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span>{signal.date}</span>
                        <span>•</span>
                        <span>{signal.sourceName}</span>
                      </div>
                    </div>
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Section 3: Your Network There */}
        {networkContacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Your Network There
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                {networkContacts.length}
              </Badge>
            </h4>
            <div className="flex flex-wrap gap-2">
              {networkContacts.slice(0, 6).map((contact, i) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  data-testid={`network-contact-${contact.id}`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {(contact.fullName || "?").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate max-w-[120px]">
                      {contact.fullName || "Unknown"}
                    </p>
                    {contact.jobTitle && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {contact.jobTitle}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {networkContacts.length > 6 && (
                <div className="flex items-center justify-center px-3 text-xs text-muted-foreground">
                  +{networkContacts.length - 6} more
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {intel.latestSignals.length === 0 && networkContacts.length === 0 && !intel.hq && !intel.headcount && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Building2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>Limited information available</p>
            {intel.error && <p className="text-xs mt-1">{intel.error}</p>}
          </div>
        )}

        {intel.error && intel.latestSignals.length > 0 && (
          <p className="text-xs text-muted-foreground text-center italic">
            {intel.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
