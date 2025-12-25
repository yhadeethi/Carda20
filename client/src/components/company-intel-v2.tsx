import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  TrendingUp,
  TrendingDown,
  Briefcase,
  Calendar,
  User,
  Target,
  Zap,
  DollarSign,
  Phone,
  Landmark,
  Loader2,
} from "lucide-react";
import { SiLinkedin, SiX, SiFacebook, SiInstagram } from "react-icons/si";
import { motion } from "framer-motion";

interface CompanyIntelV2CardProps {
  intel: CompanyIntelV2 | null;
  isLoading: boolean;
  isBoosting?: boolean;
  error: string | null;
  onRefresh: () => void;
  onBoost?: (domain: string) => Promise<boolean>;
  companyName?: string | null;
}

export function CompanyIntelV2Card({
  intel,
  isLoading,
  isBoosting = false,
  error,
  onRefresh,
  onBoost,
  companyName,
}: CompanyIntelV2CardProps) {
  const [showBoostConfirm, setShowBoostConfirm] = useState(false);

  const handleBoostClick = () => {
    setShowBoostConfirm(true);
  };

  const handleBoostConfirm = async () => {
    setShowBoostConfirm(false);
    if (intel?.website && onBoost) {
      await onBoost(intel.website);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Card className="glass-subtle">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center intel-loading">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Gathering Intel...</div>
                <p className="text-xs text-muted-foreground">
                  {companyName ? `Researching ${companyName}` : "Researching company"}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
              <Skeleton className="h-24 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
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
    <div className="space-y-3">
      {/* SECTION 1: Company Profile */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass-subtle overflow-hidden">
          <CardContent className="py-4 space-y-3">
            {/* Header with company name and refresh */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{intel.companyName}</h3>
                  {intel.website && (
                    <a
                      href={`https://${intel.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      data-testid="link-website"
                    >
                      <Globe className="w-3 h-3" />
                      {intel.website}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{lastUpdated}</span>
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

            {/* Company Summary */}
            {intel.summary && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {intel.summary}
              </p>
            )}

            {/* Social Media Icons */}
            {hasSocialLinks && (
              <div className="flex items-center gap-2 pt-1">
                {intel.linkedinUrl && (
                  <a
                    href={intel.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 flex items-center justify-center transition-colors"
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
                    className="w-9 h-9 rounded-lg bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
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
                    className="w-9 h-9 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2]/20 flex items-center justify-center transition-colors"
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
                    className="w-9 h-9 rounded-lg bg-[#E4405F]/10 hover:bg-[#E4405F]/20 flex items-center justify-center transition-colors"
                    data-testid="link-instagram"
                  >
                    <SiInstagram className="w-4 h-4 text-[#E4405F]" />
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SECTION 2: Quick Visual Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-2"
      >
        {/* Stock Price Card - only show if we have a valid price */}
        {intel.stock && intel.stock.price !== null && intel.stock.price !== undefined && (
          <Card className="glass-subtle">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                {intel.stock.changePercent !== null && intel.stock.changePercent !== undefined && intel.stock.changePercent >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                ) : intel.stock.changePercent !== null && intel.stock.changePercent !== undefined ? (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-[10px] uppercase tracking-wide font-medium">Stock</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold">
                  {intel.stock.currency === "USD" ? "$" : (intel.stock.currency || "")}{intel.stock.price.toFixed(2)}
                </span>
                {intel.stock.changePercent !== null && intel.stock.changePercent !== undefined && (
                  <Badge 
                    variant="secondary" 
                    className={`text-[10px] px-1.5 py-0 ${
                      intel.stock.changePercent >= 0 
                        ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {intel.stock.changePercent >= 0 ? "+" : ""}{intel.stock.changePercent.toFixed(2)}%
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {intel.stock.ticker} {intel.stock.exchange && `• ${intel.stock.exchange}`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Headcount Card */}
        {intel.headcount && (
          <Card className="glass-subtle">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wide font-medium">Headcount</span>
              </div>
              <p className="text-lg font-bold">{intel.headcount.range}</p>
              <p className="text-[10px] text-muted-foreground">employees</p>
            </CardContent>
          </Card>
        )}

        {/* Industry Card */}
        {intel.industry && (
          <Card className="glass-subtle">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wide font-medium">Industry</span>
              </div>
              <p className="text-sm font-medium leading-tight">{intel.industry}</p>
            </CardContent>
          </Card>
        )}

        {/* HQ Location Card */}
        {intel.hq && (
          <Card className="glass-subtle">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wide font-medium">HQ</span>
              </div>
              <p className="text-sm font-medium">
                {intel.hq.city}{intel.hq.country ? `, ${intel.hq.country}` : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Founder/CEO Card */}
        {intel.founderOrCeo && (
          <Card className="glass-subtle">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wide font-medium">CEO</span>
              </div>
              <p className="text-sm font-medium truncate">{intel.founderOrCeo}</p>
            </CardContent>
          </Card>
        )}

        {/* Founded Card */}
        {intel.founded && (
          <Card className="glass-subtle">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wide font-medium">Founded</span>
              </div>
              <p className="text-lg font-bold">{intel.founded}</p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* SECTION 3: Recent News */}
      {intel.latestSignals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-subtle">
            <CardContent className="py-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <Newspaper className="w-3.5 h-3.5" />
                Recent News
              </h4>
              <ul className="space-y-2">
                {intel.latestSignals.slice(0, 4).map((signal, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.03 }}
                  >
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2.5 p-2.5 rounded-lg hover-elevate bg-muted/30"
                      data-testid={`news-item-${i}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2 group-hover:text-primary transition-colors">
                          {signal.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{signal.date}</span>
                          <span>•</span>
                          <span className="truncate">{signal.sourceName}</span>
                        </div>
                      </div>
                    </a>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* SECTION 4: Key Competitors */}
      {intel.competitors && intel.competitors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass-subtle">
            <CardContent className="py-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <Target className="w-3.5 h-3.5" />
                Key Competitors
              </h4>
              <div className="space-y-2">
                {intel.competitors.map((competitor, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.03 }}
                    className="p-2.5 rounded-lg bg-muted/30"
                    data-testid={`competitor-${i}`}
                  >
                    <p className="text-sm font-medium">{competitor.name}</p>
                    {competitor.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {competitor.description}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* SECTION 5: Apollo Boosted Data (only show if boosted) */}
      {intel.isBoosted && (intel.revenue || intel.funding || intel.primaryPhone) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-subtle border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 gap-1">
                  <Zap className="w-3 h-3" />
                  Boosted Intel
                </Badge>
                {intel.boostedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(intel.boostedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Revenue */}
                {intel.revenue && (
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Annual Revenue</p>
                      <p className="text-sm font-medium">{intel.revenue}</p>
                    </div>
                  </div>
                )}

                {/* Funding */}
                {intel.funding && (intel.funding.totalRaised || intel.funding.latestRound) && (
                  <div className="flex items-start gap-2">
                    <Landmark className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Funding</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {intel.funding.totalRaised && (
                          <span className="text-sm font-medium">{intel.funding.totalRaised}</span>
                        )}
                        {intel.funding.latestRound && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {intel.funding.latestRound}
                          </Badge>
                        )}
                      </div>
                      {intel.funding.investors && intel.funding.investors.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {intel.funding.investors.slice(0, 3).join(", ")}
                          {intel.funding.investors.length > 3 && ` +${intel.funding.investors.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Phone */}
                {intel.primaryPhone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Primary Phone</p>
                      <a 
                        href={`tel:${intel.primaryPhone}`}
                        className="text-sm font-medium text-primary hover:underline"
                        data-testid="link-phone"
                      >
                        {intel.primaryPhone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* SECTION 6: Boost Intel Button (only show if not boosted and has website) */}
      {!intel.isBoosted && intel.website && onBoost && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-subtle border-dashed">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Boost Intel</p>
                    <p className="text-xs text-muted-foreground">
                      Get revenue, funding, and phone data
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBoostClick}
                  disabled={isBoosting}
                  className="gap-1.5"
                  data-testid="button-boost-intel"
                >
                  {isBoosting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Boosting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Boost
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {intel.latestSignals.length === 0 && !intel.hq && !intel.headcount && !intel.summary && (
        <Card className="glass-subtle">
          <CardContent className="py-6">
            <div className="text-center text-muted-foreground text-sm">
              <Building2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>Limited information available</p>
              {intel.error && <p className="text-xs mt-1">{intel.error}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Boost Confirmation Dialog */}
      <AlertDialog open={showBoostConfirm} onOpenChange={setShowBoostConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Boost Company Intel?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will use <strong>1 Apollo credit</strong> to fetch additional company data including:
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Annual revenue estimates</li>
                <li>• Funding history and investors</li>
                <li>• Primary contact phone number</li>
                <li>• Additional company details</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Free tier includes 100 credits per month.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBoostConfirm} className="gap-1.5">
              <Zap className="w-4 h-4" />
              Use 1 Credit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
