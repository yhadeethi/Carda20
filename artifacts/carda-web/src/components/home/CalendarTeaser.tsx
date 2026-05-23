// TODO: connect Google Calendar / Outlook
import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Lock, Sparkles } from "lucide-react";

interface Meeting {
  time: string;
  title: string;
  person?: string;
  company?: string;
  context?: string;
  inCarda: boolean;
}

interface CalendarTeaserProps {
  meetings?: Meeting[];
}

// Static preview data — shown when expanded without a real calendar connected
const PREVIEW_MEETINGS: Meeting[] = [
  {
    time: "9:00",
    title: "Intro call — BHP Procurement",
    person: "Sarah Chen",
    company: "BHP",
    context: "Last debrief: 'Strong interest in Q1 rollout. Follow up on pricing deck.' Talking point: BHP announced $2.1B CapEx expansion last week.",
    inCarda: true,
  },
  {
    time: "11:30",
    title: "Demo — Fortescue Metals",
    person: "James Okafor",
    company: "Fortescue Metals Group",
    context: undefined,
    inCarda: false,
  },
  {
    time: "14:00",
    title: "Catchup — Rio Tinto BD",
    person: "Mia Russo",
    company: "Rio Tinto",
    context: "Not yet in Carda — scan card after the meeting.",
    inCarda: false,
  },
];

export function CalendarTeaser({ meetings = [] }: CalendarTeaserProps) {
  const [expanded, setExpanded] = useState(false);

  const isLive = meetings.length > 0;
  const displayMeetings = isLive ? meetings : PREVIEW_MEETINGS;

  return (
    <div
      className="rounded-2xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 shadow-sm overflow-hidden"
      data-testid="banner-calendar-teaser"
    >
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        aria-expanded={expanded}
      >
        <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            Daily Briefing
          </div>
          <div className="text-sm font-semibold text-foreground">
            {isLive
              ? `${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} today`
              : "Connect your calendar"}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Coming soon badge — only when not live */}
          {!isLive && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4B68F5]/10 border border-[#4B68F5]/20">
              <span className="bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] bg-clip-text text-transparent">
                Coming soon
              </span>
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
          }
        </div>
      </button>

      {/* Expanded view */}
      {expanded && (
        <div>
          {/* Preview banner — shown when no real calendar connected */}
          {!isLive && (
            <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-3 py-2.5">
              <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Preview — what this will look like</p>
                <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5 leading-relaxed">
                  Connect Google Calendar or Outlook and Carda will brief you before every meeting — pulling context from your network automatically.
                </p>
              </div>
            </div>
          )}

          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {displayMeetings.map((meeting, idx) => (
              <div key={idx} className={`px-4 py-3 ${!isLive ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="text-[11px] font-semibold text-muted-foreground/70 w-12 shrink-0 pt-0.5 tabular-nums">
                    {meeting.time}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{meeting.title}</div>
                    {(meeting.person || meeting.company) && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {[meeting.person, meeting.company].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {meeting.inCarda && meeting.context ? (
                      <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-3 py-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{meeting.context}</p>
                      </div>
                    ) : !meeting.inCarda ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          Not in Carda — capture after meeting
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Connect CTA — only when not live */}
          {!isLive && (
            <div className="px-4 pt-2 pb-4">
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium text-muted-foreground bg-muted/30 cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                Connect Calendar — Coming Soon
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
