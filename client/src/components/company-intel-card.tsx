import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CompanyIntelData } from "@shared/schema";
import {
  Building2,
  Newspaper,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  Users,
  MapPin,
  Briefcase,
  Package,
} from "lucide-react";
import { useState } from "react";

interface CompanyIntelCardProps {
  intel: CompanyIntelData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  companyName?: string | null;
}

export function CompanyIntelCard({
  intel,
  isLoading,
  error,
  onRetry,
  companyName,
}: CompanyIntelCardProps) {
  const [snapshotOpen, setSnapshotOpen] = useState(true);
  const [newsOpen, setNewsOpen] = useState(true);
  const [talkingPointsOpen, setTalkingPointsOpen] = useState(true);

  if (isLoading) {
    return (
      <Card className="glass-subtle">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center intel-loading">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Collecting Intel...</CardTitle>
              <p className="text-xs text-muted-foreground">
                {companyName ? `Researching ${companyName}` : "Researching company"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
            <Skeleton className="h-4 w-1/2 skeleton-shimmer" />
            <Skeleton className="h-4 w-2/3 skeleton-shimmer" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full skeleton-shimmer" />
            <Skeleton className="h-4 w-5/6 skeleton-shimmer" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-4/5 skeleton-shimmer" />
            <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
            <Skeleton className="h-4 w-2/3 skeleton-shimmer" />
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
                We couldn't retrieve company information at this time
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onRetry}
              className="gap-2"
              data-testid="button-retry-intel"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Intel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!intel) {
    return null;
  }

  const SectionHeader = ({
    icon: Icon,
    title,
    isOpen,
    onToggle,
  }: {
    icon: typeof Building2;
    title: string;
    isOpen: boolean;
    onToggle: () => void;
  }) => (
    <CollapsibleTrigger
      onClick={onToggle}
      className="flex items-center justify-between w-full py-2 hover-elevate rounded-lg px-2 -mx-2"
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      {isOpen ? (
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      )}
    </CollapsibleTrigger>
  );

  return (
    <Card className="glass-subtle">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base" data-testid="text-intel-title">
              Company Intel
            </CardTitle>
            {companyName && (
              <p className="text-xs text-muted-foreground">{companyName}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Fallback warning banner */}
        {intel.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Limited intel available
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {intel.error}. Showing generic talking points.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="gap-1 mt-2 h-7 px-2 text-xs"
                data-testid="button-retry-intel-inline"
              >
                <RefreshCw className="w-3 h-3" />
                Try Again
              </Button>
            </div>
          </div>
        )}
        {/* Company Snapshot */}
        {intel.snapshot && (
          <Collapsible open={snapshotOpen} onOpenChange={setSnapshotOpen}>
            <SectionHeader
              icon={Building2}
              title="Company Snapshot"
              isOpen={snapshotOpen}
              onToggle={() => setSnapshotOpen(!snapshotOpen)}
            />
            <CollapsibleContent>
              <div className="mt-2 space-y-3 pl-8">
                {intel.snapshot.description && (
                  <p className="text-sm text-muted-foreground" data-testid="text-intel-description">
                    {intel.snapshot.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {intel.snapshot.industry && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">{intel.snapshot.industry}</span>
                    </div>
                  )}
                  {intel.snapshot.employees && (
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">{intel.snapshot.employees}</span>
                    </div>
                  )}
                  {intel.snapshot.founded && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">Founded {intel.snapshot.founded}</span>
                    </div>
                  )}
                  {intel.snapshot.headquarters && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">{intel.snapshot.headquarters}</span>
                    </div>
                  )}
                </div>
                {intel.snapshot.keyProducts && intel.snapshot.keyProducts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {intel.snapshot.keyProducts.map((product, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        {product}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recent News */}
        {intel.recentNews && intel.recentNews.length > 0 && (
          <Collapsible open={newsOpen} onOpenChange={setNewsOpen}>
            <SectionHeader
              icon={Newspaper}
              title="Recent News"
              isOpen={newsOpen}
              onToggle={() => setNewsOpen(!newsOpen)}
            />
            <CollapsibleContent>
              <div className="mt-2 space-y-3 pl-8">
                {intel.recentNews.map((news, i) => (
                  <div
                    key={i}
                    className="border-l-2 border-primary/30 pl-3 py-1"
                    data-testid={`news-item-${i}`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="w-3 h-3" />
                      {news.date}
                    </div>
                    <p className="text-sm font-medium">{news.headline}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {news.summary}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Talking Points */}
        {intel.talkingPoints && intel.talkingPoints.length > 0 && (
          <Collapsible open={talkingPointsOpen} onOpenChange={setTalkingPointsOpen}>
            <SectionHeader
              icon={MessageSquare}
              title="Talking Points"
              isOpen={talkingPointsOpen}
              onToggle={() => setTalkingPointsOpen(!talkingPointsOpen)}
            />
            <CollapsibleContent>
              <div className="mt-2 space-y-2 pl-8">
                {intel.talkingPoints.map((point, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2"
                    data-testid={`talking-point-${i}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-sm">{point}</p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
