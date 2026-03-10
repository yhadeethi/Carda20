import { useState, useEffect } from "react";
import { Sparkles, Bell, CheckSquare, ChevronDown, Loader2, X, Check } from "lucide-react";
import { loadContacts } from "@/lib/contactsStorage";
import type { StoredContact } from "@/lib/contactsStorage";
import {
  addNote,
  addTask,
  addReminder,
  addTimelineEvent,
  updateContactV2,
  upsertContact,
  getContactById,
} from "@/lib/contacts/storage";
import { fuzzyMatchContact } from "@/lib/contacts/fuzzyMatch";
import { parseNaturalDate } from "@/lib/contacts/dateParser";
import { generateId } from "@/lib/contacts/ids";
import { useToast } from "@/hooks/use-toast";

interface VoiceDebriefReviewProps {
  transcript: string;
  onComplete: (contactId: string) => void;
  onCancel: () => void;
}

interface MatchedContact {
  id: string | null;
  name: string;
  matchedName: string;
  company: string;
  confidence: "high" | "medium" | "low";
}

interface ParsedTask {
  title: string;
  dueDescription: string | null;
}

interface ParsedReminder {
  label: string;
  whenDescription: string | null;
}

interface ParseResult {
  matchedContact: MatchedContact;
  noteSummary: string;
  sentiment: "positive" | "neutral" | "negative";
  warmthLevel: "hot" | "warm" | "neutral" | "cold";
  tasks: ParsedTask[];
  reminders: ParsedReminder[];
  rawTranscript: string;
}

type Sentiment = "positive" | "neutral" | "negative";
type WarmthLevel = "hot" | "warm" | "neutral" | "cold";

const WARMTH_MAP: Record<WarmthLevel, string> = {
  hot: "CLOSE",
  warm: "NORMAL",
  neutral: "CASUAL",
  cold: "UNKNOWN",
};

