import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CompanyIntelV2, VerifiedBullet, SignalItem, CompetitorItem } from "@shared/schema";
import {
  Building2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ExternalLink,
  MapPin,
  Users,
  TrendingUp,
  TrendingDown,
  Linkedin,
  BarChart3,
  Package,
  Briefcase,
  Target,
  Newspaper,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  Link2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface StockSparklineProps {
  series: Array<{ date: string; close: number }>;
  width?: number;
  height?: number;
  className?: string;
}

function StockSparkline({ series, width = 60, height = 20, className = "" }: StockSparklineProps) {
  if (!series || series.length < 2) return null;

  const prices = series.map((d) => d.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices
    .map((price, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = prices[prices.length - 1] >= prices[0];
  const strokeColor = isUp ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface HeadcountBarProps {
  range: string;
}

function HeadcountBar({ range }: HeadcountBarProps) {
  const rangeMap: Record<string, number> = {
    "1-10": 1, "11-50": 2, "51-200": 3, "201-500": 4,
    "501-1k": 5, "1k-5k": 6, "5k-10k": 7, "10k+": 8,
  };
  const level = rangeMap[range] || 3;

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-sm transition-colors ${
            i < level ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

interface SourceChipProps {
  title: string;
  url: string;
}

function SourceChip({ title, url }: SourceChipProps) {
  const domain = useMemo(() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return title;
    }
  }, [url, title]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-muted hover-elevate"
      data-testid={`source-chip-${domain}`}
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {domain}
    </a>
  );
}

interface SentimentBarProps {
  positive: number;
  neutral: number;
  negative: number;
}

function SentimentBar({ positive, neutral, negative }: SentimentBarProps) {
  const total = positive + neutral + negative;
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden">
        {positive > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${(positive / total) * 100}%` }}
          />
        )}
        {neutral > 0 && (
          <div
            className="bg-muted-foreground/30"
            style={{ width: `${(neutral / total) * 100}%` }}
          />
        )}
        {negative > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${(negative / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="text-green-600">+{positive}</span>
        <span>{neutral} neutral</span>
        <span className="text-red-600">-{negative}</span>
      </div>
    </div>
  );
}

interface CompanyIntelV2CardProps {
  intel: CompanyIntelV2 | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  companyName?: string | null;
}

export function CompanyIntelV2Card({
  intel,
  isLoading,
  error,
  onRefresh,
  companyName,
}: CompanyIntelV2CardProps) {
  const [activeTab, setActiveTab] = useState<"verified" | "signals">("verified");
  const [sourcesOpen, setSourcesOpen] = useState(false);

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
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
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

  return (
    <Card className="glass-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Company Intel</CardTitle>
              <p className="text-xs text-muted-foreground">{intel.companyName}</p>
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

      <CardContent className="space-y-4">
        {/* Dashboard: 4 Mini-Cards */}
        <div className="grid grid-cols-4 gap-2">
          {/* HQ Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="p-2 rounded-lg bg-muted/50 text-center"
          >
            <MapPin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            {intel.hq ? (
              <>
                <p className="text-[11px] font-medium truncate">{intel.hq.city || "—"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{intel.hq.country || ""}</p>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">Unknown</p>
            )}
          </motion.div>

          {/* Headcount Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-2 rounded-lg bg-muted/50 text-center"
          >
            <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            {intel.headcount ? (
              <>
                <p className="text-[11px] font-medium">{intel.headcount.range}</p>
                <HeadcountBar range={intel.headcount.range} />
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">Unknown</p>
            )}
          </motion.div>

          {/* LinkedIn Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-2 rounded-lg bg-muted/50 text-center"
          >
            <Linkedin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            {intel.linkedinUrl ? (
              <a
                href={intel.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Open
              </a>
            ) : (
              <p className="text-[10px] text-muted-foreground">Not found</p>
            )}
          </motion.div>

          {/* Stock Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-2 rounded-lg bg-muted/50 text-center"
          >
            <BarChart3 className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            {intel.stock ? (
              <>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[11px] font-medium">{intel.stock.ticker}</span>
                  {intel.stock.changePercent != null && (
                    intel.stock.changePercent >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    )
                  )}
                </div>
                <StockSparkline series={intel.stock.series} width={40} height={14} className="mx-auto" />
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">Private</p>
            )}
          </motion.div>
        </div>

        {/* Tabs: Verified / Signals */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="verified" data-testid="tab-intel-verified">Verified</TabsTrigger>
            <TabsTrigger value="signals" data-testid="tab-intel-signals">Signals</TabsTrigger>
          </TabsList>

          <TabsContent value="verified" className="mt-3 space-y-4">
            {/* Key Facts */}
            {intel.verifiedFacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Key Facts
                </h4>
                <ul className="space-y-1.5">
                  {intel.verifiedFacts.map((fact, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="text-sm flex items-start gap-2"
                    >
                      <span className="text-primary mt-1">•</span>
                      <span className="flex-1">{fact.text}</span>
                      <SourceChip title={fact.source.title} url={fact.source.url} />
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Offerings Matrix */}
            {intel.offerings && (intel.offerings.products.length > 0 || intel.offerings.services.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="w-3 h-3" />
                  Products & Services
                </h4>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="w-3 h-3" />
                      <span className="font-medium">Products</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {intel.offerings.products.map((p, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {p}
                        </Badge>
                      ))}
                      {intel.offerings.products.length === 0 && (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Briefcase className="w-3 h-3" />
                      <span className="font-medium">Services</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {intel.offerings.services.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {s}
                        </Badge>
                      ))}
                      {intel.offerings.services.length === 0 && (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Target className="w-3 h-3" />
                      <span className="font-medium">Buyers</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {intel.offerings.buyers?.map((b, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                          {b}
                        </Badge>
                      ))}
                      {(!intel.offerings.buyers || intel.offerings.buyers.length === 0) && (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Sources Drawer */}
            {intel.sources && intel.sources.length > 0 && (
              <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3 h-3" />
                      {intel.sources.length} Sources
                    </span>
                    {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {intel.sources.map((src, i) => (
                      <SourceChip key={i} title={src.title} url={src.url} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Empty state */}
            {intel.verifiedFacts.length === 0 && !intel.offerings && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <HelpCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                No verified facts found
              </div>
            )}
          </TabsContent>

          <TabsContent value="signals" className="mt-3 space-y-4">
            {/* Recent News */}
            {intel.latestSignals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Newspaper className="w-3 h-3" />
                  Recent News
                </h4>
                <ul className="space-y-2">
                  {intel.latestSignals.map((signal, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <a
                        href={signal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-muted/30 hover-elevate"
                        data-testid={`news-item-${i}`}
                      >
                        <p className="text-sm font-medium line-clamp-2">{signal.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{signal.date}</span>
                          <span>•</span>
                          <span>{signal.sourceName}</span>
                        </div>
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sentiment */}
            {intel.sentiment && (intel.sentiment.positive + intel.sentiment.neutral + intel.sentiment.negative > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Headline Sentiment
                </h4>
                <SentimentBar {...intel.sentiment} />
                <p className="text-[10px] text-muted-foreground text-center">
                  Based on recent headlines
                </p>
              </div>
            )}

            {/* Competitors */}
            {intel.competitors && intel.competitors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Competitors
                </h4>
                <ul className="space-y-1.5">
                  {intel.competitors.map((comp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="font-medium">{comp.name}</span>
                      {comp.verified ? (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">Verified</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 opacity-60">Inferred</Badge>
                      )}
                      {comp.description && (
                        <span className="text-muted-foreground text-xs ml-auto truncate max-w-[120px]">
                          {comp.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empty state */}
            {intel.latestSignals.length === 0 && (!intel.competitors || intel.competitors.length === 0) && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <Newspaper className="w-6 h-6 mx-auto mb-2 opacity-50" />
                No recent signals found
              </div>
            )}
          </TabsContent>
        </Tabs>

        {intel.error && (
          <p className="text-xs text-muted-foreground text-center italic">
            {intel.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
