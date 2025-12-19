import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CreditCard,
  GitBranch,
  Mail,
  ScanLine,
  Users,
  Sparkles,
  Plug,
} from "lucide-react";

function MediaSlot({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-muted/30 overflow-hidden">
      <div className="px-4 py-3 border-b bg-background/40 flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">
          {hint ?? "Drop a GIF or screenshot here"}
        </div>
      </div>
      <div className="h-56 md:h-72 flex items-center justify-center text-sm text-muted-foreground">
        GIF / Screenshot placeholder
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/80" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  icon,
  eyebrow,
  title,
  subtitle,
  mediaLabel,
  mediaHint,
  mainBullets,
  subTitle,
  subBullets,
  reverse,
}: {
  id: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  mediaLabel: string;
  mediaHint?: string;
  mainBullets: string[];
  subTitle: string;
  subBullets: string[];
  reverse?: boolean;
}) {
  return (
    <section id={id} className="max-w-6xl mx-auto mb-14">
      <div className={`grid md:grid-cols-2 gap-8 items-stretch ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-muted w-fit">
            {icon}
            <span className="text-muted-foreground">{eyebrow}</span>
          </div>

          <h2 className="text-3xl font-bold mt-4">{title}</h2>
          <p className="text-muted-foreground mt-2">{subtitle}</p>

          <div className="mt-6">
            <Card className="bg-background/60 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Core capabilities</CardTitle>
                <CardDescription>What you use every day.</CardDescription>
              </CardHeader>
              <CardContent>
                <BulletList items={mainBullets} />
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
            <Card className="bg-background/60 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{subTitle}</CardTitle>
                <CardDescription>Built on top of the core.</CardDescription>
              </CardHeader>
              <CardContent>
                <BulletList items={subBullets} />
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex gap-3">
            <Button asChild>
              <a href="/api/login">
                Try Carda <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="#crm">CRM integrations</a>
            </Button>
          </div>
        </div>

        <MediaSlot label={mediaLabel} hint={mediaHint} />
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
              Private Pilot
            </span>
          </div>

          <div className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <a className="hover:text-foreground" href="#capture">Capture</a>
            <a className="hover:text-foreground" href="#org">Org Intelligence</a>
            <a className="hover:text-foreground" href="#events">Events Hub</a>
            <a className="hover:text-foreground" href="#crm">CRM</a>
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
        <section className="max-w-5xl mx-auto mb-14">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Contact intelligence for real networking</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Carda is a
              <span className="text-primary"> networking power tool</span>.
            </h1>

            <p className="text-lg text-muted-foreground mt-4 max-w-3xl mx-auto">
              Capture contacts fast. Build company context. Map stakeholders. Follow up with intent.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login">
                  Start <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#capture">See features</a>
              </Button>
            </div>
          </div>
        </section>

        {/* 1) CAPTURE + SMART SCANNING */}
        <Section
          id="capture"
          icon={<ScanLine className="w-4 h-4 text-primary" />}
          title="Smart Scanning"
          subtitle="Capture contacts from anywhere — camera, screenshots, signatures — and share yours instantly."
          mediaLabel="Smart Scanning — GIF/Screenshot"
          mediaHint="Example: scan flow → contact created"
          mainBullets={[
            "Scan business cards with the camera",
            "Paste email signatures from anywhere",
            "Reverse contact: let others scan your QR to save you",
            "Auto-detect fields (name, role, email, phone, company)",
          ]}
          subTitle="Built on top: intel + follow-up"
          subBullets={[
            "Company intel on demand (brief, notes, key context)",
            "Follow-up actions and reminders per contact",
            "Clean contact records ready for export",
          ]}
        />

        {/* 2) ORG INTELLIGENCE */}
        <Section
          id="org"
          reverse
          icon={<GitBranch className="w-4 h-4 text-primary" />}
          title="Org Intelligence"
          subtitle="Group contacts by company and understand how people connect — fast."
          mediaLabel="Org Intelligence — GIF/Screenshot"
          mediaHint="Example: company view → org map"
          mainBullets={[
            "Auto-group contacts into companies",
            "Visual org chart with manual adjustments",
            "Track roles, departments, and influence",
            "See who influences who (quick signal, not perfection)",
          ]}
          subTitle="Built on top: talking points"
          subBullets={[
            "Company-level notes that roll up to the org",
            "Talking points attached to key stakeholders",
            "Last touched + next action across the whole account",
          ]}
        />

        {/* 3) EVENTS HUB */}
        <Section
          id="events"
          icon={<CalendarDays className="w-4 h-4 text-primary" />}
          title="Events Hub"
          subtitle="Plan your networking. Capture leads per event. Follow up while it’s still warm."
          mediaLabel="Events Hub — GIF/Screenshot"
          mediaHint="Example: events list → pinned → notes"
          mainBullets={[
            "Industry event list (pin what matters)",
            "Mark attending / maybe / not attending",
            "Event notes + prep checklist",
            "Link scans to an event (so you know where you met them)",
          ]}
          subTitle="Built on top: post-event workflow"
          subBullets={[
            "Auto follow-up queue after an event",
            "Tag contacts by event and company",
            "Simple event history inside each contact",
          ]}
        />

        {/* 4) COMING SOON: CRM */}
        <section id="crm" className="max-w-6xl mx-auto mb-10">
          <Card className="bg-background/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plug className="w-5 h-5 text-primary" />
                <CardTitle>Coming soon: CRM Integrations</CardTitle>
              </div>
              <CardDescription>
                Push clean contacts and company notes into the systems you already use.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="font-medium mb-2">Planned integrations</div>
                <BulletList
                  items={[
                    "HubSpot (first)",
                    "Salesforce",
                    "Microsoft Dynamics 365",
                    "Pipedrive",
                    "Zoho CRM",
                    "CSV export (always available)",
                  ]}
                />
              </div>

              <MediaSlot
                label="CRM Integrations — GIF/Screenshot"
                hint="Example: export → HubSpot mapping screen"
              />
            </CardContent>
          </Card>
        </section>

        {/* FINAL CTA */}
        <section className="text-center mt-12">
          <h3 className="text-2xl font-bold mb-3">Start your pilot</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Create an account and use Carda like a tool: scan, group, map, and follow up.
          </p>
          <Button size="lg" asChild data-testid="button-start-now">
            <a href="/api/login">
              Start <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
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
