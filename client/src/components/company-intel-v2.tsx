import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyIntelV2 } from "@shared/schema";
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
  MessageSquare,
  HelpCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { useState, useMemo } from "react";

interface StockSparklineProps {
  series: Array<{ date: string; close: number }>;
  width?: number;
  height?: number;
  className?: string;
}

function StockSparkline({ series, width = 80, height = 24, className = "" }: StockSparklineProps) {
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
    "1-10": 1,
    "11-50": 2,
    "51-200": 3,
    "201-500": 4,
    "501-1k": 5,
    "1k-5k": 6,
    "5k-10k": 7,
    "10k+": 8,
  };

  const level = rangeMap[range] || 3;
  const segments = 8;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-sm transition-colors ${
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
  const [activeTab, setActiveTab] = useState<"verified" | "coaching">("verified");

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
          <div className="flex gap-3">
            <Skeleton className="h-16 w-20 rounded-lg" />
            <Skeleton className="h-16 w-20 rounded-lg" />
            <Skeleton className="h-16 w-20 rounded-lg" />
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

  if (error) {
    return (
      <Card className="glass-subtle border-destructive/20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium">Unable to gather intel</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onRefresh}
              className="gap-2"
              data-testid="button-retry-intel-v2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!intel) {
    return null;
  }

  const formatChangePercent = (pct: number) => {
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  };

  return (
    <Card className="glass-subtle">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base" data-testid="text-intel-v2-title">
                Company Intel
              </CardTitle>
              {intel.companyName && (
                <p className="text-xs text-muted-foreground">{intel.companyName}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8"
            data-testid="button-refresh-intel-v2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {intel.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {intel.error}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2" data-testid="intel-mini-cards">
          {intel.stock && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border" data-testid="stock-card">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">{intel.stock.ticker}</span>
                <div className="flex items-center gap-1">
                  {intel.stock.lastPrice && (
                    <span className="text-sm font-medium">
                      ${intel.stock.lastPrice.toFixed(2)}
                    </span>
                  )}
                  {intel.stock.changePercent !== undefined && (
                    <span
                      className={`text-[10px] flex items-center ${
                        intel.stock.changePercent >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {intel.stock.changePercent >= 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {formatChangePercent(intel.stock.changePercent)}
                    </span>
                  )}
                </div>
              </div>
              <StockSparkline series={intel.stock.series} />
            </div>
          )}

          {intel.headcount && (
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/50 border border-border" data-testid="headcount-card">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Employees</span>
              </div>
              <span className="text-sm font-medium">{intel.headcount.range}</span>
              <HeadcountBar range={intel.headcount.range} />
            </div>
          )}

          {intel.hq && (intel.hq.city || intel.hq.country) && (
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/50 border border-border" data-testid="hq-card">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">HQ</span>
              </div>
              <span className="text-sm font-medium">
                {[intel.hq.city, intel.hq.country].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "verified" | "coaching")}>
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="verified" className="text-xs gap-1" data-testid="tab-verified">
              <CheckCircle2 className="w-3 h-3" />
              Verified Intel
            </TabsTrigger>
            <TabsTrigger value="coaching" className="text-xs gap-1" data-testid="tab-coaching">
              <Lightbulb className="w-3 h-3" />
              Coaching
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verified" className="mt-4 space-y-4">
            {intel.verifiedFacts.length > 0 && (
              <div data-testid="verified-facts">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Key Facts</span>
                </div>
                <div className="space-y-2 pl-6">
                  {intel.verifiedFacts.map((fact, i) => (
                    <div key={i} className="flex items-start gap-2" data-testid={`fact-${i}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0 mt-2" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{fact.text}</p>
                        <SourceChip title={fact.source.title} url={fact.source.url} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intel.productsAndServices.length > 0 && (
              <div data-testid="products-services">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Products & Services</span>
                </div>
                <div className="space-y-2 pl-6">
                  {intel.productsAndServices.map((item, i) => (
                    <div key={i} className="flex items-start gap-2" data-testid={`product-${i}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0 mt-2" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{item.text}</p>
                        <SourceChip title={item.source.title} url={item.source.url} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intel.latestSignals.length > 0 && (
              <div data-testid="latest-signals">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Recent Signals</span>
                </div>
                <div className="space-y-2 pl-6">
                  {intel.latestSignals.map((signal, i) => (
                    <a
                      key={i}
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-md border border-border hover-elevate"
                      data-testid={`signal-${i}`}
                    >
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                        <span>{signal.date}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {signal.sourceName}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{signal.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {intel.verifiedFacts.length === 0 &&
              intel.productsAndServices.length === 0 &&
              intel.latestSignals.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No verified intel available</p>
                  <p className="text-xs mt-1">Try searching for a larger company</p>
                </div>
              )}
          </TabsContent>

          <TabsContent value="coaching" className="mt-4 space-y-4">
            {intel.coaching?.talkingPoints && intel.coaching.talkingPoints.length > 0 && (
              <div data-testid="talking-points">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Talking Points</span>
                </div>
                <div className="space-y-2 pl-6">
                  {intel.coaching.talkingPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2" data-testid={`talking-point-${i}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0 mt-2" />
                      <p className="text-sm">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intel.coaching?.questions && intel.coaching.questions.length > 0 && (
              <div data-testid="coaching-questions">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Questions to Ask</span>
                </div>
                <div className="space-y-2 pl-6">
                  {intel.coaching.questions.map((question, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2"
                      data-testid={`coaching-question-${i}`}
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">{i + 1}</span>
                      </div>
                      <p className="text-sm italic">"{question}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intel.coaching?.watchOuts && intel.coaching.watchOuts.length > 0 && (
              <div data-testid="watch-outs">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Watch Outs</span>
                </div>
                <div className="space-y-2 pl-6">
                  {intel.coaching.watchOuts.map((watchOut, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-md bg-amber-500/5 border border-amber-500/10"
                      data-testid={`watch-out-${i}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{watchOut}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!intel.coaching ||
              (intel.coaching.talkingPoints?.length === 0 &&
                intel.coaching.questions?.length === 0 &&
                intel.coaching.watchOuts?.length === 0)) && (
              <div className="text-center py-6 text-muted-foreground">
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No coaching tips available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-center pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">
            Last updated: {new Date(intel.lastRefreshedAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
