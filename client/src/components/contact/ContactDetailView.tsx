import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  ArrowLeft,
  Bell,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit,
  Globe,
  Linkedin,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { SiHubspot, SiLinkedin, SiSalesforce } from "react-icons/si";

import { CompanyIntelV2Card } from "@/components/company-intel-v2";
import { TimelineFeed, TimelineItem, TimelineEventType } from "./TimelineFeed";

import { StoredContact, RelationshipStrength } from "@/lib/contactsStorage";
import {
  ContactV2,
  addNote,
  addReminder,
  addTask,
  clearTaskDraftBody,
  completeTask,
  deleteTask,
  updateTaskTitle,
  addTimelineEvent,
  updateContactV2,
} from "@/lib/contacts/storage";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  extractDomainFromEmail,
  extractDomainFromWebsite,
} from "@/lib/companiesStorage";
import { useIntelV2 } from "@/hooks/use-intel-v2";
import {
  generateFollowUp,
  FOLLOWUP_LENGTH_LABELS,
  FOLLOWUP_MODE_LABELS,
  FOLLOWUP_TONE_LABELS,
} from "@/lib/followup/followup";
import {
  FollowUpLength,
  FollowUpMode,
  FollowUpResponse,
  FollowUpTone,
} from "@/lib/contacts/types";
import {
  createMeetingWithContact,
  downloadIcsFile,
  getQuickTimeSlots,
} from "@/lib/calendar/ics";

interface ContactDetailViewProps {
  contact: StoredContact;
  contactV2: ContactV2 | null;
  onBack: () => void;
  onDelete?: (id: string) => void;
  onUpdate: () => void;
  onContactUpdated?: (contactId: string) => void;
  onDownloadVCard: () => void;
  onViewInOrgMap?: (companyId: string) => void;
  companyId?: string | null;
  autoOpenFollowUp?: boolean;
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildFollowUpCopyText(res: FollowUpResponse): string {
  const subject = res.subject ? `Subject: ${res.subject}\n\n` : "";
  return `${subject}${res.body}`.trim();
}

function sanitizePhone(p?: string | null): string | null {
  if (!p) return null;
  const cleaned = p.replace(/[^\d+]/g, "");
  return cleaned.length ? cleaned : null;
}

function openMailto(to: string, subject: string | undefined, body: string) {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  params.push(`body=${encodeURIComponent(body)}`);
  window.location.href = `mailto:${encodeURIComponent(to)}?${params.join("&")}`;
}

function openSms(phone: string, body: string) {
  window.location.href = `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(body)}`;
}

function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!active) { setInset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const compute = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(Math.min(420, Math.round(keyboard)));
    };
    compute();
    vv.addEventListener("resize", compute);
    vv.addEventListener("scroll", compute);
    return () => { vv.removeEventListener("resize", compute); vv.removeEventListener("scroll", compute); };
  }, [active]);
  return inset;
}

// FIX #1: Company logo via favicon, falls back to initials
function CompanyLogo({ company, domain }: { company?: string | null; domain?: string | null }) {
  const [imgError, setImgError] = useState(false);
  const src = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;
  const initials = (company || "?").slice(0, 2).toUpperCase();

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={company || ""}
        onError={() => setImgError(true)}
        className="w-4 h-4 rounded-sm object-contain"
      />
    );
  }
  return (
    <span className="w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center text-[8px] font-bold text-white/80 shrink-0">
      {initials}
    </span>
  );
}

