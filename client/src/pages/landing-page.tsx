import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
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
  icon: React.ReactNode;
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
            <span>Scan. Enrich. Follow up. Export.</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Turn contacts into
            <span className="text-primary"> workflow</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Capture business cards and signatures. Get AI-powered company intel. 
            Map organizations. Never lose momentum after a meeting again.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">
                Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-see-demo">
              <a href="#demo">See how it works</a>
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
              Everything you need after a meeting
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From scan to follow-up in minutes, not days.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={<ScanLine className="w-5 h-5 text-primary" />}
              title="Smart Scanning"
              description="Snap a photo or paste an email signature. AI extracts name, title, company, email, phone, and more."
              mediaLabel="Scanning Demo"
            />
            <FeatureCard
              icon={<Building2 className="w-5 h-5 text-primary" />}
              title="Company Intel"
              description="Get AI-generated briefs with talking points, recent news, and competitive context before your next call."
              mediaLabel="Intel Demo"
            />
            <FeatureCard
              icon={<GitBranch className="w-5 h-5 text-primary" />}
              title="Org Intelligence"
              description="Auto-group contacts by company. Visualize reporting lines. Know who influences who."
              mediaLabel="Org Map Demo"
            />
          </div>
        </section>

        {/* Simple CTA */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-3">
              Ready to stop losing contacts?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join the pilot and turn every meeting into momentum.
            </p>
            <Button size="lg" asChild data-testid="button-start-now">
              <a href="/api/login">
                Start Free <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Carda — Capture. Enrich. Follow up.
        </div>
      </footer>
    </div>
  );
}
