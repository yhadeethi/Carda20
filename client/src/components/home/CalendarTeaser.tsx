import { CalendarDays } from "lucide-react";

export function CalendarTeaser() {
  return (
    <div
      className="rounded-2xl border border-border/30 border-dashed bg-card/30 p-4"
      data-testid="banner-calendar-teaser"
      style={{
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">Daily Briefing</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
              Coming Soon
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            See who you're meeting today — with context from your network
          </p>
        </div>
      </div>
    </div>
  );
}
