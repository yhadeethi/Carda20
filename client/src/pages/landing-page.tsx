import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  CreditCard,
  GitBranch,
  ScanLine,
  Zap,
  MessageSquare,
  Camera,
  Clock,
} from "lucide-react";

import eventsImg from "@assets/Image_(16)_1766300783521.jpg";
import scanCardImg from "@assets/Image_(13)_1766300783522.jpg";
import qrCodeImg from "@assets/Image_(11)_1766300783522.jpg";
import actionsImg from "@assets/Image_(10)_1766300783522.jpg";
import timelineImg from "@assets/Image_(9)_1766300783523.jpg";

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
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
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
    <div className="relative w-full max-w-4xl mx-auto h-80 sm:h-96 md:h-[26rem]">
      <div className="absolute left-[3%] top-[2%] w-36 sm:w-44 md:w-56 rounded-xl overflow-hidden shadow-lg border bg-card transform -rotate-3 hover:rotate-0 transition-transform duration-300">
        <img src={scanCardImg} alt="Scan Business Card" className="w-full h-auto" />
      </div>
      <div className="absolute left-[32%] top-[0%] w-40 sm:w-48 md:w-60 rounded-xl overflow-hidden shadow-lg border bg-card transform rotate-1 hover:rotate-0 transition-transform duration-300 z-20">
        <img src={qrCodeImg} alt="My QR Code" className="w-full h-auto" />
      </div>
      <div className="absolute right-[3%] top-[2%] w-36 sm:w-44 md:w-56 rounded-xl overflow-hidden shadow-lg border bg-card transform rotate-3 hover:rotate-0 transition-transform duration-300">
        <img src={eventsImg} alt="Events Hub" className="w-full h-auto" />
      </div>
      <div className="absolute left-[12%] top-[48%] w-36 sm:w-44 md:w-56 rounded-xl overflow-hidden shadow-lg border bg-card transform rotate-2 hover:rotate-0 transition-transform duration-300 z-10">
        <img src={actionsImg} alt="Quick Actions" className="w-full h-auto" />
      </div>
      <div className="absolute right-[12%] top-[48%] w-36 sm:w-44 md:w-56 rounded-xl overflow-hidden shadow-lg border bg-card transform -rotate-2 hover:rotate-0 transition-transform duration-300 z-10">
        <img src={timelineImg} alt="Contact Timeline" className="w-full h-auto" />
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
              <a href="#features">See features</a>
            </Button>
          </div>

          <HeroCollage />
        </section>

        <section id="features" className="py-16 border-t">
          <div className="container mx-auto px-4 text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Built for the busy professional
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Carda is a mini CRM that enhances the way you interact with your network
            </p>
          </div>

          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              <FeatureCard
                icon={<ScanLine className="w-5 h-5 text-primary" />}
                title="Smart Capture"
                description="Snap a photo or paste an email signature. AI extracts names, titles, emails, and phones instantly. Works with cards, signatures, and handwritten notes."
              />
              <FeatureCard
                icon={<Building2 className="w-5 h-5 text-primary" />}
                title="Company Intel"
                description="One-tap AI research on any company. Get funding history, tech stack, competitors, and talking points. Know your prospect before the call."
              />
              <FeatureCard
                icon={<GitBranch className="w-5 h-5 text-primary" />}
                title="Org Map"
                description="Visualize entire organizations. See who reports to whom, spot decision-makers, and map the power dynamics as you collect contacts."
              />
              <FeatureCard
                icon={<MessageSquare className="w-5 h-5 text-primary" />}
                title="Follow-Up"
                description="AI-drafted emails and LinkedIn messages in your tone. Set reminders, track tasks, and never let a warm lead go cold."
              />
              <FeatureCard
                icon={<Camera className="w-5 h-5 text-primary" />}
                title="Event Mode"
                description="Batch-scan dozens of cards at conferences. Snap, queue, and process later. Review and approve before saving. Built for speed."
              />
              <FeatureCard
                icon={<Clock className="w-5 h-5 text-primary" />}
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
          Carda — Contact Intelligence
        </div>
      </footer>
    </div>
  );
}
