import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CreditCard } from "lucide-react";

import eventsImg from "@assets/Image_(16)_1766300783521.jpg";
import scanCardImg from "@assets/Image_(13)_1766300783522.jpg";
import qrCodeImg from "@assets/Image_(11)_1766300783522.jpg";
import actionsImg from "@assets/Image_(10)_1766300783522.jpg";
import timelineImg from "@assets/Image_(9)_1766300783523.jpg";

// Animated Icons for each feature
function ScanAnimation() {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden relative">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="7" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
        <rect x="6" y="11" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
        <rect x="6" y="15" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
      </svg>
      <div className="absolute inset-x-0 h-0.5 bg-primary animate-scan-line" />
    </div>
  );
}

function IntelAnimation() {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary">
        <rect x="4" y="14" width="3" height="6" rx="0.5" fill="currentColor" className="animate-bar-1" />
        <rect x="9" y="10" width="3" height="10" rx="0.5" fill="currentColor" className="animate-bar-2" />
        <rect x="14" y="6" width="3" height="14" rx="0.5" fill="currentColor" className="animate-bar-3" />
        <rect x="19" y="4" width="3" height="16" rx="0.5" fill="currentColor" opacity="0.3" />
      </svg>
    </div>
  );
}

function OrgMapAnimation() {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary">
        <circle cx="12" cy="5" r="2.5" fill="currentColor" className="animate-node-pulse" />
        <circle cx="6" cy="14" r="2" fill="currentColor" className="animate-node-pulse-delay-1" />
        <circle cx="18" cy="14" r="2" fill="currentColor" className="animate-node-pulse-delay-2" />
        <circle cx="4" cy="20" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="10" cy="20" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="20" cy="20" r="1.5" fill="currentColor" opacity="0.5" />
        <path d="M12 7.5V10 M12 10L6 12 M12 10L18 12 M6 16L4 18.5 M6 16L10 18.5 M18 16L20 18.5" 
          stroke="currentColor" strokeWidth="1" fill="none" className="animate-line-draw" />
      </svg>
    </div>
  );
}

function FollowUpAnimation() {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary">
        <path d="M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V8a2 2 0 012-2z" 
          fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-bubble-pop" />
        <circle cx="8" cy="12" r="1" fill="currentColor" className="animate-dot-1" />
        <circle cx="12" cy="12" r="1" fill="currentColor" className="animate-dot-2" />
        <circle cx="16" cy="12" r="1" fill="currentColor" className="animate-dot-3" />
      </svg>
    </div>
  );
}

function EventModeAnimation() {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary">
        <rect x="3" y="5" width="14" height="10" rx="1" fill="currentColor" opacity="0.2" className="animate-card-stack-1" />
        <rect x="5" y="7" width="14" height="10" rx="1" fill="currentColor" opacity="0.4" className="animate-card-stack-2" />
        <rect x="7" y="9" width="14" height="10" rx="1" fill="currentColor" opacity="0.7" className="animate-card-stack-3" />
        <circle cx="18" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-flash" />
      </svg>
    </div>
  );
}

function TimelineAnimation() {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary">
        <line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <circle cx="6" cy="6" r="2" fill="currentColor" className="animate-timeline-dot-1" />
        <circle cx="6" cy="12" r="2" fill="currentColor" className="animate-timeline-dot-2" />
        <circle cx="6" cy="18" r="2" fill="currentColor" className="animate-timeline-dot-3" />
        <rect x="10" y="5" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.5" className="animate-timeline-line-1" />
        <rect x="10" y="11" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.5" className="animate-timeline-line-2" />
        <rect x="10" y="17" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.5" className="animate-timeline-line-3" />
      </svg>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          {icon}
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed flex-1">{description}</p>
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

function HubSpotLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#FF7A59"
        d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066A2.2 2.2 0 0 0 17.23.833h-.066a2.2 2.2 0 0 0-2.2 2.2v.067c0 .86.495 1.602 1.216 1.962v2.873a5.908 5.908 0 0 0-2.88 1.385l-7.64-5.948a2.457 2.457 0 0 0 .104-.703 2.464 2.464 0 1 0-2.464 2.464c.456 0 .88-.126 1.243-.344l7.498 5.837a5.905 5.905 0 0 0-.593 2.593c0 .939.22 1.826.612 2.614l-2.297 2.297a1.885 1.885 0 0 0-.553-.084 1.891 1.891 0 1 0 1.891 1.891c0-.2-.033-.39-.09-.57l2.248-2.248a5.923 5.923 0 0 0 3.578 1.205c3.282 0 5.942-2.66 5.942-5.942a5.934 5.934 0 0 0-4.844-5.837zM17.197 17.12a2.896 2.896 0 0 1-2.898-2.897 2.896 2.896 0 0 1 2.898-2.898 2.896 2.896 0 0 1 2.898 2.898 2.896 2.896 0 0 1-2.898 2.897z"
      />
    </svg>
  );
}

function SalesforceLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#00A1E0"
        d="M10.006 5.415a4.195 4.195 0 0 1 3.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.16 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 0 1-3.3 1.95c-.6 0-1.17-.135-1.68-.389a4.65 4.65 0 0 1-4.02 2.34A4.723 4.723 0 0 1 4.14 15.5a4.02 4.02 0 0 1-.51.03A3.63 3.63 0 0 1 0 11.895a3.63 3.63 0 0 1 3.63-3.63c.39 0 .78.06 1.14.165a5.49 5.49 0 0 1 5.236-3.015z"
      />
    </svg>
  );
}

function HeroCollage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-5">
        <div className="rounded-xl overflow-hidden shadow-lg border bg-card transform -rotate-2 hover:rotate-0 transition-transform duration-300 hover:scale-105 hover:z-10">
          <img src={scanCardImg} alt="Scan Business Card" className="w-full h-auto" />
        </div>
        <div className="rounded-xl overflow-hidden shadow-lg border bg-card transform rotate-1 hover:rotate-0 transition-transform duration-300 hover:scale-105 hover:z-10">
          <img src={qrCodeImg} alt="My QR Code" className="w-full h-auto" />
        </div>
        <div className="rounded-xl overflow-hidden shadow-lg border bg-card transform rotate-2 hover:rotate-0 transition-transform duration-300 hover:scale-105 hover:z-10">
          <img src={eventsImg} alt="Events Hub" className="w-full h-auto" />
        </div>
        <div className="col-span-3 grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 max-w-2xl mx-auto">
          <div className="rounded-xl overflow-hidden shadow-lg border bg-card transform rotate-1 hover:rotate-0 transition-transform duration-300 hover:scale-105 hover:z-10">
            <img src={actionsImg} alt="Quick Actions" className="w-full h-auto" />
          </div>
          <div className="rounded-xl overflow-hidden shadow-lg border bg-card transform -rotate-1 hover:rotate-0 transition-transform duration-300 hover:scale-105 hover:z-10">
            <img src={timelineImg} alt="Contact Timeline" className="w-full h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
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
        <section className="container mx-auto px-4 py-12 md:py-16 text-center">
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
              <a href="#features">See features</a>
            </Button>
          </div>

          <HeroCollage />
        </section>

        <section id="features" className="py-16 border-t">
          <div className="container mx-auto px-4 text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Built for the busy professional
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Carda is a mini CRM that enhances the way you interact with your network
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 pb-4 items-stretch" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex-none w-[280px] sm:w-[300px] min-h-[220px] snap-center first:ml-auto">
              <FeatureCard
                icon={<ScanAnimation />}
                title="Smart Capture"
                description="Snap a photo or paste an email signature. AI extracts names, titles, emails, and phones instantly. Works with cards, signatures, and handwritten notes."
              />
            </div>
            <div className="flex-none w-[280px] sm:w-[300px] min-h-[220px] snap-center">
              <FeatureCard
                icon={<IntelAnimation />}
                title="Company Intel"
                description="One-tap AI research on any company. Get funding history, tech stack, competitors, and talking points. Know your prospect before the call."
              />
            </div>
            <div className="flex-none w-[280px] sm:w-[300px] min-h-[220px] snap-center">
              <FeatureCard
                icon={<OrgMapAnimation />}
                title="Org Map"
                description="Visualize entire organizations. See who reports to whom, spot decision-makers, and map the power dynamics as you collect contacts."
              />
            </div>
            <div className="flex-none w-[280px] sm:w-[300px] min-h-[220px] snap-center">
              <FeatureCard
                icon={<FollowUpAnimation />}
                title="Follow-Up"
                description="AI-drafted emails and LinkedIn messages in your tone. Set reminders, track tasks, and never let a warm lead go cold."
              />
            </div>
            <div className="flex-none w-[280px] sm:w-[300px] min-h-[220px] snap-center">
              <FeatureCard
                icon={<EventModeAnimation />}
                title="Event Mode"
                description="Batch-scan dozens of cards at conferences. Snap, queue, and process later. Review and approve before saving. Built for speed."
              />
            </div>
            <div className="flex-none w-[280px] sm:w-[300px] min-h-[220px] snap-center last:mr-auto">
              <FeatureCard
                icon={<TimelineAnimation />}
                title="Timeline"
                description="Full history of every interaction with each contact. Calls, emails, meetings, notes—all in one place. Never forget context again."
              />
            </div>
          </div>
        </section>

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

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Carda. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
