import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CreditCard,
  GitBranch,
  ScanLine,
  Zap,
} from "lucide-react";

function MediaPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center text-sm text-muted-foreground aspect-video">
      <div className="text-center p-4">
        <div className="font-medium">{label}</div>
        <div className="text-xs mt-1 opacity-70">Drop GIF or screenshot here</div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  mediaLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  mediaLabel: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4 sm:p-6">
        <MediaPlaceholder label={mediaLabel} />
      </div>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

function LogoPill({
  name,
  logo,
}: {
  name: string;
  logo: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/20 text-sm text-muted-foreground">
      <span className="h-4 w-4 flex items-center justify-center">{logo}</span>
      <span>{name}</span>
    </span>
  );
}

// Minimal inline SVGs (safe, no external requests)
function HubSpotLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a2 2 0 0 0-2 2v2.1A6.9 6.9 0 0 0 6.1 10H4a2 2 0 1 0 0 4h2.1A6.9 6.9 0 0 0 10 17.9V20a2 2 0 1 0 4 0v-2.1A6.9 6.9 0 0 0 17.9 14H20a2 2 0 1 0 0-4h-2.1A6.9 6.9 0 0 0 14 6.1V4a2 2 0 0 0-2-2Zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      />
    </svg>
  );
}

function SalesforceLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.4 7.2a4.5 4.5 0 0 1 8.2 2.1 3.7 3.7 0 0 1 .3 7.4H8.4a3.9 3.9 0 0 1-1.1-7.7 4.6 4.6 0 0 1 3.1-1.8Zm-.2 2a2.6 2.6 0 0 0-2.4 1.7l-.2.6-.6.1a2 2 0 0 0 .3 4h10.6a1.8 1.8 0 0 0 0-3.6l-.7-.1-.1-.7a2.5 2.5 0 0 0-4.8-.8l-.3.6-.7-.1a2.7 2.7 0 0 0-1.1.3Z"
      />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Carda</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">
              Sign In <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span>Powered by AI</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Your network. <span className="text-primary">With powerful intelligence.</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            A mini CRM, for your contacts on-the-go. With AI enrichment tools. 
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">
                Get Started <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-see-demo">
              <a href="#demo">See demo</a>
            </Button>
          </div>
        </section>

        {/* Main Demo Section */}
        <section id="demo" className="container mx-auto px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border bg-card p-2 sm:p-4 shadow-sm">
              <div className="rounded-xl overflow-hidden bg-muted aspect-video flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <ScanLine className="w-8 h-8 text-primary" />
                  </div>
                  <div className="font-medium text-lg">App Demo</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Add a GIF or video showing the full workflow
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Built for the busy professional
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Carda is mini CRM that enhances the way you interact with your network
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={<ScanLine className="w-5 h-5 text-primary" />}
              title="Smart Scanning"
              description="Scan cards or paste signatures. Auto-extract fields. Powerful, intelligent Follow-ups"
              mediaLabel="Scanning Demo"
            />
            <FeatureCard
              icon={<Building2 className="w-5 h-5 text-primary" />}
              title="Company Intel"
              description="One-tap Co-pilot level intelligence, to help you to know your customers better."
              mediaLabel="Intel Demo"
            />
            <FeatureCard
              icon={<GitBranch className="w-5 h-5 text-primary" />}
              title="Org Intelligence"
              description="Map stakeholders. Spot decision-makers and influencers."
              mediaLabel="Org Map Demo"
            />
            <FeatureCard
              icon={<CalendarDays className="w-5 h-5 text-primary" />}
              title="Events Hub"
              description="Track industry events near you. Batch scan in Event Mode, saves hours of time"
              mediaLabel="Events Demo"
            />
          </div>
        </section>

        {/* CRM Coming Soon (logos only) */}
        <section className="container mx-auto px-4 pb-2">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-full bg-muted text-sm text-muted-foreground">
                CRM integrations coming soon
              </span>
              <LogoPill name="HubSpot" logo={<HubSpotLogo />} />
              <LogoPill name="Salesforce" logo={<SalesforceLogo />} />
            </div>
          </div>
        </section>

        {/* Simple CTA */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-3">Try it out</h2>
            <p className="text-muted-foreground mb-6">Currently in private pilot.</p>
            <Button size="lg" asChild data-testid="button-start-now">
              <a href="/api/login">
                Get Started <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Carda — Contact Intelligence
        </div>
      </footer>
    </div>
  );
}
