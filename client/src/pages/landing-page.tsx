import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanLine, Building2, Users, Zap, ArrowRight, CreditCard } from "lucide-react";

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
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">
              Sign In <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <section className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Turn Business Cards into
            <span className="text-primary"> Actionable Intelligence</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Scan business cards, get AI-powered company insights, and manage your professional network with ease. Perfect for sales professionals and networkers.
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login">
              Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
        </section>

        <section className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover-elevate" data-testid="card-feature-scan">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <ScanLine className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Smart Scanning</CardTitle>
              <CardDescription>
                AI-powered OCR extracts contact details from business cards instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>Batch scan multiple cards at events</li>
                <li>Works with photos from any angle</li>
                <li>Supports email signatures too</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-feature-intel">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Company Intelligence</CardTitle>
              <CardDescription>
                Get AI-generated sales briefs with funding, tech stack, and competitors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>Funding rounds and investors</li>
                <li>Technology stack analysis</li>
                <li>Competitive landscape</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-feature-network">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Network Management</CardTitle>
              <CardDescription>
                Organize contacts, track companies, and never miss a follow-up
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>Org chart mapping</li>
                <li>Smart follow-up reminders</li>
                <li>Export to any CRM</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="text-center mt-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span>Powered by AI for maximum efficiency</span>
          </div>
          <h2 className="text-2xl font-bold mb-4">Ready to supercharge your networking?</h2>
          <Button size="lg" asChild data-testid="button-start-now">
            <a href="/api/login">
              Start Now <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </Button>
        </section>
      </main>

      <footer className="border-t mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Carda - Smart Contact Management for Professionals</p>
        </div>
      </footer>
    </div>
  );
}
