import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CompanyIntelData } from "@shared/schema";
import {
  Building2,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  User,
  HelpCircle,
  AlertTriangle,
  History,
  ExternalLink,
  DollarSign,
  Cpu,
  Users,
  TrendingUp,
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
  const [whyMatterOpen, setWhyMatterOpen] = useState(true);
  const [roleInsightsOpen, setRoleInsightsOpen] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [developmentsOpen, setDevelopmentsOpen] = useState(true);
  const [risksOpen, setRisksOpen] = useState(true);
  const [fundingOpen, setFundingOpen] = useState(true);
  const [techStackOpen, setTechStackOpen] = useState(true);
  const [competitorsOpen, setCompetitorsOpen] = useState(true);

  if (isLoading) {
    return (
      <Card className="glass-subtle">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center intel-loading">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Building Sales Brief...</CardTitle>
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
              <p className="font-medium">Unable to build sales brief</p>
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

  const BulletList = ({ items, testIdPrefix }: { items: string[]; testIdPrefix: string }) => (
    <div className="mt-2 space-y-2 pl-8">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-2"
          data-testid={`${testIdPrefix}-${i}`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0 mt-2" />
          <p className="text-sm">{item}</p>
        </div>
      ))}
    </div>
  );

  const openGoogleNews = () => {
    const query = encodeURIComponent(companyName || "");
    window.open(`https://news.google.com/search?q=${query}`, "_blank");
  };

  return (
    <Card className="glass-subtle">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base" data-testid="text-intel-title">
              Sales Brief
            </CardTitle>
            {companyName && (
              <p className="text-xs text-muted-foreground">{companyName}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sales Brief wrapper - single vertical rail for consistent alignment */}
        <div className="sales-brief-wrapper w-full space-y-4">
          {/* Fallback warning banner */}
          {intel.error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
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
          {intel.companySnapshot && (
            <Collapsible open={snapshotOpen} onOpenChange={setSnapshotOpen}>
              <SectionHeader
                icon={Building2}
                title="Company Snapshot"
                isOpen={snapshotOpen}
                onToggle={() => setSnapshotOpen(!snapshotOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 pl-8">
                  <p className="text-sm text-muted-foreground" data-testid="text-company-snapshot">
                    {intel.companySnapshot}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Why They Matter to You */}
          {intel.whyTheyMatterToYou && intel.whyTheyMatterToYou.length > 0 && (
            <Collapsible open={whyMatterOpen} onOpenChange={setWhyMatterOpen}>
              <SectionHeader
                icon={Target}
                title="Why They Matter to You"
                isOpen={whyMatterOpen}
                onToggle={() => setWhyMatterOpen(!whyMatterOpen)}
              />
              <CollapsibleContent>
                <BulletList items={intel.whyTheyMatterToYou} testIdPrefix="why-matter" />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* What This Contact Likely Cares About */}
          {intel.roleInsights && intel.roleInsights.length > 0 && (
            <Collapsible open={roleInsightsOpen} onOpenChange={setRoleInsightsOpen}>
              <SectionHeader
                icon={User}
                title="What This Contact Likely Cares About"
                isOpen={roleInsightsOpen}
                onToggle={() => setRoleInsightsOpen(!roleInsightsOpen)}
              />
              <CollapsibleContent>
                <BulletList items={intel.roleInsights} testIdPrefix="role-insight" />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* High-Impact Questions */}
          {intel.highImpactQuestions && intel.highImpactQuestions.length > 0 && (
            <Collapsible open={questionsOpen} onOpenChange={setQuestionsOpen}>
              <SectionHeader
                icon={HelpCircle}
                title="High-Impact Questions"
                isOpen={questionsOpen}
                onToggle={() => setQuestionsOpen(!questionsOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 space-y-2 pl-8">
                  {intel.highImpactQuestions.map((question, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2"
                      data-testid={`question-${i}`}
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">
                          {i + 1}
                        </span>
                      </div>
                      <p className="text-sm italic">"{question}"</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Key Developments (may not be up to date) */}
          {intel.keyDevelopments && intel.keyDevelopments.length > 0 && (
            <Collapsible open={developmentsOpen} onOpenChange={setDevelopmentsOpen}>
              <SectionHeader
                icon={History}
                title="Key Developments (may not be up to date)"
                isOpen={developmentsOpen}
                onToggle={() => setDevelopmentsOpen(!developmentsOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 space-y-3 pl-8">
                  {intel.keyDevelopments.map((dev, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-primary/30 pl-3 py-1"
                      data-testid={`development-${i}`}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span>{dev.approxDate}</span>
                      </div>
                      <p className="text-sm font-medium">{dev.headline}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dev.summary}
                      </p>
                      {dev.note && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">
                          {dev.note}
                        </p>
                      )}
                    </div>
                  ))}
                  
                  {/* View Latest News on Google button */}
                  {companyName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openGoogleNews}
                      className="gap-2 mt-2"
                      data-testid="button-google-news"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View latest news on Google
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Show Google News button even if no developments */}
          {(!intel.keyDevelopments || intel.keyDevelopments.length === 0) && companyName && (
            <div className="pl-8">
              <Button
                variant="outline"
                size="sm"
                onClick={openGoogleNews}
                className="gap-2"
                data-testid="button-google-news"
              >
                <ExternalLink className="w-3 h-3" />
                View latest news on Google
              </Button>
            </div>
          )}

          {/* Watch Outs - only show if non-empty */}
          {intel.risksOrSensitivities && intel.risksOrSensitivities.length > 0 && (
            <Collapsible open={risksOpen} onOpenChange={setRisksOpen}>
              <SectionHeader
                icon={AlertTriangle}
                title="Watch Outs"
                isOpen={risksOpen}
                onToggle={() => setRisksOpen(!risksOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 space-y-2 pl-8">
                  {intel.risksOrSensitivities.map((risk, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-md bg-amber-500/5 border border-amber-500/10"
                      data-testid={`risk-${i}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{risk}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Funding Section */}
          {intel.funding && (intel.funding.fundingStage || intel.funding.totalRaised || intel.funding.investors?.length || intel.funding.ipoStatus || intel.funding.latestRound?.type) && (
            <Collapsible open={fundingOpen} onOpenChange={setFundingOpen}>
              <SectionHeader
                icon={DollarSign}
                title="Funding & Investment"
                isOpen={fundingOpen}
                onToggle={() => setFundingOpen(!fundingOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 pl-8 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {intel.funding.fundingStage && (
                      <div className="p-2 rounded-md bg-primary/5" data-testid="funding-stage">
                        <p className="text-xs text-muted-foreground">Stage</p>
                        <p className="text-sm font-medium">{intel.funding.fundingStage}</p>
                      </div>
                    )}
                    {intel.funding.totalRaised && intel.funding.totalRaised !== "null" && (
                      <div className="p-2 rounded-md bg-primary/5" data-testid="funding-total">
                        <p className="text-xs text-muted-foreground">Total Raised</p>
                        <p className="text-sm font-medium">{intel.funding.totalRaised}</p>
                      </div>
                    )}
                    {intel.funding.ipoStatus && (
                      <div className="p-2 rounded-md bg-primary/5" data-testid="funding-ipo">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-medium">{intel.funding.ipoStatus}</p>
                      </div>
                    )}
                  </div>
                  
                  {intel.funding.latestRound && intel.funding.latestRound.type && (
                    <div className="p-3 rounded-md border border-primary/10" data-testid="funding-latest-round">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-primary">Latest Round</span>
                      </div>
                      <p className="text-sm font-medium">
                        {intel.funding.latestRound.type}
                        {intel.funding.latestRound.amount && ` - ${intel.funding.latestRound.amount}`}
                      </p>
                      {intel.funding.latestRound.date && (
                        <p className="text-xs text-muted-foreground mt-1">{intel.funding.latestRound.date}</p>
                      )}
                      {intel.funding.latestRound.leadInvestors && intel.funding.latestRound.leadInvestors.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Led by: {intel.funding.latestRound.leadInvestors.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {intel.funding.investors && intel.funding.investors.length > 0 && (
                    <div data-testid="funding-investors">
                      <p className="text-xs text-muted-foreground mb-2">Notable Investors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {intel.funding.investors.map((investor, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                          >
                            {investor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Tech Stack Section */}
          {intel.techStack && ((intel.techStack.categories?.length ?? 0) > 0 || (intel.techStack.highlights?.length ?? 0) > 0) && (
            <Collapsible open={techStackOpen} onOpenChange={setTechStackOpen}>
              <SectionHeader
                icon={Cpu}
                title="Technology Stack"
                isOpen={techStackOpen}
                onToggle={() => setTechStackOpen(!techStackOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 pl-8 space-y-3">
                  {(intel.techStack.categories ?? []).filter(c => c && (c.category || c.technologies?.length)).map((category, i) => (
                    <div key={i} data-testid={`tech-category-${i}`}>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{category.category || "General"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(category.technologies ?? []).map((tech, j) => (
                          <span
                            key={j}
                            className="px-2 py-1 text-xs rounded-md bg-secondary/50 border border-border"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {intel.techStack.highlights && intel.techStack.highlights.length > 0 && (
                    <div className="pt-2 border-t border-border/50" data-testid="tech-highlights">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Key Insights</p>
                      {intel.techStack.highlights.map((highlight, i) => (
                        <div key={i} className="flex items-start gap-2 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0 mt-2" />
                          <p className="text-sm text-muted-foreground">{highlight}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Competitive Landscape Section */}
          {intel.competitors && ((intel.competitors.directCompetitors?.length ?? 0) > 0 || (intel.competitors.indirectCompetitors?.length ?? 0) > 0 || intel.competitors.marketPosition) && (
            <Collapsible open={competitorsOpen} onOpenChange={setCompetitorsOpen}>
              <SectionHeader
                icon={Users}
                title="Competitive Landscape"
                isOpen={competitorsOpen}
                onToggle={() => setCompetitorsOpen(!competitorsOpen)}
              />
              <CollapsibleContent>
                <div className="mt-2 pl-8 space-y-3">
                  {intel.competitors.marketPosition && (
                    <div className="p-3 rounded-md bg-primary/5 border border-primary/10" data-testid="market-position">
                      <p className="text-sm">{intel.competitors.marketPosition}</p>
                    </div>
                  )}
                  
                  {intel.competitors.directCompetitors && intel.competitors.directCompetitors.length > 0 && (
                    <div data-testid="direct-competitors">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Direct Competitors</p>
                      <div className="space-y-2">
                        {intel.competitors.directCompetitors.map((comp, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-md border border-border"
                            data-testid={`competitor-${i}`}
                          >
                            <p className="text-sm font-medium">{comp.name}</p>
                            {comp.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{comp.description}</p>
                            )}
                            {comp.differentiator && (
                              <p className="text-xs text-primary mt-1">
                                Differentiator: {comp.differentiator}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {intel.competitors.indirectCompetitors && intel.competitors.indirectCompetitors.length > 0 && (
                    <div data-testid="indirect-competitors">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Adjacent Players</p>
                      <div className="flex flex-wrap gap-2">
                        {intel.competitors.indirectCompetitors.map((comp, i) => (
                          <div
                            key={i}
                            className="px-2 py-1.5 rounded-md bg-secondary/30 border border-border"
                          >
                            <p className="text-xs font-medium">{comp.name}</p>
                            {comp.description && (
                              <p className="text-xs text-muted-foreground">{comp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