export function ContactDetailView({
  contact,
  contactV2,
  onBack,
  onDelete,
  onUpdate,
  onContactUpdated,
  onDownloadVCard,
  onViewInOrgMap,
  companyId,
  autoOpenFollowUp,
}: ContactDetailViewProps) {
  const { toast } = useToast();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [showLogStrip, setShowLogStrip] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "note" | "meeting" | "followup">("all");

  // ── Edit form ─────────────────────────────────────────────────────────────
  const [editedFields, setEditedFields] = useState({
    name: contact.name || "",
    title: contact.title || "",
    company: contact.company || "",
    email: contact.email || "",
    phone: contact.phone || "",
    website: contact.website || "",
    linkedinUrl: contact.linkedinUrl || "",
    address: contact.address || "",
  });
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [expandedDraftTaskId, setExpandedDraftTaskId] = useState<string | null>(null);
  const [draftSentConfirmTaskId, setDraftSentConfirmTaskId] = useState<string | null>(null);

  const contactTasks = useMemo(
    () => (contactV2?.tasks || []).filter((t) => !t.done),
    [contactV2]
  );

  // ── CRM sync ──────────────────────────────────────────────────────────────
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false);
  const [isSyncingSalesforce, setIsSyncingSalesforce] = useState(false);

  // ── Follow-up drawer ──────────────────────────────────────────────────────
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpMode, setFollowUpMode] = useState<FollowUpMode>("email_followup");
  const [followUpTone, setFollowUpTone] = useState<FollowUpTone>("friendly");
  const [followUpLength, setFollowUpLength] = useState<FollowUpLength>("medium");
  const [followUpGoal, setFollowUpGoal] = useState("");
  const [followUpContext, setFollowUpContext] = useState("");
  const [followUpResult, setFollowUpResult] = useState<FollowUpResponse | null>(null);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  useEffect(() => {
    if (!autoOpenFollowUp) return;
    const t = window.setTimeout(() => { setShowFollowUp(true); setFollowUpResult(null); }, 0);
    return () => window.clearTimeout(t);
  }, [autoOpenFollowUp]);

  const keyboardInset = useKeyboardInset(showFollowUp);

  // ── Meeting drawer ────────────────────────────────────────────────────────
  const quickSlots = useMemo(() => getQuickTimeSlots(), []);
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingStart, setMeetingStart] = useState<Date>(() => {
    const d = quickSlots[0]?.getTime();
    return d ? d : new Date();
  });
  const [meetingDuration, setMeetingDuration] = useState<number>(30);

  // ── Log sheet ─────────────────────────────────────────────────────────────
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [pendingLogType, setPendingLogType] = useState<string | null>(null);
  const [pendingLogLabel, setPendingLogLabel] = useState<string>("");
  const [logOutcome, setLogOutcome] = useState<"positive" | "neutral" | "negative" | null>(null);
  const [logNote, setLogNote] = useState("");

  // ── Intel drawer ──────────────────────────────────────────────────────────
  const [showIntel, setShowIntel] = useState(false);
  const intelV2 = useIntelV2();

  // ── CRM status ────────────────────────────────────────────────────────────
  const { data: hubspotStatus } = useQuery<{ connected: boolean }>({ queryKey: ["/api/hubspot/status"] });
  const { data: salesforceStatus } = useQuery<{ connected: boolean }>({ queryKey: ["/api/salesforce/status"] });

  // ── Computed ──────────────────────────────────────────────────────────────

  // FIX #2: Derive warmth directly from prop — never stale on remount
  const currentWarmth: RelationshipStrength = contactV2?.org?.relationshipStrength ?? "UNKNOWN";

  const scannedDaysAgo = useMemo(() => {
    if (!contact.createdAt) return null;
    const days = Math.round((Date.now() - new Date(contact.createdAt).getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }, [contact.createdAt]);

  const daysSinceLastTouch = useMemo(() => {
    if (!contactV2?.lastTouchedAt) return null;
    return Math.round((Date.now() - new Date(contactV2.lastTouchedAt).getTime()) / 86400000);
  }, [contactV2?.lastTouchedAt]);

  const companyNameForIntel = useMemo(() => {
    const c = (editedFields.company || contact.company || "").trim();
    return c.length ? c : null;
  }, [editedFields.company, contact.company]);

  const domainForIntel = useMemo(() => {
    const fromWebsite = extractDomainFromWebsite(editedFields.website || contact.website || "");
    const fromEmail = extractDomainFromEmail(editedFields.email || contact.email || "");
    return fromWebsite || fromEmail || null;
  }, [editedFields.website, editedFields.email, contact.website, contact.email]);

  const roleForIntel = useMemo(() => {
    const r = (editedFields.title || contact.title || "").trim();
    return r.length ? r : null;
  }, [editedFields.title, contact.title]);

  const addressForIntel = useMemo(() => {
    const a = (editedFields.address || contact.address || "").trim();
    return a.length ? a : null;
  }, [editedFields.address, contact.address]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    if (!contactV2?.timeline) return [];
    return contactV2.timeline
      .map((t) => ({
        id: t.id,
        type: t.type,
        title: t.summary,
        detail:
          typeof t.meta === "object" && t.meta !== null
            ? ((t.meta as any).bodyPreview as string | undefined)
            : undefined,
        meta:
          typeof t.meta === "object" && t.meta !== null
            ? {
                outcome: (t.meta as any).outcome as "positive" | "neutral" | "negative" | undefined,
                note: (t.meta as any).note as string | undefined,
                source: (t.meta as any).source as string | undefined,
              }
            : undefined,
        at: t.at,
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [contactV2]);

  const filteredTimelineItems = useMemo(() => {
    if (timelineFilter === "all") return timelineItems;
    return timelineItems.filter((t) => t.type.includes(timelineFilter));
  }, [timelineItems, timelineFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // FIX #2: Write to storage directly, no local warmth state
  const handleUpdateWarmth = async (value: RelationshipStrength) => {
    await updateContactV2(contact.id, {
      org: {
        department: contactV2?.org?.department ?? "UNKNOWN",
        reportsToId: contactV2?.org?.reportsToId ?? null,
        role: contactV2?.org?.role ?? "UNKNOWN",
        influence: contactV2?.org?.influence ?? "UNKNOWN",
        relationshipStrength: value,
      },
    });
    onUpdate();
  };

  const handleAddTask = async () => {
    const text = newTaskText.trim();
    if (!text) return;
    setNewTaskText("");
    await addTask(contact.id, text);
    onUpdate();
  };

  const handleCompleteTask = async (taskId: string) => {
    await completeTask(contact.id, taskId);
    onUpdate();
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(contact.id, taskId);
    onUpdate();
  };

  const handleStartEditTask = (taskId: string, currentTitle: string) => {
    setEditingTaskId(taskId);
    setEditingTaskText(currentTitle);
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTaskId) return;
    const text = editingTaskText.trim();
    if (text) { await updateTaskTitle(contact.id, editingTaskId, text); onUpdate(); }
    setEditingTaskId(null);
    setEditingTaskText("");
  };

  const handleDraftTaskSend = (task: { id: string; draftBody?: string }) => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent("Following up")}&body=${encodeURIComponent(task.draftBody ?? "")}`;
    } else {
      navigator.clipboard.writeText(task.draftBody ?? "").catch(() => {});
      toast({ title: "No email on file — copied to clipboard" });
    }
    setDraftSentConfirmTaskId(task.id);
  };

  const handleDraftSentYes = async (taskId: string, taskTitle: string) => {
    await completeTask(contact.id, taskId);
    await addTimelineEvent(contact.id, "followup_sent", `Sent draft: ${taskTitle}`);
    setDraftSentConfirmTaskId(null);
    setExpandedDraftTaskId(null);
    onUpdate();
  };

  const handleDiscardDraftBody = async (taskId: string) => {
    await clearTaskDraftBody(contact.id, taskId);
    setExpandedDraftTaskId(null);
    onUpdate();
  };

  const handleSaveEdits = async () => {
    setIsSavingEdits(true);
    try {
      const updated = updateContactV2(contact.id, editedFields);
      if (!updated) throw new Error("Failed to update contact");
      setIsEditing(false);
      toast({ title: "Contact updated" });
      onUpdate();
      onContactUpdated?.(contact.id);
      try { addTimelineEvent(contact.id, "contact_updated", "Contact details updated"); }
      catch (e) { console.warn("[ContactDetailView] Timeline event failed:", e); }
    } catch (e) {
      console.error("[ContactDetailView] Save failed:", e);
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleCall = () => { if (contact.phone) window.location.href = `tel:${contact.phone}`; };
  const handleEmail = () => { if (contact.email) window.location.href = `mailto:${contact.email}`; };
  const handleOpenWebsite = () => {
    if (!contact.website) return;
    const url = contact.website.includes("://") ? contact.website : `https://${contact.website}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleOpenLinkedIn = () => {
    if (contact.linkedinUrl) {
      window.open(contact.linkedinUrl, "_blank", "noopener,noreferrer");
    } else {
      window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact.name || "")}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleAddNote = async (text: string) => {
    setIsAddingNote(true);
    try { addNote(contact.id, text); onUpdate(); toast({ title: "Note added" }); }
    catch { toast({ title: "Failed to add note", variant: "destructive" }); }
    setIsAddingNote(false);
  };

  const handleQuickLog = useCallback(
    (type: TimelineEventType, summary: string, displayLabel: string) => {
      setPendingLogType(type);
      setPendingLogLabel(displayLabel);
      setLogOutcome(null);
      setLogNote("");
      setShowLogSheet(true);
    },
    []
  );

  const handleOpenLogSheet = useCallback(() => {
    setPendingLogType(null);
    setPendingLogLabel("Interaction");
    setLogOutcome(null);
    setLogNote("");
    setShowLogSheet(true);
  }, []);

  const handleConfirmLog = useCallback(
    async (outcomeOverride?: "positive" | "neutral" | "negative") => {
      const resolvedOutcome = outcomeOverride ?? logOutcome;
      if (!pendingLogType || !contactV2) return;
      await addTimelineEvent(contact.id, pendingLogType as any, pendingLogLabel, {
        source: "quick_log", outcome: resolvedOutcome, note: logNote,
      });
      if (resolvedOutcome === "positive") {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        await addReminder(contact.id, `Follow up with ${contact.name || "this contact"}`, dueDate.toISOString());
      }
      onUpdate();
      setShowLogSheet(false);
      setPendingLogType(null);
      setLogNote("");
      setLogOutcome(null);
      toast({
        title: resolvedOutcome === "positive"
          ? `${pendingLogLabel} logged — reminder set for 3 days`
          : `${pendingLogLabel} logged`,
      });
    },
    [pendingLogType, pendingLogLabel, logOutcome, logNote, contact.id, contact.name, contactV2, onUpdate, toast]
  );

  const handleSyncToHubspot = async () => {
    if (!contact.email) {
      toast({ title: "Email required", description: "Contact must have an email to sync with HubSpot", variant: "destructive" });
      return;
    }
    setIsSyncingHubspot(true);
    try {
      const nameParts = (contact.name || "").split(" ");
      const response = await apiRequest("POST", "/api/hubspot/sync", {
        email: contact.email, firstname: nameParts[0] || "", lastname: nameParts.slice(1).join(" ") || "",
        phone: contact.phone, company: contact.company, jobtitle: contact.title,
        website: contact.website, linkedinUrl: contact.linkedinUrl,
      });
      const result = await response.json();
      if (result.success) {
        addTimelineEvent(contact.id, "hubspot_synced", `Synced to HubSpot (${result.action})`, { hubspotId: result.hubspotId });
        onUpdate();
        toast({ title: result.action === "created" ? "Added to HubSpot" : "Updated in HubSpot", description: `Contact ${result.action} successfully` });
      } else {
        toast({ title: "Sync failed", description: result.error || "Failed to sync with HubSpot", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message || "Failed to sync with HubSpot", variant: "destructive" });
    }
    setIsSyncingHubspot(false);
  };

  const handleSyncToSalesforce = async () => {
    if (!contact.email) {
      toast({ title: "Email required", description: "Contact must have an email to sync with Salesforce", variant: "destructive" });
      return;
    }
    setIsSyncingSalesforce(true);
    try {
      const nameParts = (contact.name || "").split(" ");
      const response = await apiRequest("POST", "/api/salesforce/sync", {
        email: contact.email, firstname: nameParts[0] || "", lastname: nameParts.slice(1).join(" ") || "",
        phone: contact.phone, company: contact.company, jobtitle: contact.title,
        website: contact.website, linkedinUrl: contact.linkedinUrl,
      });
      const result = await response.json();
      if (result.success) {
        addTimelineEvent(contact.id, "salesforce_synced", `Synced to Salesforce (${result.action})`, { salesforceId: result.salesforceId });
        onUpdate();
        toast({ title: result.action === "created" ? "Added to Salesforce" : "Updated in Salesforce", description: `Contact ${result.action} successfully` });
      } else {
        toast({ title: "Sync failed", description: result.error || "Failed to sync with Salesforce", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message || "Failed to sync with Salesforce", variant: "destructive" });
    }
    setIsSyncingSalesforce(false);
  };

  const launchFollowUpComposer = async (res: FollowUpResponse) => {
    const body = buildFollowUpCopyText(res);
    const mode = String(followUpMode);
    const logFollowUpAction = (channel: string, note?: string) => {
      try {
        addTimelineEvent(contact.id, "followup_sent", `Follow-up sent (${channel})`, {
          channel, note, subject: res.subject, bodyPreview: res.body?.slice?.(0, 160),
        });
        onUpdate();
      } catch (e) { console.warn("[ContactDetailView] Failed to log followup_sent:", e); }
    };
    if (mode.includes("email")) {
      if (!contact.email) { await navigator.clipboard.writeText(body); toast({ title: "Copied", description: "No email. Copied to clipboard." }); logFollowUpAction("copied", "no_email"); return; }
      logFollowUpAction("email"); openMailto(contact.email, res.subject || undefined, res.body); return;
    }
    if (mode.includes("sms") || mode.includes("text") || mode.includes("message")) {
      const p = sanitizePhone(contact.phone);
      if (!p) { await navigator.clipboard.writeText(body); toast({ title: "Copied", description: "No phone. Copied to clipboard." }); logFollowUpAction("copied", "no_phone"); return; }
      logFollowUpAction("sms"); openSms(p, body); return;
    }
    if (mode.includes("linkedin")) {
      await navigator.clipboard.writeText(body); toast({ title: "Copied", description: "Copied. Opening LinkedIn…" }); logFollowUpAction("linkedin");
      if (contact.linkedinUrl) window.open(contact.linkedinUrl, "_blank", "noopener,noreferrer"); return;
    }
    await navigator.clipboard.writeText(body); toast({ title: "Copied" }); logFollowUpAction("copied", "fallback");
  };

  const handleGenerateFollowUp = async () => {
    if (!followUpGoal.trim()) {
      toast({ title: "Goal required", description: "Tell Carda what you want to achieve.", variant: "destructive" });
      return;
    }
    setIsGeneratingFollowUp(true);
    setFollowUpResult(null);
    try {
      const res = await generateFollowUp(
        { name: contact.name || "there", company: contact.company || undefined, title: contact.title || undefined, email: contact.email || undefined },
        { mode: followUpMode, tone: followUpTone, length: followUpLength, goal: followUpGoal.trim(), context: followUpContext.trim() || undefined }
      );
      setFollowUpResult(res);
      addTimelineEvent(contact.id, "followup_generated", `Follow-up generated (${FOLLOWUP_MODE_LABELS[followUpMode]})`, { bodyPreview: res.body.slice(0, 160) });
      onUpdate();
      await launchFollowUpComposer(res);
    } catch (e) {
      console.error("[ContactDetailView] Follow-up generation failed:", e);
      toast({ title: "Failed to generate follow-up", variant: "destructive" });
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const handleCopyFollowUp = async () => {
    if (!followUpResult) return;
    try {
      await navigator.clipboard.writeText(buildFollowUpCopyText(followUpResult));
      addTimelineEvent(contact.id, "followup_sent", "Follow-up copied", { channel: "copied", bodyPreview: followUpResult.body.slice(0, 160) });
      onUpdate();
      toast({ title: "Copied" });
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const handleCreateMeetingInvite = () => {
    if (!meetingStart || Number.isNaN(meetingStart.getTime())) {
      toast({ title: "Pick a valid time", variant: "destructive" });
      return;
    }
    const ics = createMeetingWithContact(contact.name || "Contact", contact.company || undefined, contact.email || undefined, meetingStart, meetingDuration);
    const safeName = (contact.name || "contact").trim().replace(/\s+/g, "-").toLowerCase();
    downloadIcsFile(ics, `carda-meeting-${safeName}.ics`);
    addTimelineEvent(contact.id, "meeting_scheduled", "Meeting invite created", { startIso: meetingStart.toISOString(), durationMinutes: meetingDuration });
    onUpdate();
    toast({ title: "Downloaded .ics invite" });
    setShowMeeting(false);
  };

  const openIntel = async (forceRefresh = false) => {
    if (!companyNameForIntel && !domainForIntel) {
      toast({ title: "Company required", description: "Add a company name or website/email domain first.", variant: "destructive" });
      return;
    }
    setShowIntel(true);
    if (!forceRefresh && intelV2.intel) return;
    await intelV2.fetchIntel(companyNameForIntel, domainForIntel, roleForIntel, addressForIntel, forceRefresh);
  };

  const handleSetReminder = () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    addReminder(contact.id, `Follow up with ${contact.name || "this contact"}`, dueDate.toISOString());
    onUpdate();
    toast({ title: "Reminder set for 3 days" });
  };

  // FIX #4: Log interaction quick chips
  const LOG_INTERACTION_CHIPS = [
    { type: "meeting_scheduled" as TimelineEventType, label: "Met",      icon: <Users className="w-3.5 h-3.5" /> },
    { type: "note_added" as TimelineEventType,        label: "Called",   icon: <Phone className="w-3.5 h-3.5" /> },
    { type: "note_added" as TimelineEventType,        label: "Emailed",  icon: <Mail className="w-3.5 h-3.5" /> },
    { type: "note_added" as TimelineEventType,        label: "LinkedIn", icon: <Linkedin className="w-3.5 h-3.5" /> },
  ];

  // ── Warmth config ─────────────────────────────────────────────────────────
  const warmthConfig: { value: RelationshipStrength; label: string; active: string; inactive: string }[] = [
    { value: "CASUAL", label: "Casual", active: "bg-muted text-foreground border-border",        inactive: "bg-transparent text-muted-foreground border-border/40" },
    { value: "NORMAL", label: "Normal", active: "bg-blue-500 text-white border-blue-500",         inactive: "bg-transparent text-muted-foreground border-border/40" },
    { value: "CLOSE",  label: "Close",  active: "bg-red-500 text-white border-red-500",           inactive: "bg-transparent text-muted-foreground border-border/40" },
  ];

  // ── Timeline filter config ────────────────────────────────────────────────
  const tlFilters: { value: "all" | "note" | "meeting" | "followup"; label: string }[] = [
    { value: "all",      label: "All" },
    { value: "note",     label: "Notes" },
    { value: "meeting",  label: "Meetings" },
    { value: "followup", label: "Follow-ups" },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full pb-24" data-testid="contact-detail-view">

      {/* ── Nav header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2" data-testid="button-back-to-contacts">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hubspotStatus?.connected && (
                <DropdownMenuItem onClick={handleSyncToHubspot} disabled={isSyncingHubspot}>
                  <SiHubspot className="w-4 h-4 mr-2 text-[#FF7A59]" />
                  {isSyncingHubspot ? "Syncing…" : "Sync to HubSpot"}
                </DropdownMenuItem>
              )}
              {salesforceStatus?.connected && (
                <DropdownMenuItem onClick={handleSyncToSalesforce} disabled={isSyncingSalesforce}>
                  <SiSalesforce className="w-4 h-4 mr-2 text-[#00A1E0]" />
                  {isSyncingSalesforce ? "Syncing…" : "Sync to Salesforce"}
                </DropdownMenuItem>
              )}
              {(hubspotStatus?.connected || salesforceStatus?.connected) && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete contact
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Edit mode ─────────────────────────────────────────────────────── */}
      {isEditing ? (
        <div className="space-y-3 mb-6 p-4 rounded-2xl bg-muted/30">
          {[
            { label: "Full Name",  key: "name",        type: "text" },
            { label: "Job Title",  key: "title",       type: "text" },
            { label: "Company",    key: "company",     type: "text" },
            { label: "Email",      key: "email",       type: "email" },
            { label: "Phone",      key: "phone",       type: "tel" },
            { label: "Website",    key: "website",     type: "text" },
            { label: "LinkedIn",   key: "linkedinUrl", type: "text" },
            { label: "Address",    key: "address",     type: "text" },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input type={type} value={(editedFields as any)[key]} onChange={(e) => setEditedFields((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <Button onClick={handleSaveEdits} disabled={isSavingEdits} className="w-full mt-2">
            {isSavingEdits ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      ) : (
        <>
          {/* ── Section 1: Business Card ───────────────────────────────── */}
          <div className="bg-[#1C1C1E] rounded-2xl p-4 text-white relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/[0.03] pointer-events-none" />
            <div className="absolute -bottom-6 left-6 w-24 h-24 rounded-full bg-white/[0.02] pointer-events-none" />

            {/* FIX #1: Company favicon logo */}
            {contact.company && (
              <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 mb-3">
                <CompanyLogo company={contact.company} domain={domainForIntel} />
                <span className="text-xs text-white/70 font-medium">{contact.company}</span>
              </div>
            )}

            <h2 className="text-2xl font-semibold text-white leading-tight">{contact.name || "Unknown"}</h2>
            {contact.title && <p className="text-sm text-white/50 mt-0.5">{contact.title}</p>}

            <div className="flex items-end justify-between mt-4">
              <div className="space-y-0.5">
                {contact.phone && <p className="text-sm text-white/60">{contact.phone}</p>}
                {contact.email && <p className="text-sm text-white/40 truncate max-w-[200px]">{contact.email}</p>}
              </div>
              {scannedDaysAgo && (
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Scanned</p>
                  <p className="text-xs text-white/50 font-medium">{scannedDaysAgo}</p>
                </div>
              )}
            </div>
          </div>

          {/* Expand hint */}
          <button
            onClick={() => setCardExpanded(!cardExpanded)}
            className="flex items-center justify-center gap-2 py-2 w-full text-muted-foreground hover:text-foreground transition-colors"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
          >
            <span className="w-8 h-1 rounded-full bg-border" />
            <span className="text-xs">{cardExpanded ? "Tap to collapse" : "Tap to reveal contact details"}</span>
            {cardExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Collapsible contact rows */}
          {cardExpanded && (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden mb-4">
              {contact.phone && (
                <button onClick={handleCall} className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors text-left" data-testid="row-phone">
                  <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-medium truncate">{contact.phone}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              )}
              {contact.email && (
                <button onClick={handleEmail} className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors text-left" data-testid="row-email">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium truncate">{contact.email}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              )}
              <button onClick={handleOpenLinkedIn} className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors text-left" data-testid="row-linkedin">
                <div className="w-8 h-8 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center shrink-0">
                  <SiLinkedin className="w-4 h-4 text-[#0A66C2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">LinkedIn</p>
                  <p className="text-sm font-medium">{contact.linkedinUrl ? "View profile" : "Find on LinkedIn"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {contact.website && (
                <button onClick={handleOpenWebsite} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left" data-testid="row-website">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Website</p>
                    <p className="text-sm font-medium truncate">{contact.website.replace(/^https?:\/\//, "")}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              )}
            </div>
          )}

          {/* ── Section 2: Warmth Selector ────────────────────────────── */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Relationship</p>
            <div className="flex gap-2">
              {warmthConfig.map(({ value, label, active, inactive }) => (
                <button
                  key={value}
                  onClick={() => handleUpdateWarmth(value)}
                  className={[
                    "flex-1 py-2 px-3 rounded-full border text-xs font-medium transition-all",
                    // FIX #2: derived from prop, always correct on remount
                    currentWarmth === value ? active : inactive,
                  ].join(" ")}
                  style={{ touchAction: "manipulation" } as React.CSSProperties}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Section 3: Smart CTAs ─────────────────────────────────── */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suggested actions</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => { setShowFollowUp(true); setFollowUpResult(null); }}
                className="rounded-2xl bg-primary text-primary-foreground p-4 text-left hover:opacity-90 transition-opacity"
                style={{ touchAction: "manipulation" } as React.CSSProperties}
              >
                <Sparkles className="w-5 h-5 mb-2 opacity-90" />
                <p className="text-sm font-semibold">Follow-up email</p>
                <p className="text-xs opacity-70 mt-0.5">
                  {daysSinceLastTouch != null ? `${daysSinceLastTouch}d since last touch` : "Draft with AI"}
                </p>
              </button>
              <button
                onClick={handleSetReminder}
                className="rounded-2xl bg-card border border-border/60 p-4 text-left hover:bg-muted/30 transition-colors"
                style={{ touchAction: "manipulation" } as React.CSSProperties}
              >
                <Bell className="w-5 h-5 mb-2 text-muted-foreground" />
                <p className="text-sm font-semibold">Set reminder</p>
                <p className="text-xs text-muted-foreground mt-0.5">Check in +3 days</p>
              </button>
            </div>

            {/* FIX #4: Secondary row with Log submenu */}
            <div className="flex gap-2">
              <button
                onClick={() => void openIntel(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-card border border-border/60 text-xs font-medium hover:bg-muted/30 transition-colors"
                style={{ touchAction: "manipulation" } as React.CSSProperties}
              >
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                Company brief
              </button>
              <button
                onClick={() => setShowMeeting(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-card border border-border/60 text-xs font-medium hover:bg-muted/30 transition-colors"
                style={{ touchAction: "manipulation" } as React.CSSProperties}
              >
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Schedule
              </button>
              <button
                onClick={() => setShowLogStrip(!showLogStrip)}
                className={[
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-colors",
                  showLogStrip
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card border-border/60 hover:bg-muted/30",
                ].join(" ")}
                style={{ touchAction: "manipulation" } as React.CSSProperties}
              >
                <Plus className="w-3.5 h-3.5" />
                Log
              </button>
            </div>

            {/* Log chip strip */}
            {showLogStrip && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-0.5 -mx-1 px-1">
                {LOG_INTERACTION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => { setShowLogStrip(false); handleQuickLog(chip.type, chip.label, chip.label); }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card text-xs font-medium hover:bg-muted/50 transition-colors"
                    style={{ touchAction: "manipulation" } as React.CSSProperties}
                  >
                    {chip.icon}
                    {chip.label}
                  </button>
                ))}
                <button
                  onClick={() => { setShowLogStrip(false); handleOpenLogSheet(); }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card text-xs font-medium hover:bg-muted/50 transition-colors text-muted-foreground"
                  style={{ touchAction: "manipulation" } as React.CSSProperties}
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  Other
                </button>
              </div>
            )}
          </div>

          {/* ── Section 4: Tags ───────────────────────────────────────── */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
            {/* TODO: wire to tag system — ContactV2 has no tags field yet */}
            <div className="flex flex-wrap gap-2 items-center">
              <p className="text-xs text-muted-foreground">No tags yet</p>
              {/* FIX #5: Toast instead of silent no-op */}
              <button
                onClick={() => toast({ title: "Tags coming soon", description: "Tag support is being added in the next update." })}
                className="text-xs rounded-full px-3 py-1 border border-dashed border-border/50 text-muted-foreground hover:border-border transition-colors"
                style={{ touchAction: "manipulation" } as React.CSSProperties}
              >
                + Add tag
              </button>
            </div>
          </div>

          {/* ── Tasks ─────────────────────────────────────────────────── */}
          {contactTasks.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">Tasks</p>
              <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
                {contactTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-border/40 last:border-0" data-testid={`task-row-${task.id}`}>
                    {task.draftBody ? (
                      <button className="flex-1 flex items-start gap-3 text-left" onClick={() => setExpandedDraftTaskId(expandedDraftTaskId === task.id ? null : task.id)}>
                        <Mail className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{task.title}</p>
                          {expandedDraftTaskId === task.id && (
                            <div className="mt-2 space-y-2">
                              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{task.draftBody}</p>
                              {draftSentConfirmTaskId === task.id ? (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-foreground">Did you send it?</p>
                                  <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleDraftSentYes(task.id, task.title); }} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Yes</button>
                                    <button onClick={(e) => { e.stopPropagation(); setDraftSentConfirmTaskId(null); }} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-muted/40 text-muted-foreground border border-transparent">No</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); handleDraftTaskSend(task); }} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">Send</button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDiscardDraftBody(task.id); }} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-muted/40 text-muted-foreground border border-transparent">Discard Draft</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    ) : (
                      <>
                        <Checkbox checked={false} onCheckedChange={() => handleCompleteTask(task.id)} className="mt-0.5 shrink-0" data-testid={`checkbox-task-${task.id}`} />
                        <div className="flex-1 min-w-0">
                          {editingTaskId === task.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingTaskText}
                                onChange={(e) => setEditingTaskText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveTaskEdit();
                                  if (e.key === "Escape") { setEditingTaskId(null); setEditingTaskText(""); }
                                }}
                                autoFocus
                                className="flex-1 bg-transparent text-sm outline-none border-b border-border min-w-0"
                                data-testid={`input-edit-task-${task.id}`}
                              />
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={handleSaveTaskEdit}>Save</Button>
                            </div>
                          ) : (
                            <p className="text-sm">{task.title}</p>
                          )}
                          {task.dueAt && editingTaskId !== task.id && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(() => {
                                const d = new Date(task.dueAt);
                                const now = new Date();
                                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                                const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                                const diff = Math.round((target - start) / 86400000);
                                if (diff === 0) return "Today";
                                if (diff === 1) return "Tomorrow";
                                if (diff === -1) return "Yesterday";
                                if (diff < 0) return `${Math.abs(diff)}d overdue`;
                                return `In ${diff}d`;
                              })()}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="opacity-50 hover:opacity-100 shrink-0" data-testid={`menu-task-${task.id}`}>
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>Mark complete</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStartEditTask(task.id, task.title)}>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTask(task.id)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Add a task..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 min-w-0"
                    data-testid="input-add-task"
                  />
                  {newTaskText.trim() && (
                    <Button size="sm" variant="ghost" onClick={handleAddTask} className="shrink-0 h-7 px-2 text-xs" data-testid="button-save-task">Add</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Section 5: Timeline ───────────────────────────────────── */}
          {/* FIX #6: Visually distinct section with own background */}
          <div className="rounded-2xl bg-muted/30 border border-border/40 p-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              {tlFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTimelineFilter(f.value)}
                  className={[
                    "shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                    timelineFilter === f.value
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border/40 hover:border-border",
                  ].join(" ")}
                  style={{ touchAction: "manipulation" } as React.CSSProperties}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <TimelineFeed
              items={filteredTimelineItems}
              onAddNote={handleAddNote}
              isAddingNote={isAddingNote}
              onQuickLog={handleQuickLog}
            />
          </div>
        </>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contact.name || "this contact"}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onDelete?.(contact.id); setShowDeleteConfirm(false); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Follow-up Drawer ─────────────────────────────────────────────── */}
      <Drawer open={showFollowUp} handleOnly onOpenChange={setShowFollowUp}>
        <DrawerContent className="h-[92dvh] overflow-hidden flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Follow-up</DrawerTitle>
            <DrawerClose asChild><Button variant="ghost" size="sm">Done</Button></DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: Math.max(16, keyboardInset + 16) }}>
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mode</Label>
                  <Select value={followUpMode} onValueChange={(v) => setFollowUpMode(v as FollowUpMode)}>
                    <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                    <SelectContent>{Object.entries(FOLLOWUP_MODE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tone</Label>
                  <Select value={followUpTone} onValueChange={(v) => setFollowUpTone(v as FollowUpTone)}>
                    <SelectTrigger><SelectValue placeholder="Tone" /></SelectTrigger>
                    <SelectContent>{Object.entries(FOLLOWUP_TONE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Length</Label>
                <Select value={followUpLength} onValueChange={(v) => setFollowUpLength(v as FollowUpLength)}>
                  <SelectTrigger><SelectValue placeholder="Length" /></SelectTrigger>
                  <SelectContent>{Object.entries(FOLLOWUP_LENGTH_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Goal</Label>
                <Textarea value={followUpGoal} onChange={(e) => setFollowUpGoal(e.target.value)} placeholder="e.g., book a 20-min call next week" className="min-h-[110px] resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Context (optional)</Label>
                <Textarea value={followUpContext} onChange={(e) => setFollowUpContext(e.target.value)} placeholder="e.g., met at All-Energy Melbourne" className="min-h-[90px] resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1 gap-2" onClick={handleGenerateFollowUp} disabled={isGeneratingFollowUp}>
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingFollowUp ? "Generating..." : "Generate"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleCopyFollowUp} disabled={!followUpResult}>Copy</Button>
              </div>
              {followUpResult && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                  {followUpResult.subject && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground">Subject</span>
                      <div className="font-medium">{followUpResult.subject}</div>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{followUpResult.body}</div>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Meeting Drawer ───────────────────────────────────────────────── */}
      <Drawer open={showMeeting} onOpenChange={setShowMeeting}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Meeting Invite</DrawerTitle>
            <DrawerClose asChild><Button variant="ghost" size="sm">Done</Button></DrawerClose>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick slots</Label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickSlots.map((s) => (
                  <Button key={s.label} variant={toDatetimeLocalValue(meetingStart) === toDatetimeLocalValue(s.getTime()) ? "default" : "outline"} size="sm" onClick={() => setMeetingStart(s.getTime())} className="shrink-0">
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Custom time</Label>
              <Input type="datetime-local" value={toDatetimeLocalValue(meetingStart)} onChange={(e) => { const d = new Date(e.target.value); if (!Number.isNaN(d.getTime())) setMeetingStart(d); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <Select value={String(meetingDuration)} onValueChange={(v) => setMeetingDuration(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
                <SelectContent>{[15, 30, 45, 60].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-sm">
              <div className="font-medium">{contact.name || "Contact"}</div>
              <div className="text-muted-foreground">{contact.company || ""}</div>
              <div className="mt-2">{meetingStart.toLocaleString()}</div>
            </div>
          </div>
          <DrawerFooter>
            <Button className="w-full" onClick={handleCreateMeetingInvite}>Download .ics invite</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Intel Drawer ─────────────────────────────────────────────────── */}
      <Drawer open={showIntel} handleOnly onOpenChange={(v) => setShowIntel(v)}>
        <DrawerContent className="h-[92dvh] overflow-hidden flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Company Brief</DrawerTitle>
            <DrawerClose asChild><Button variant="ghost" size="sm">Done</Button></DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <CompanyIntelV2Card
              intel={intelV2.intel}
              isLoading={intelV2.isLoading}
              error={intelV2.error}
              onRefresh={() => void openIntel(true)}
              companyName={companyNameForIntel || undefined}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Log Interaction Sheet ────────────────────────────────────────── */}
      <Drawer open={showLogSheet} onOpenChange={setShowLogSheet}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader>
            <DrawerTitle>{pendingLogLabel ? `Log ${pendingLogLabel}` : "Log Interaction"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">How did it go?</p>
              <div className="flex gap-2">
                {([
                  { value: "positive", label: "Worth following up", icon: "👍" },
                  { value: "neutral",  label: "Neutral",            icon: "😐" },
                  { value: "negative", label: "Not interested",     icon: "👎" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLogOutcome(opt.value)}
                    className={["flex-1 py-2 px-2 rounded-xl border text-xs font-medium transition-colors", logOutcome === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border/50 bg-card/60 hover:bg-muted/50"].join(" ")}
                    data-testid={`outcome-${opt.value}`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Quick note <span className="font-normal">(optional)</span></p>
              <Textarea placeholder="What was discussed, what you promised..." value={logNote} onChange={(e) => setLogNote(e.target.value)} rows={2} className="resize-none rounded-xl" data-testid="input-log-note" />
            </div>
            <Button onClick={() => handleConfirmLog()} className="w-full rounded-xl" disabled={!logOutcome} data-testid="button-confirm-log">
              {logOutcome === "positive" ? "Log & Set Reminder" : "Log Interaction"}
            </Button>
            <button onClick={() => handleConfirmLog("neutral")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1" data-testid="button-skip-log">
              Skip — just log it
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Bottom Bar ───────────────────────────────────────────────────── */}
      {/* FIX #7: Single-tap vCard save — direct call, no intermediate drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          <Button onClick={onDownloadVCard} className="w-full gap-2" variant="default">
            Save to Phone
          </Button>
        </div>
      </div>
    </div>
  );
}