const DEFAULT_ORG = {
  department: "UNKNOWN" as const,
  reportsToId: null,
  role: "UNKNOWN" as const,
  influence: "UNKNOWN" as const,
  relationshipStrength: "UNKNOWN" as const,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function VoiceDebriefReviewSheet({ transcript, onComplete, onCancel }: VoiceDebriefReviewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Editable state
  const [noteSummary, setNoteSummary] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("neutral");
  const [warmthLevel, setWarmthLevel] = useState<WarmthLevel>("neutral");
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [reminders, setReminders] = useState<ParsedReminder[]>([]);

  // Contact selection state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isCreateNew, setIsCreateNew] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactCompany, setNewContactCompany] = useState("");
  const [fuzzySuggestions, setFuzzySuggestions] = useState<Array<{ contact: StoredContact & { fullName: string; companyName: string }; score: number }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const contacts = loadContacts();
    const contactsForApi = contacts.map((c) => ({
      id: c.id,
      fullName: c.name,
      companyName: c.company,
    }));

    const fetchParse = async () => {
      try {
        const res = await fetch("/api/debrief/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ transcript, contacts: contactsForApi }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Parse failed");
        }

        const data: ParseResult = await res.json();
        setParseResult(data);
        setNoteSummary(data.noteSummary || "");
        setSentiment(data.sentiment || "neutral");
        setWarmthLevel(data.warmthLevel || "neutral");
        setTasks(data.tasks || []);
        setReminders(data.reminders || []);

        // Set matched contact
        if (data.matchedContact?.id) {
          const localContact = contacts.find((c) => c.id === data.matchedContact.id);
          if (localContact) {
            setSelectedContactId(data.matchedContact.id);
            setShowSuggestions(false);
          } else {
            // AI matched an unknown id — treat as low confidence
            handleLowConfidenceMatch(data, contacts);
          }
        } else {
          handleLowConfidenceMatch(data, contacts);
        }
      } catch (err) {
        console.error("[VoiceDebriefReview] Parse error:", err);
        setError(err instanceof Error ? err.message : "Could not parse debrief");
      } finally {
        setLoading(false);
      }
    };

    function handleLowConfidenceMatch(data: ParseResult, contacts: StoredContact[]) {
      const queryName = data.matchedContact?.name || "";
      const queryCompany = data.matchedContact?.company || "";
      const query = [queryName, queryCompany].filter(Boolean).join(" ");

      const contactsForFuzzy = contacts.map((c) => ({
        id: c.id,
        fullName: c.name,
        companyName: c.company,
      }));

      const suggestions = fuzzyMatchContact(query, contactsForFuzzy);
      // Map back to StoredContact-like shape
      const mappedSuggestions = suggestions.map((s) => {
        const orig = contacts.find((c) => c.id === s.contact.id)!;
        return {
          contact: { ...orig, fullName: orig.name, companyName: orig.company },
          score: s.score,
        };
      });
      setFuzzySuggestions(mappedSuggestions);
      setShowSuggestions(true);
      setNewContactName(queryName);
      setNewContactCompany(queryCompany || data.matchedContact?.company || "");
    }

    fetchParse();
  }, [transcript]);

  const handleConfirm = async () => {
    let contactId = selectedContactId;

    if (isCreateNew) {
      // Create minimal new contact
      const now = new Date().toISOString();
      const newContact = {
        id: generateId(),
        createdAt: now,
        name: newContactName.trim() || "New Contact",
        company: newContactCompany.trim(),
        title: "",
        email: "",
        phone: "",
        website: "",
        linkedinUrl: "",
        address: "",
        eventName: null,
        org: { ...DEFAULT_ORG },
        tasks: [],
        reminders: [],
        timeline: [],
        lastTouchedAt: now,
        _needsUpsert: true as const,
      };
      const created = upsertContact(newContact as Parameters<typeof upsertContact>[0]);
      contactId = created.id;
    }

    if (!contactId) return;

    setSaving(true);
    try {
      // 1. Add note (synchronous)
      if (noteSummary.trim()) {
        addNote(contactId, noteSummary.trim());
      }

      // 2. Add tasks
      for (const task of tasks) {
        const dueDate = task.dueDescription ? parseNaturalDate(task.dueDescription) : null;
        await addTask(contactId, task.title, dueDate?.toISOString());
      }

      // 3. Add reminders
      for (const reminder of reminders) {
        const remindAt = reminder.whenDescription
          ? parseNaturalDate(reminder.whenDescription)
          : null;
        // remindAt is required — skip reminders with no parseable date
        if (remindAt) {
          await addReminder(contactId, reminder.label, remindAt.toISOString());
        }
      }

      // 4. Update contact warmth + lastTouchedAt
      const existingContact = getContactById(contactId);
      const currentOrg = existingContact?.org ?? DEFAULT_ORG;
      await updateContactV2(contactId, {
        org: {
          ...currentOrg,
          relationshipStrength: WARMTH_MAP[warmthLevel] as "CLOSE" | "NORMAL" | "CASUAL" | "UNKNOWN",
        },
        lastTouchedAt: new Date().toISOString(),
      });

      // 5. Add timeline event
      await addTimelineEvent(contactId, "voice_debrief", noteSummary.trim(), {
        rawTranscript: transcript,
        sentiment,
        warmth: warmthLevel,
      });

      onComplete(contactId);
    } catch (err) {
      console.error("[VoiceDebriefReview] Save error:", err);
      toast({
        title: "Save failed",
        description: "Could not save debrief. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = (selectedContactId !== null || isCreateNew) && !saving;

  // ── Skeleton Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-5 pt-4 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
        <div className="flex items-center justify-between">
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-6 w-28 rounded-full bg-violet-500/20 animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className="px-5 pt-4 pb-8 text-center space-y-4">
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const matchedContact = parseResult?.matchedContact;
  const displayName = isCreateNew
    ? newContactName || "New Contact"
    : selectedContactId
    ? loadContacts().find((c) => c.id === selectedContactId)?.name ?? matchedContact?.matchedName ?? matchedContact?.name ?? "Unknown"
    : matchedContact?.name ?? "";

  const displayCompany = isCreateNew
    ? newContactCompany
    : selectedContactId
    ? loadContacts().find((c) => c.id === selectedContactId)?.company ?? matchedContact?.company ?? ""
    : matchedContact?.company ?? "";

  return (
    <div className="flex flex-col">
      {/* Drag handle */}
      <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-0 flex-shrink-0" />

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 py-3 flex items-center justify-between border-b border-border/40">
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground font-medium px-1"
        >
          Discard
        </button>
        <div className="flex items-center gap-1.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold px-3 py-1.5 rounded-full">
          <Sparkles className="w-3.5 h-3.5" />
          AI DEBRIEF
        </div>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Confirm
        </button>
      </div>

      <div className="overflow-y-auto px-5 pb-8 space-y-5 pt-4">

        {/* ── Contact Match ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>

          {selectedContactId && !showSuggestions ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {getInitials(displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                {displayCompany && (
                  <p className="text-xs text-muted-foreground truncate">{displayCompany}</p>
                )}
              </div>
              {matchedContact?.confidence === "high" && (
                <span className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                  Matched
                </span>
              )}
              <button
                onClick={() => { setShowSuggestions(true); setSelectedContactId(null); }}
                className="text-xs text-muted-foreground underline underline-offset-2 flex-shrink-0"
              >
                Change
              </button>
            </div>
          ) : isCreateNew ? (
            <div className="space-y-2 p-3 rounded-2xl bg-muted/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">New Contact</p>
                <button
                  onClick={() => { setIsCreateNew(false); setShowSuggestions(true); }}
                  className="text-xs text-muted-foreground"
                >
                  Back
                </button>
              </div>
              <input
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Full name"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
              <input
                value={newContactCompany}
                onChange={(e) => setNewContactCompany(e.target.value)}
                placeholder="Company (optional)"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {fuzzySuggestions.slice(0, 3).map(({ contact }) => (
                <button
                  key={contact.id}
                  onClick={() => { setSelectedContactId(contact.id); setIsCreateNew(false); setShowSuggestions(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted/40 text-left active:bg-muted/70 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {getInitials(contact.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{contact.fullName}</p>
                    {contact.companyName && (
                      <p className="text-xs text-muted-foreground truncate">{contact.companyName}</p>
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setIsCreateNew(true); setShowSuggestions(false); }}
                className="w-full flex items-center gap-2 p-3 rounded-2xl border border-dashed border-border text-sm text-muted-foreground"
              >
                <span className="text-base">+</span> Create new contact
              </button>
            </div>
          )}
        </div>

        {/* ── Meeting Note ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meeting Note</p>
          <textarea
            value={noteSummary}
            onChange={(e) => setNoteSummary(e.target.value)}
            rows={3}
            className="w-full text-sm bg-muted/40 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-foreground placeholder:text-muted-foreground"
            placeholder="Summary of the meeting..."
          />
        </div>

        {/* ── Sentiment ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sentiment</p>
          <div className="flex gap-2">
            {(["positive", "neutral", "negative"] as Sentiment[]).map((s) => {
              const labels = { positive: "↗ Positive", neutral: "→ Neutral", negative: "↘ Negative" };
              const colors: Record<Sentiment, string> = {
                positive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                neutral: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
                negative: "bg-red-500/15 text-red-500 border-red-500/30",
              };
              const isActive = sentiment === s;
              return (
                <button
                  key={s}
                  onClick={() => setSentiment(s)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${
                    isActive ? colors[s] : "bg-muted/40 text-muted-foreground border-transparent"
                  }`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Warmth ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Warmth</p>
          <div className="flex gap-2">
            {(["hot", "warm", "neutral", "cold"] as WarmthLevel[]).map((w) => {
              const colors: Record<WarmthLevel, string> = {
                hot: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
                warm: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
                neutral: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
                cold: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
              };
              const isActive = warmthLevel === w;
              return (
                <button
                  key={w}
                  onClick={() => setWarmthLevel(w)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border capitalize transition-colors ${
                    isActive ? colors[w] : "bg-muted/40 text-muted-foreground border-transparent"
                  }`}
                >
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tasks ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tasks {tasks.length > 0 && <span className="normal-case font-normal">({tasks.length})</span>}
          </p>
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No tasks extracted</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40">
                  <CheckSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{task.title}</p>
                    {task.dueDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5">{task.dueDescription}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    aria-label="Remove task"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Reminders ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Reminders {reminders.length > 0 && <span className="normal-case font-normal">({reminders.length})</span>}
          </p>
          {reminders.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No reminders extracted</p>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40">
                  <Bell className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{reminder.label}</p>
                    {reminder.whenDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5">{reminder.whenDescription}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setReminders((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    aria-label="Remove reminder"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Raw Transcript (collapsible) ── */}
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none list-none">
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            Raw Transcript
          </summary>
          <p className="mt-2 text-sm text-muted-foreground italic leading-relaxed px-1">
            {transcript}
          </p>
        </details>

      </div>
    </div>
  );
}
