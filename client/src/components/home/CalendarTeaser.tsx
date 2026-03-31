// TODO: connect Google Calendar
import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

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

export function CalendarTeaser({ meetings = [] }: CalendarTeaserProps) {
  const [expanded, setExpanded] = useState(false);

  const hasMeetings = meetings.length > 0;
  const meetingLabel = hasMeetings
    ? `${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} today`
    : "Connect your calendar";

  return (
    <div
      className="rounded-2xl bg-white border border-black/10 shadow-sm overflow-hidden"
      data-testid="banner-calendar-teaser"
    >
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        aria-expanded={expanded}
      >
        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            Daily Briefing
          </div>
          <div className="text-sm font-semibold text-foreground">{meetingLabel}</div>
        </div>
        {hasMeetings ? (
          expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        ) : null}
      </button>

      {/* Expanded meetings list */}
      {expanded && hasMeetings && (
        <div className="divide-y divide-black/[0.06]">
          {meetings.map((meeting, idx) => (
            <div key={idx} className="px-4 py-3">
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
                    <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                      <p className="text-xs text-blue-700 leading-relaxed">{meeting.context}</p>
                    </div>
                  ) : !meeting.inCarda ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-[11px] font-medium text-amber-700">
                        Not in Carda — capture after meeting
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
