import { useState, useEffect } from "react";
import { Sparkles, Bell, CheckSquare, ChevronDown, Loader2, X, Check, Mail, GitBranch, Flag, Zap } from "lucide-react";
import { loadContacts } from "@/lib/contactsStorage";
import type { StoredContact } from "@/lib/contactsStorage";
import {
  addTask,
  addReminder,
  addTimelineEvent,
  updateContactV2,
  upsertContact,
  getContactById,
} from "@/lib/contacts/storage";
import type { CommunicationIntent, DraftAction, OrgRelationship, ActionItem, DealSignal } from "@/lib/contacts/types";
import { fuzzyMatchContact } from "@/lib/contacts/fuzzyMatch";
import { parseNaturalDate } from "@/lib/contacts/dateParser";
import { generateId } from "@/lib/contacts/ids";
import { useToast } from "@/hooks/use-toast";

interface VoiceDebriefReviewProps {
  transcript: string;
  onComplete: (contactId: string) => void;
  onCancel: () => void;
  /** Pre-select a contact when launching debrief from Contact Detail view */
  preSelectedContactId?: string | null;
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
  draftBody?: string;
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
  communicationIntents: CommunicationIntent[];
  orgRelationships: OrgRelationship[];
  actionItems: ActionItem[];
  dealSignals: DealSignal[];
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

export function VoiceDebriefReviewSheet({ transcript, onComplete, onCancel, preSelectedContactId }: VoiceDebriefReviewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const [noteSummary, setNoteSummary] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("neutral");
  const [warmthLevel, setWarmthLevel] = useState<WarmthLevel>("neutral");
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [reminders, setReminders] = useState<ParsedReminder[]>([]);
  const [orgRelationships, setOrgRelationships] = useState<OrgRelationship[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [dealSignals, setDealSignals] = useState<DealSignal[]>([]);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(preSelectedContactId || null);
  const [isCreateNew, setIsCreateNew] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactCompany, setNewContactCompany] = useState("");
  const [fuzzySuggestions, setFuzzySuggestions] = useState<Array<{ contact: StoredContact & { fullName: string; companyName: string }; score: number }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [expandedDraftIdx, setExpandedDraftIdx] = useState<number | null>(null);
  const [editingDraftIdx, setEditingDraftIdx] = useState<number | null>(null);
  const [editingDraftBody, setEditingDraftBody] = useState("");
  const [sentConfirmIdx, setSentConfirmIdx] = useState<number | null>(null);

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
        setOrgRelationships(data.orgRelationships || []);
        setActionItems(data.actionItems || []);
        setDealSignals(data.dealSignals || []);

        // If pre-selected contact, skip matching
        if (preSelectedContactId) {
          const localContact = contacts.find((c) => c.id === preSelectedContactId);
          if (localContact) {
            setSelectedContactId(preSelectedContactId);
            setShowSuggestions(false);
          }
        } else if (data.matchedContact?.id) {
          const localContact = contacts.find((c) => c.id === data.matchedContact.id);
          if (localContact) {
            setSelectedContactId(data.matchedContact.id);
            setShowSuggestions(false);
          } else {
            handleLowConfidenceMatch(data, contacts);
          }
        } else {
          handleLowConfidenceMatch(data, contacts);
        }

        // Fire draft generation in parallel
        const intents: CommunicationIntent[] = data.communicationIntents || [];
        if (intents.length > 0) {
          setDraftsLoading(true);
          Promise.allSettled(
            intents.map((intent) =>
              fetch("/api/followup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  contact: {
                    name: intent.recipientName,
                    company: intent.recipientCompany,
                  },
                  request: {
                    mode: "email_followup",
                    tone: intent.suggestedTone,
                    length: "short",
                    goal: intent.intentDescription,
                  },
                }),
              }).then((r) => {
                if (!r.ok) throw new Error("followup failed");
                return r.json();
              })
            )
          ).then((results) => {
            const drafts: DraftAction[] = [];
            results.forEach((result, i) => {
              if (result.status === "fulfilled") {
                drafts.push({
                  recipientName: intents[i].recipientName,
                  recipientCompany: intents[i].recipientCompany,
                  subject: result.value.subject ?? null,
                  body: result.value.body,
                  status: "ready",
                });
              }
            });
            setDraftActions(drafts);
            setDraftsLoading(false);
          });
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
  }, [transcript, preSelectedContactId]);

  const handleConfirm = async () => {
    let contactId = selectedContactId;

    if (isCreateNew) {
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
      // Save tasks
      for (const task of tasks) {
        const dueDate = task.dueDescription ? parseNaturalDate(task.dueDescription) : null;
        await addTask(contactId, task.title, dueDate?.toISOString(), task.draftBody);
      }

      // Save reminders
      for (const reminder of reminders) {
        const remindAt = reminder.whenDescription
          ? parseNaturalDate(reminder.whenDescription)
          : null;
        if (remindAt) {
          await addReminder(contactId, reminder.label, remindAt.toISOString());
        }
      }

      // Update warmth
      const existingContact = getContactById(contactId);
      const currentOrg = existingContact?.org ?? DEFAULT_ORG;
      await updateContactV2(contactId, {
        org: {
          ...currentOrg,
          relationshipStrength: WARMTH_MAP[warmthLevel] as "CLOSE" | "NORMAL" | "CASUAL" | "UNKNOWN",
        },
        lastTouchedAt: new Date().toISOString(),
      });

      // Auto-create org relationships from parsed data
      for (const rel of orgRelationships) {
        if (rel.personContactId && rel.reportsToContactId) {
          // Both contacts identified — update the person's reportsToId
          const personContact = getContactById(rel.personContactId);
          if (personContact) {
            const personOrg = personContact.org ?? DEFAULT_ORG;
            await updateContactV2(rel.personContactId, {
              org: {
                ...personOrg,
                reportsToId: rel.reportsToContactId,
              },
            });
          }
        }
      }

      // Save timeline event with enhanced metadata
      await addTimelineEvent(contactId, "voice_debrief", noteSummary.trim(), {
        rawTranscript: transcript,
        sentiment,
        warmth: warmthLevel,
        orgRelationships: orgRelationships.length > 0 ? orgRelationships : undefined,
        actionItems: actionItems.length > 0 ? actionItems : undefined,
        dealSignals: dealSignals.length > 0 ? dealSignals : undefined,
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

  const handleDraftSend = (idx: number, body: string, subject: string | null) => {
    const contacts = loadContacts();
    const contact = selectedContactId ? contacts.find((c) => c.id === selectedContactId) : null;
    if (contact?.email) {
      const mailto = `mailto:${contact.email}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    } else {
      navigator.clipboard.writeText(body).catch(() => {});
      toast({ title: "No email on file — copied to clipboard" });
    }
    setSentConfirmIdx(idx);
  };

  const handleDraftSentYes = (idx: number) => {
    if (selectedContactId) {
      addTimelineEvent(
        selectedContactId,
        "followup_sent",
        `Sent draft to ${draftActions[idx]?.recipientName}`
      );
    }
    setDraftActions((prev) => prev.filter((_, i) => i !== idx));
    setSentConfirmIdx(null);
    setExpandedDraftIdx(null);
  };

  const handleDraftSentNo = (idx: number) => {
    handleDraftDismiss(idx);
    setSentConfirmIdx(null);
  };

  const handleDraftDismiss = (idx: number) => {
    const draft = draftActions[idx];
    setDraftActions((prev) => prev.filter((_, i) => i !== idx));
    setTasks((prev) => [
      ...prev,
      {
        title: `Send note to ${draft.recipientName}`,
        dueDescription: null,
        draftBody: draft.body,
      },
    ]);
    setExpandedDraftIdx(null);
  };

  const canConfirm = (selectedContactId !== null || isCreateNew) && !saving;

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
      <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-0 flex-shrink-0" />

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 py-3 flex items-center justify-between border-b border-border/40">
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground font-medium px-1"
          data-testid="button-discard-debrief"
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
          data-testid="button-confirm-debrief"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Confirm
        </button>
      </div>

      <div className="overflow-y-auto px-5 pb-8 space-y-5 pt-4">

        {/* Contact selection */}
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
              {matchedContact?.confidence === "high" && !preSelectedContactId && (
                <span className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                  Matched
                </span>
              )}
              {preSelectedContactId && (
                <span className="text-xs bg-[#4B68F5]/10 text-[#4B68F5] font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                  Pre-linked
                </span>
              )}
              {!preSelectedContactId && (
                <button
                  onClick={() => { setShowSuggestions(true); setSelectedContactId(null); }}
                  className="text-xs text-muted-foreground underline underline-offset-2 flex-shrink-0"
                  data-testid="button-change-contact"
                >
                  Change
                </button>
              )}
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
                data-testid="input-new-contact-name"
              />
              <input
                value={newContactCompany}
                onChange={(e) => setNewContactCompany(e.target.value)}
                placeholder="Company (optional)"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                data-testid="input-new-contact-company"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {fuzzySuggestions.slice(0, 3).map(({ contact }) => (
                <button
                  key={contact.id}
                  onClick={() => { setSelectedContactId(contact.id); setIsCreateNew(false); setShowSuggestions(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted/40 text-left active:bg-muted/70 transition-colors"
                  data-testid={`button-select-contact-${contact.id}`}
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
                data-testid="button-create-new-contact"
              >
                <span className="text-base">+</span> Create new contact
              </button>
            </div>
          )}
        </div>

        {/* Meeting Note */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meeting Note</p>
          <textarea
            value={noteSummary}
            onChange={(e) => setNoteSummary(e.target.value)}
            rows={3}
            className="w-full text-sm bg-muted/40 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-foreground placeholder:text-muted-foreground"
            placeholder="Summary of the meeting..."
            data-testid="input-meeting-note"
          />
        </div>

        {/* Sentiment */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sentiment</p>
          <div className="flex gap-2">
            {(["positive", "neutral", "negative"] as Sentiment[]).map((s) => {
              const labels = { positive: "Positive", neutral: "Neutral", negative: "Negative" };
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
                  data-testid={`button-sentiment-${s}`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Warmth */}
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
                  data-testid={`button-warmth-${w}`}
                >
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Org Relationships — NEW */}
        {orgRelationships.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Org Relationships <span className="normal-case font-normal">({orgRelationships.length})</span>
            </p>
            <div className="space-y-2">
              {orgRelationships.map((rel, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40">
                  <GitBranch className="w-4 h-4 text-[#7B5CF0] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{rel.personName}</span>
                      {" reports to "}
                      <span className="font-semibold">{rel.reportsToName}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {rel.personContactId && rel.reportsToContactId && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">
                          Will auto-link
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {rel.confidence} confidence
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setOrgRelationships((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    aria-label="Remove relationship"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deal Signals — NEW */}
        {dealSignals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Deal Signals <span className="normal-case font-normal">({dealSignals.length})</span>
            </p>
            <div className="space-y-2">
              {dealSignals.map((signal, i) => {
                const strengthColors: Record<string, string> = {
                  strong: "bg-emerald-500/15 text-emerald-600",
                  moderate: "bg-amber-500/15 text-amber-600",
                  weak: "bg-slate-500/15 text-slate-600",
                };
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{signal.signal}</p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${strengthColors[signal.strength] || strengthColors.weak}`}>
                        {signal.strength}
                      </span>
                    </div>
                    <button
                      onClick={() => setDealSignals((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      aria-label="Remove signal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Items — NEW */}
        {actionItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Action Items <span className="normal-case font-normal">({actionItems.length})</span>
            </p>
            <div className="space-y-2">
              {actionItems.map((item, i) => {
                const ownerColors: Record<string, string> = {
                  user: "bg-[#4B68F5]/10 text-[#4B68F5]",
                  contact: "bg-amber-500/10 text-amber-700",
                  unknown: "bg-slate-500/10 text-slate-600",
                };
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40">
                    <Flag className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ownerColors[item.owner] || ownerColors.unknown}`}>
                          {item.owner === "user" ? "You" : item.owner === "contact" ? "Them" : "TBD"}
                        </span>
                        {item.dueDescription && (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {item.dueDescription}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setActionItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      aria-label="Remove action item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks */}
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
                  {task.draftBody ? (
                    <Mail className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
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
                    data-testid={`button-remove-task-${i}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminders */}
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
                    data-testid={`button-remove-reminder-${i}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drafts section */}
        {(draftsLoading || draftActions.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Drafts
            </p>
            {draftsLoading && draftActions.length === 0 ? (
              <div className="h-16 rounded-2xl bg-muted animate-pulse" />
            ) : (
              <div className="space-y-2">
                {draftActions.map((draft, idx) => (
                  <div key={idx} className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
                    <button
                      className="w-full flex items-start gap-3 p-3 text-left"
                      onClick={() => setExpandedDraftIdx(expandedDraftIdx === idx ? null : idx)}
                    >
                      <Mail className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {draft.recipientName}
                          {draft.recipientCompany ? ` · ${draft.recipientCompany}` : ""}
                        </p>
                        {draft.subject && (
                          <p className="text-xs text-muted-foreground mt-0.5">{draft.subject}</p>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
                          expandedDraftIdx === idx ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expandedDraftIdx === idx && (
                      <div className="px-3 pb-3 space-y-3">
                        {editingDraftIdx === idx ? (
                          <textarea
                            value={editingDraftBody}
                            onChange={(e) => setEditingDraftBody(e.target.value)}
                            rows={5}
                            className="w-full text-sm bg-muted/40 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {draft.body}
                          </p>
                        )}

                        {sentConfirmIdx === idx ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-center text-foreground">Did you send it?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDraftSentYes(idx)}
                                className="flex-1 py-2 text-xs font-medium rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => handleDraftSentNo(idx)}
                                className="flex-1 py-2 text-xs font-medium rounded-xl bg-muted/40 text-muted-foreground border border-transparent"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : editingDraftIdx === idx ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setDraftActions((prev) =>
                                  prev.map((d, i) =>
                                    i === idx ? { ...d, body: editingDraftBody } : d
                                  )
                                );
                                setEditingDraftIdx(null);
                                handleDraftSend(idx, editingDraftBody, draft.subject);
                              }}
                              className="flex-1 py-2 text-xs font-medium rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30"
                            >
                              Save + Send
                            </button>
                            <button
                              onClick={() => { setEditingDraftIdx(null); setEditingDraftBody(""); }}
                              className="flex-1 py-2 text-xs font-medium rounded-xl bg-muted/40 text-muted-foreground border border-transparent"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDraftSend(idx, draft.body, draft.subject)}
                              className="flex-1 py-2 text-xs font-medium rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30"
                            >
                              Send
                            </button>
                            <button
                              onClick={() => { setEditingDraftIdx(idx); setEditingDraftBody(draft.body); }}
                              className="flex-1 py-2 text-xs font-medium rounded-xl bg-muted/40 text-muted-foreground border border-transparent"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDraftDismiss(idx)}
                              className="flex-1 py-2 text-xs font-medium rounded-xl bg-muted/40 text-muted-foreground border border-transparent"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Raw Transcript */}
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
