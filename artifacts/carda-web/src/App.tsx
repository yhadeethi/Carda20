import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/useAuth";
import { useRef, useState } from "react";
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const CODE_LENGTH = 4;

function PasscodeScreen() {
  const qc = useQueryClient();
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKey = async (k: string) => {
    if (loading) return;
    if (k === "del") {
      setDigits((p) => p.slice(0, -1));
      setError("");
      return;
    }
    const next = [...digits, k];
    setDigits(next);
    setError("");
    if (next.length === CODE_LENGTH) {
      setLoading(true);
      try {
        const res = await fetch("/api/dev-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: next.join("") }),
          credentials: "include",
        });
        if (res.ok) {
          await qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
        } else {
          setError("Wrong code — try again");
          setDigits([]);
        }
      } catch {
        setError("Connection error — try again");
        setDigits([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-10 px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Carda</h1>
        <p className="text-muted-foreground text-base">Enter your access code</p>
      </div>

      <div className="flex gap-4">
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < digits.length
                ? "bg-primary border-primary"
                : "bg-transparent border-border"
            }`}
          />
        ))}
      </div>

      <div className="h-5 text-center">
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 w-64">
          {keys.map((k, i) => {
            if (k === "") return <div key={i} />;
            const isDel = k === "del";
            return (
              <button
                key={i}
                onClick={() => handleKey(k)}
                className={`h-20 rounded-full text-2xl font-normal transition-all active:scale-95 ${
                  isDel
                    ? "bg-transparent text-muted-foreground text-3xl"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {isDel ? "⌫" : k}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={PasscodeScreen} />
      ) : (
        <Route path="/" component={HomePage} />
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Toaster />
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
