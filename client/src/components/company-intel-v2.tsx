import { useMemo, useState } from "react";
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

function toWebsiteUrl(website: string): string {
  const w = website.trim();
  if (!w) return "#";
  if (w.startsWith("http://") || w.startsWith("https://")) return w;
  return `https://${w}`;
}

function compactDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "";
  }
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

  const hasSocialLinks = !!(
    intel?.linkedinUrl ||
    intel?.twitterUrl ||
    intel?.facebookUrl ||
    intel?.instagramUrl
  );

  const lastUpdated = useMemo(() => {
    if (!intel?.lastRefreshedAt) return "";
    return compactDate(intel.lastRefreshedAt as any);
  }, [intel?.lastRefreshedAt]);

  const stats = useMemo(() => {
    if (!intel) return [];

    const items: Array<{
      key: string;
      label: string;
      value: string;
      sub?: string;
      icon: JSX.Element;
    }> = [];

    if (intel.stock && intel.stock.price !== null && intel.stock.price !== undefined) {
      const currencyPrefix = intel.stock.currency === "USD" ? "$" : (intel.stock.currency || "");
      const v = `${currencyPrefix}${intel.stock.price.toFixed(2)}`;
      const change =
        intel.stock.changePercent !== null && intel.stock.changePercent !== undefined
          ? `${intel.stock.changePercent >= 0 ? "+" : ""}${intel.stock.changePercent.toFixed(2)}%`
          : "";
      const up =
        intel.stock.changePercent !== null &&
        intel.stock.changePercent !== undefined &&
        intel.stock.changePercent >= 0;

      items.push({
        key: "stock",
        label: "Stock",
        value: v,
        sub: change ? `${intel.stock.ticker}${intel.stock.exchange ? ` • ${intel.stock.exchange}` : ""}` : `${intel.stock.ticker}`,
        icon: up ? (
          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        ),
      });
    }

    if (intel.headcount?.range) {
      items.push({
        key: "headcount",
        label: "Headcount",
        value: intel.headcount.range,
        sub: "employees",
        icon: <Users className="w-3.5 h-3.5" />,
      });
    }

    if (intel.industry) {
      items.push({
        key: "industry",
        label: "Industry",
        value: intel.industry,
        icon: <Briefcase className="w-3.5 h-3.5" />,
      });
    }

    if (intel.hq?.city) {
      items.push({
        key: "hq",
        label: "HQ",
        value: `${intel.hq.city}${intel.hq.country ? `, ${intel.hq.country}` : ""}`,
        icon: <MapPin className="w-3.5 h-3.5" />,
      });
    }

    if (intel.founderOrCeo) {
      items.push({
        key: "ceo",
        label: "CEO",
        value: intel.founderOrCeo,
        icon: <User className="w-3.5 h-3.5" />,
      });
    }

    if (intel.founded) {
      items.push({
        key: "founded",
        label: "Founded",
        value: String(intel.founded),
        icon: <Calendar className="w-3.5 h-3.5" />,
      });
    }

    return items;
  }, [intel]);

  const handleBoostConfirm = async () => {
    setShowBoostConfirm(false);
    if (intel?.website && onBoost) {
      await onBoost(intel.website);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Card className="glass-subtle">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center intel-loading">
                <Sparkles className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Gathering Intel…</div>
                <p className="text-xs text-muted-foreground">
                  {companyName ? `Researching ${companyName}` : "Researching company"}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-14 rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !intel) {
    return (
      <Card className="glass-subtle border-destructive/50">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-2 text-center">
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

  return (
    <div className="space-y-2">
      {/* SECTION 1: Company Profile (denser + iOS-ish) */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-subtle overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4.5 h-4.5 text-primary" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-semibold text-base leading-tight truncate">
                    {intel.companyName}
                  </h3>

                  {intel.website && (
                    <a
                      href={toWebsiteUrl(intel.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 text-xs text-primary/90 hover:text-primary hover:underline inline-flex items-center gap-1 truncate"
                      data-testid="link-website"
                    >
                      <Globe className="w-3 h-3" />
                      <span className="truncate">{intel.website}</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground">{lastUpdated}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={onRefresh}
                  data-testid="button-refresh-intel"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {intel.summary && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {intel.summary}
              </p>
            )}

            {hasSocialLinks && (
              <div className="mt-2 flex items-center gap-2">
                {intel.linkedinUrl && (
                  <a
                    href={intel.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-white/10 flex items-center justify-center transition-colors"
                    data-testid="link-linkedin"
                    aria-label="LinkedIn"
                  >
                    <SiLinkedin className="w-4 h-4 text-[#0A66C2]" />
                  </a>
                )}
                {intel.twitterUrl && (
                  <a
                    href={intel.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-white/10 flex items-center justify-center transition-colors"
                    data-testid="link-twitter"
                    aria-label="X"
                  >
                    <SiX className="w-4 h-4" />
                  </a>
                )}
                {intel.facebookUrl && (
                  <a
                    href={intel.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-white/10 flex items-center justify-center transition-colors"
                    data-testid="link-facebook"
                    aria-label="Facebook"
                  >
                    <SiFacebook className="w-4 h-4 text-[#1877F2]" />
                  </a>
                )}
                {intel.instagramUrl && (
                  <a
                    href={intel.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-white/10 flex items-center justify-center transition-colors"
                    data-testid="link-instagram"
                    aria-label="Instagram"
                  >
                    <SiInstagram className="w-4 h-4 text-[#E4405F]" />
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SECTION 2: Quick Stats (auto, compact) */}
      {stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-2"
        >
          {stats.slice(0, 6).map((s) => (
            <Card key={s.key} className="glass-subtle">
              <CardContent className="p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {s.icon}
                  <span className="text-[10px] uppercase tracking-wide font-medium">{s.label}</span>
                </div>

                <div className="mt-1">
                  <div className="text-sm font-semibold leading-tight line-clamp-2">
                    {s.value}
                  </div>
                  {s.sub && <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.sub}</div>}
                </div>

                {/* optional stock badge */}
                {s.key === "stock" &&
                  intel.stock &&
                  intel.stock.changePercent !== null &&
                  intel.stock.changePercent !== undefined && (
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${
                          intel.stock.changePercent >= 0
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {intel.stock.changePercent >= 0 ? "+" : ""}
                        {intel.stock.changePercent.toFixed(2)}%
                      </Badge>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* SECTION 3: Recent News (tight list) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-subtle">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" />
                Recent News
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 rounded-xl text-xs"
                onClick={onRefresh}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Refresh
              </Button>
            </div>

            {intel.latestSignals && intel.latestSignals.length > 0 ? (
              <div className="divide-y divide-white/10">
                {intel.latestSignals.slice(0, 4).map((signal, i) => (
                  <a
                    key={i}
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 py-2 group"
                    data-testid={`news-item-${i}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {signal.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{signal.date}</span>
                        <span>•</span>
                        <span className="truncate">{signal.sourceName}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/25 border border-white/10 rounded-xl p-3">
                No recent news found (or the feed didn’t return results).
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SECTION 4: Competitors (chips + expandable detail) */}
      {intel.competitors && intel.competitors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass-subtle">
            <CardContent className="p-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5" />
                Competitors
              </h4>

              <div className="flex flex-wrap gap-2">
                {intel.competitors.slice(0, 8).map((c, i) => {
                  const hasDesc = !!c.description?.trim();
                  return (
                    <div key={i} className="max-w-full">
                      {hasDesc ? (
                        <details className="group">
                          <summary className="cursor-pointer list-none">
                            <span className="inline-flex items-center rounded-xl border border-white/10 bg-muted/25 px-3 py-1 text-sm font-medium">
                              {c.name}
                            </span>
                          </summary>
                          <div className="mt-1 max-w-[420px] rounded-xl border border-white/10 bg-muted/20 p-2 text-xs text-muted-foreground">
                            {c.description}
                          </div>
                        </details>
                      ) : (
                        <span className="inline-flex items-center rounded-xl border border-white/10 bg-muted/25 px-3 py-1 text-sm font-medium">
                          {c.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* SECTION 5: Boosted Data (compact grid) */}
      {intel.isBoosted && (intel.revenue || intel.funding || intel.primaryPhone) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-subtle border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary text-[10px] px-2 py-0 gap-1 rounded-xl"
                  >
                    <Zap className="w-3 h-3" />
                    Boosted
                  </Badge>
                  {intel.boostedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {compactDate(intel.boostedAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {intel.revenue && (
                  <div className="rounded-xl border border-white/10 bg-muted/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[10px] uppercase tracking-wide font-medium">Revenue</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold">{intel.revenue}</div>
                  </div>
                )}

                {intel.primaryPhone && (
                  <div className="rounded-xl border border-white/10 bg-muted/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase tracking-wide font-medium">Phone</span>
                    </div>
                    <a
                      href={`tel:${intel.primaryPhone}`}
                      className="mt-1 block text-sm font-semibold text-primary hover:underline"
                      data-testid="link-phone"
                    >
                      {intel.primaryPhone}
                    </a>
                  </div>
                )}

                {intel.funding && (intel.funding.totalRaised || intel.funding.latestRound) && (
                  <div className="col-span-2 rounded-xl border border-white/10 bg-muted/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Landmark className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] uppercase tracking-wide font-medium">Funding</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {intel.funding.totalRaised && (
                        <span className="text-sm font-semibold">{intel.funding.totalRaised}</span>
                      )}
                      {intel.funding.latestRound && (
                        <Badge variant="outline" className="text-[10px] py-0 rounded-xl">
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
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* SECTION 6: Boost button */}
      {!intel.isBoosted && intel.website && onBoost && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <Card className="glass-subtle border-dashed">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">Boost Intel</p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      Revenue, funding, phone
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBoostConfirm(true)}
                  disabled={isBoosting}
                  className="gap-1.5 rounded-xl"
                  data-testid="button-boost-intel"
                >
                  {isBoosting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Boosting…
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

      {/* Boost Confirmation */}
      <AlertDialog open={showBoostConfirm} onOpenChange={setShowBoostConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Boost Company Intel?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will use <strong>1 Apollo credit</strong> to fetch extra company data:
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Annual revenue estimates</li>
                <li>• Funding history and investors</li>
                <li>• Primary phone number</li>
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
