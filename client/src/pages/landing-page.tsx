import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  GitBranch,
  Mail,
  Plug,
  ScanLine,
  Sparkles,
} from "lucide-react";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1 rounded-full border bg-muted/30 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function MediaSlot({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-muted/30 overflow-hidden">
      <div className="px-4 py-3 border-b bg-background/40 flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">GIF / Screenshot</div>
      </div>
      <div className="h-56 md:h-72 flex items-center justify-center text-sm text-muted-foreground">
        Drop media here
      </div>
    </div>
  );
}

function FeatureBlock({
  id,
  icon,
  title,
  oneLiner,
  chips,
  mediaLabel,
  reverse,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  oneLiner: string;
  chips: string[];
  mediaLabel: string;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="max-w-6xl mx-auto mb-12">
      <div
        className={`grid md:grid-cols-2 gap-8 items-stretch ${
          reverse ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Card className="bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-muted w-fit">
              {icon}
              <span className="text-muted-foreground">Main feature</span>
            </div>

            <CardTitle className="text-2xl mt-4">{title}</CardTitle>
            <div className="text-sm text-muted-foreground mt-2">{oneLiner}</div>

            <div className="mt-5 flex flex-wrap gap-2">
              {chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Button asChild>
                <a href="/api/login">
                  Try <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="#crm">CRM</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent />
        </Card>

        <MediaSlot label={mediaLabel} />
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Carda</span>
            <span className="ml-2 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              Pilot
            </span>
          </div>

          <Button asChild data-testid="button-login">
            <a href="/api/login">
              Sign In <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-14">
        {/* HERO */}
        <section className="text-center max-w-4xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm mb-5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Contact intelligence</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Scan. Organize. Follow up.
          </h1>

          <p className="text-base md:text-lg text-muted-foreground mt-4">
            Clean contacts + company context — in one place.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">
                Get Started <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#scan">See features</a>
            </Button>
          </div>
        </section>

        {/* MAIN FEATURES */}
        <FeatureBlock
          id="scan"
          icon={<ScanLine className="w-4 h-4 text-primary" />}
          title="Smart Scanning"
          oneLiner="Capture contacts from cards or signatures."
          chips={["Camera scan", "Paste signature", "Your QR"]}
          mediaLabel="Smart Scanning"
        />

        <FeatureBlock
          id="org"
          reverse
          icon={<GitBranch className="w-4 h-4 text-primary" />}
          title="Org Intelligence"
          oneLiner="See contacts grouped by company."
          chips={["Org chart", "Influence view", "Company notes"]}
          mediaLabel="Org Intelligence"
        />

        <FeatureBlock
          id="events"
          icon={<CalendarDays className="w-4 h-4 text-primary" />}
          title="Events Hub"
          oneLiner="Plan events. Capture leads. Track follow-ups."
          chips={["Pin events", "Attending status", "Event notes"]}
          mediaLabel="Events Hub"
        />

        {/* CRM (COMING SOON) */}
        <section id="crm" className="max-w-6xl mx-auto mb-14">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <Card className="bg-background/60 backdrop-blur-sm">
              <CardHeader>
                <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-muted w-fit">
                  <Plug className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Coming soon</span>
                </div>

                <CardTitle className="text-2xl mt-4">CRM Integration</CardTitle>
                <div className="text-sm text-muted-foreground mt-2">
                  Export or sync clean contacts.
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Chip>HubSpot</Chip>
                  <Chip>Salesforce</Chip>
                  <Chip>Dynamics 365</Chip>
                  <Chip>Pipedrive</Chip>
                  <Chip>Zoho</Chip>
                  <Chip>CSV</Chip>
                </div>

                <div className="mt-6">
                  <Button asChild>
                    <a href="/api/login">
                      Start Pilot <ArrowRight className="ml-2 w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent />
            </Card>

            <MediaSlot label="CRM Sync / Export" />
          </div>
        </section>

        {/* CTA */}
        <section className="text-center mt-6">
          <Button size="lg" asChild data-testid="button-start-now">
            <a href="/api/login">
              Start <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
          <div className="text-xs text-muted-foreground mt-3">Private pilot • quick signup</div>
        </section>
      </main>

      <footer className="border-t mt-20 py-10">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Carda</p>
        </div>
      </footer>
    </div>
  );
}
