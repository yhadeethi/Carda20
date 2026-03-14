import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Edit,
  Mic,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";


import { CompanyIntelV2Card } from "@/components/company-intel-v2";
import { ContactHeroCard, Contact } from "./ContactHeroCard";
import { ContactBottomBar } from "./ContactBottomBar";
import { QuickActionsSheet, QuickAction } from "./QuickActionsSheet";
import { TimelineFeed, TimelineItem, TimelineEventType } from "./TimelineFeed";

import { StoredContact } from "@/lib/contactsStorage";
import {
  ContactV2,
  addReminder,
  addTimelineEvent,
  updateContactV2,
} from "@/lib/contacts/storage";
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
  /**
   * If true, opens the follow-up composer panel on mount.
   * Used by Home Scoreboard “Send follow-up” CTA to reduce taps.
   */
  autoOpenFollowUp?: boolean;
  /** Called when user taps Voice Debrief from Quick Actions. */
  onVoiceDebrief?: (contactId: string) => void;
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
  let href = `mailto:${encodeURIComponent(to)}?`;
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  params.push(`body=${encodeURIComponent(body)}`);
  window.location.href = href + params.join("&");
}

function openSms(phone: string, body: string) {
  window.location.href = `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(body)}`;
}

function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const compute = () => {
      // innerHeight stays large on iOS; visualViewport shrinks when keyboard shows.
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(Math.min(420, Math.round(keyboard))); // cap so we don't go crazy
    };

    compute();
    vv.addEventListener("resize", compute);
    vv.addEventListener("scroll", compute);
    return () => {
      vv.removeEventListener("resize", compute);
      vv.removeEventListener("scroll", compute);
    };
  }, [active]);

  return inset;
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
  onVoiceDebrief,
}: ContactDetailViewProps) {
  const { toast } = useToast();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false);
  const [isSyncingSalesforce, setIsSyncingSalesforce] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  // Follow-up drawer state
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpMode, setFollowUpMode] =
    useState<FollowUpMode>("email_followup");
  const [followUpTone, setFollowUpTone] = useState<FollowUpTone>("friendly");
  const [followUpLength, setFollowUpLength] =
    useState<FollowUpLength>("medium");
  const [followUpGoal, setFollowUpGoal] = useState("");
  const [followUpContext, setFollowUpContext] = useState("");
  const [followUpResult, setFollowUpResult] =
    useState<FollowUpResponse | null>(null);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  // Allow upstream screens (e.g., Home Scoreboard) to deep-link into the follow-up drawer.
  useEffect(() => {
    if (!autoOpenFollowUp) return;
    // Open on next tick so layout is stable.
    const t = window.setTimeout(() => {
      setShowFollowUp(true);
      setFollowUpResult(null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [autoOpenFollowUp]);

  const keyboardInset = useKeyboardInset(showFollowUp);

  // Meeting drawer state
  const quickSlots = useMemo(() => getQuickTimeSlots(), []);
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingStart, setMeetingStart] = useState<Date>(() => {
    const d = quickSlots[0]?.getTime();
    return d ? d : new Date();
  });
  const [meetingDuration, setMeetingDuration] = useState<number>(30);

  // Quick log sheet state
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [pendingLogType, setPendingLogType] = useState<string | null>(null);
  const [pendingLogLabel, setPendingLogLabel] = useState<string>('');
  const [logOutcome, setLogOutcome] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [logNote, setLogNote] = useState('');

  // Intel drawer state
  const [showIntel, setShowIntel] = useState(false);
  const intelV2 = useIntelV2();

  const { data: hubspotStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/hubspot/status"],
  });

  const { data: salesforceStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/salesforce/status"],
  });

  const heroContact: Contact = useMemo(
    () => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      company: contact.company,
      phone: contact.phone,
      email: contact.email,
      website: contact.website,
      linkedinUrl: contact.linkedinUrl,
      address: contact.address,
      scannedAt: contact.createdAt,
      lastTouchedAt: contactV2?.lastTouchedAt,
      syncedToHubspot: contactV2?.timeline?.some(
        (t) => t.type === "hubspot_synced"
      ),
    }),
    [contact, contactV2]
  );

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
          typeof t.meta === 'object' && t.meta !== null
            ? {
                outcome: (t.meta as any).outcome as 'positive' | 'neutral' | 'negative' | undefined,
                note: (t.meta as any).note as string | undefined,
                source: (t.meta as any).source as string | undefined,
              }
            : undefined,
        at: t.at,
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [contactV2]);

  const companyNameForIntel = useMemo(() => {
    const c = (editedFields.company || contact.company || "").trim();
    return c.length ? c : null;
  }, [editedFields.company, contact.company]);

  const domainForIntel = useMemo(() => {
    const fromWebsite = extractDomainFromWebsite(
      editedFields.website || contact.website || ""
    );
    const fromEmail = extractDomainFromEmail(
      editedFields.email || contact.email || ""
    );
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

  const handleSaveEdits = async () => {
    setIsSavingEdits(true);
    try {
      const updated = updateContactV2(contact.id, editedFields);
      if (!updated) throw new Error("Failed to update contact");

      setIsEditing(false);
      toast({ title: "Contact updated" });

      onUpdate();
      onContactUpdated?.(contact.id);

      try {
        addTimelineEvent(contact.id, "contact_updated", "Contact details updated");
      } catch (timelineErr) {
        console.warn("[ContactDetailView] Timeline event failed:", timelineErr);
      }
    } catch (e) {
      console.error("[ContactDetailView] Save failed:", e);
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleCall = () => {
    if (contact.phone) window.location.href = `tel:${contact.phone}`;
  };

  const handleEmail = () => {
    if (contact.email) window.location.href = `mailto:${contact.email}`;
  };

  const handleOpenWebsite = () => {
    if (!contact.website) return;
    const url = contact.website.includes("://")
      ? contact.website
      : `https://${contact.website}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenLinkedIn = () => {
    if (contact.linkedinUrl) {
      window.open(contact.linkedinUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleAddNote = async (text: string) => {
    setIsAddingNote(true);
    try {
      addTimelineEvent(contact.id, "note_added", text);
      onUpdate();
      toast({ title: "Note added" });
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
    }
    setIsAddingNote(false);
  };

  const handleQuickLog = useCallback((type: TimelineEventType, summary: string, displayLabel: string) => {
    setPendingLogType(type);
    setPendingLogLabel(displayLabel);
    setLogOutcome(null);
    setLogNote('');
    setShowLogSheet(true);
  }, []);

  const handleConfirmLog = useCallback(async (outcomeOverride?: 'positive' | 'neutral' | 'negative') => {
    const resolvedOutcome = outcomeOverride ?? logOutcome;
    if (!pendingLogType || !contactV2) return;
    await addTimelineEvent(
      contact.id,
      pendingLogType as any,
      pendingLogLabel,
      { source: 'quick_log', outcome: resolvedOutcome, note: logNote }
    );
    if (resolvedOutcome === 'positive') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await addReminder(
        contact.id,
        `Follow up with ${contact.name || 'this contact'}`,
        dueDate.toISOString()
      );
    }
    onUpdate();
    setShowLogSheet(false);
    setPendingLogType(null);
    setLogNote('');
    setLogOutcome(null);
    toast({
      title: resolvedOutcome === 'positive'
        ? `${pendingLogLabel} logged — reminder set for 3 days`
        : `${pendingLogLabel} logged`,
    });
  }, [pendingLogType, pendingLogLabel, logOutcome, logNote, contact.id, contact.name, contactV2, onUpdate, toast]);

  const handleSyncToHubspot = async () => {
    if (!contact.email) {
      toast({
        title: "Email required",
        description: "Contact must have an email to sync with HubSpot",
        variant: "destructive",
      });
      return;
    }

    setIsSyncingHubspot(true);
    try {
      const nameParts = (contact.name || "").split(" ");
      const firstname = nameParts[0] || "";
      const lastname = nameParts.slice(1).join(" ") || "";

      const response = await apiRequest("POST", "/api/hubspot/sync", {
        email: contact.email,
        firstname,
        lastname,
        phone: contact.phone,
        company: contact.company,
        jobtitle: contact.title,
        website: contact.website,
        linkedinUrl: contact.linkedinUrl,
      });

      const result = await response.json();

      if (result.success) {
        addTimelineEvent(
          contact.id,
          "hubspot_synced",
          `Synced to HubSpot (${result.action})`,
          { hubspotId: result.hubspotId }
        );
        onUpdate();
        toast({
          title:
            result.action === "created" ? "Added to HubSpot" : "Updated in HubSpot",
          description: `Contact ${result.action} successfully`,
        });
      } else {
        toast({
          title: "Sync failed",
          description: result.error || "Failed to sync with HubSpot",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with HubSpot",
        variant: "destructive",
      });
    }
    setIsSyncingHubspot(false);
  };

  const handleSyncToSalesforce = async () => {
    if (!contact.email) {
      toast({
        title: "Email required",
        description: "Contact must have an email to sync with Salesforce",
        variant: "destructive",
      });
      return;
    }

    setIsSyncingSalesforce(true);
    try {
      const nameParts = (contact.name || "").split(" ");
      const firstname = nameParts[0] || "";
      const lastname = nameParts.slice(1).join(" ") || "";

      const response = await apiRequest("POST", "/api/salesforce/sync", {
        email: contact.email,
        firstname,
        lastname,
        phone: contact.phone,
        company: contact.company,
        jobtitle: contact.title,
        website: contact.website,
        linkedinUrl: contact.linkedinUrl,
      });

      const result = await response.json();

      if (result.success) {
        addTimelineEvent(
          contact.id,
          "salesforce_synced",
          `Synced to Salesforce (${result.action})`,
          { salesforceId: result.salesforceId }
        );
        onUpdate();
        toast({
          title:
            result.action === "created" ? "Added to Salesforce" : "Updated in Salesforce",
          description: `Contact ${result.action} successfully`,
        });
      } else {
        toast({
          title: "Sync failed",
          description: result.error || "Failed to sync with Salesforce",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with Salesforce",
        variant: "destructive",
      });
    }
    setIsSyncingSalesforce(false);
  };

  const launchFollowUpComposer = async (res: FollowUpResponse) => {
    const body = buildFollowUpCopyText(res);
    const mode = String(followUpMode);

    const logFollowUpAction = (channel: string, note?: string) => {
      try {
        addTimelineEvent(
          contact.id,
          "followup_sent",
          `Follow-up sent (${channel})`,
          {
            channel,
            note,
            subject: res.subject,
            bodyPreview: res.body?.slice?.(0, 160),
          }
        );
        onUpdate();
      } catch (e) {
        console.warn("[ContactDetailView] Failed to log followup_sent:", e);
      }
    };

    if (mode.includes("email")) {
      if (!contact.email) {
        await navigator.clipboard.writeText(body);
        toast({ title: "Copied", description: "No email. Copied to clipboard." });
        logFollowUpAction("copied", "no_email");
        return;
      }
      logFollowUpAction("email");
      openMailto(contact.email, res.subject || undefined, res.body);
      return;
    }

    if (mode.includes("sms") || mode.includes("text") || mode.includes("message")) {
      const p = sanitizePhone(contact.phone);
      if (!p) {
        await navigator.clipboard.writeText(body);
        toast({ title: "Copied", description: "No phone. Copied to clipboard." });
        logFollowUpAction("copied", "no_phone");
        return;
      }
      logFollowUpAction("sms");
      openSms(p, body);
      return;
    }

    if (mode.includes("linkedin")) {
      await navigator.clipboard.writeText(body);
      toast({ title: "Copied", description: "Copied. Opening LinkedIn…" });
      logFollowUpAction("linkedin");
      if (contact.linkedinUrl) window.open(contact.linkedinUrl, "_blank", "noopener,noreferrer");
      return;
    }

    await navigator.clipboard.writeText(body);
    toast({ title: "Copied" });
    logFollowUpAction("copied", "fallback");
  };

  const handleGenerateFollowUp = async () => {
    if (!followUpGoal.trim()) {
      toast({
        title: "Goal required",
        description: "Tell Carda what you want to achieve.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingFollowUp(true);
    setFollowUpResult(null);

    try {
      const res = await generateFollowUp(
        {
          name: contact.name || "there",
          company: contact.company || undefined,
          title: contact.title || undefined,
          email: contact.email || undefined,
        },
        {
          mode: followUpMode,
          tone: followUpTone,
          length: followUpLength,
          goal: followUpGoal.trim(),
          context: followUpContext.trim() || undefined,
        }
      );

      setFollowUpResult(res);

      addTimelineEvent(
        contact.id,
        "followup_generated",
        `Follow-up generated (${FOLLOWUP_MODE_LABELS[followUpMode]})`,
        { bodyPreview: res.body.slice(0, 160) }
      );
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
      addTimelineEvent(
        contact.id,
        "followup_sent",
        "Follow-up copied",
        { channel: "copied", bodyPreview: followUpResult.body.slice(0, 160) }
      );
      onUpdate();
      toast({ title: "Copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleCreateMeetingInvite = () => {
    if (!meetingStart || Number.isNaN(meetingStart.getTime())) {
      toast({ title: "Pick a valid time", variant: "destructive" });
      return;
    }

    const ics = createMeetingWithContact(
      contact.name || "Contact",
      contact.company || undefined,
      contact.email || undefined,
      meetingStart,
      meetingDuration
    );

    const safeName = (contact.name || "contact")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    downloadIcsFile(ics, `carda-meeting-${safeName}.ics`);

    addTimelineEvent(contact.id, "meeting_scheduled", "Meeting invite created", {
      startIso: meetingStart.toISOString(),
      durationMinutes: meetingDuration,
    });

    onUpdate();
    toast({ title: "Downloaded .ics invite" });
    setShowMeeting(false);
  };

  const openIntel = async (forceRefresh = false) => {
    if (!companyNameForIntel && !domainForIntel) {
      toast({
        title: "Company required",
        description: "Add a company name or website/email domain first.",
        variant: "destructive",
      });
      return;
    }

    setShowIntel(true);

    // Don’t refetch if we already have intel (feels instant). Use refresh button for updates.
    if (!forceRefresh && intelV2.intel) return;

    await intelV2.fetchIntel(
      companyNameForIntel,
      domainForIntel,
      roleForIntel,
      addressForIntel,
      forceRefresh
    );
  };

  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: "voice-debrief",
      label: "Voice Debrief",
      icon: <Mic className="w-5 h-5 text-violet-500 dark:text-violet-400" />,
      onClick: () => onVoiceDebrief?.(contact.id),
    },
    {
      id: "followup",
      label: "Generate Follow-up",
      icon: <Sparkles className="w-5 h-5" />,
      onClick: () => {
        setShowFollowUp(true);
        setFollowUpResult(null);
      },
    },
    {
      id: "reminder",
      label: "Add Reminder",
      icon: <Bell className="w-5 h-5" />,
      onClick: () => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        addReminder(
          contact.id,
          `Follow up with ${contact.name || "this contact"}`,
          dueDate.toISOString()
        );
        onUpdate();
        toast({ title: "Reminder set for 3 days" });
      },
    },
    {
      id: "intel",
      label: "Company Brief",
      icon: <Briefcase className="w-5 h-5" />,
      onClick: () => void openIntel(false),
    },
  ], [contact.id, contact.name, onUpdate, onVoiceDebrief, toast]);

  const heroBottomLabel = useMemo(() => {
    // wording tweak
    if (!contactV2?.lastTouchedAt) return null;
    return "Last interaction";
  }, [contactV2?.lastTouchedAt]);

  return (
    <div className="flex flex-col min-h-full pb-24" data-testid="contact-detail-view">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 -ml-2"
          data-testid="button-back-to-contacts"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </Button>

          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing ? (
        <div className="space-y-3 mb-6 p-4 rounded-2xl bg-muted/30">
          {/* fields... unchanged */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input value={editedFields.name} onChange={(e) => setEditedFields((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Job Title</Label>
            <Input value={editedFields.title} onChange={(e) => setEditedFields((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Company</Label>
            <Input value={editedFields.company} onChange={(e) => setEditedFields((f) => ({ ...f, company: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input type="email" value={editedFields.email} onChange={(e) => setEditedFields((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input type="tel" value={editedFields.phone} onChange={(e) => setEditedFields((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <Input value={editedFields.website} onChange={(e) => setEditedFields((f) => ({ ...f, website: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">LinkedIn</Label>
            <Input value={editedFields.linkedinUrl} onChange={(e) => setEditedFields((f) => ({ ...f, linkedinUrl: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Address</Label>
            <Input value={editedFields.address} onChange={(e) => setEditedFields((f) => ({ ...f, address: e.target.value }))} />
          </div>

          <Button onClick={handleSaveEdits} disabled={isSavingEdits} className="w-full mt-2">
            {isSavingEdits ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      ) : (
        <>
          <ContactHeroCard
            contact={heroContact}
            onCall={handleCall}
            onEmail={handleEmail}
            onOpenWebsite={handleOpenWebsite}
            onOpenLinkedIn={handleOpenLinkedIn}
          />

          {/* Visual separator between contact info and activity */}
          <div className="mt-6 border-t border-border/30" />

          {/* Pending tasks & reminders pinned at top */}
          {(() => {
            const pendingTasks = (contactV2?.tasks ?? []).filter((t) => !t.done);
            const pendingReminders = (contactV2?.reminders ?? []).filter((r) => !r.done);
            if (pendingTasks.length === 0 && pendingReminders.length === 0) return null;
            return (
              <div className="mt-4 rounded-2xl bg-card/60 border border-border/40 divide-y divide-border/30 overflow-hidden">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-4 h-4 rounded border border-border/70 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{task.title}</div>
                      {task.dueAt && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {pendingReminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-center gap-3 px-4 py-3">
                    <Bell className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{reminder.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(reminder.remindAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Activity section with header */}
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-foreground shrink-0">Activity</h3>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            {/* onQuickLog intentionally omitted — removes the "Log interaction" QuickLogBar */}
            <TimelineFeed items={timelineItems} onAddNote={handleAddNote} isAddingNote={isAddingNote} />
          </div>
        </>
      )}

      {/* Delete Confirmation */}
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
            <AlertDialogAction
              onClick={() => {
                onDelete?.(contact.id);
                setShowDeleteConfirm(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickActionsSheet open={showQuickActions} onOpenChange={setShowQuickActions} actions={quickActions} />

      {/* Follow-up Drawer */}
      <Drawer open={showFollowUp} handleOnly onOpenChange={setShowFollowUp}>
        <DrawerContent className="h-[92dvh] overflow-hidden flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Follow-up</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">Done</Button>
            </DrawerClose>
          </DrawerHeader>

          <div
            className="flex-1 overflow-y-auto px-4"
            style={{
              paddingBottom: Math.max(16, keyboardInset + 16),
            }}
          >
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mode</Label>
                  <Select value={followUpMode} onValueChange={(v) => setFollowUpMode(v as FollowUpMode)}>
                    <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FOLLOWUP_MODE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tone</Label>
                  <Select value={followUpTone} onValueChange={(v) => setFollowUpTone(v as FollowUpTone)}>
                    <SelectTrigger><SelectValue placeholder="Tone" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FOLLOWUP_TONE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Length</Label>
                <Select value={followUpLength} onValueChange={(v) => setFollowUpLength(v as FollowUpLength)}>
                  <SelectTrigger><SelectValue placeholder="Length" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FOLLOWUP_LENGTH_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Goal</Label>
                <Textarea
                  value={followUpGoal}
                  onChange={(e) => setFollowUpGoal(e.target.value)}
                  placeholder="e.g., book a 20-min call next week"
                  className="min-h-[110px] resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Context (optional)</Label>
                <Textarea
                  value={followUpContext}
                  onChange={(e) => setFollowUpContext(e.target.value)}
                  placeholder="e.g., met at All-Energy Melbourne"
                  className="min-h-[90px] resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1 gap-2" onClick={handleGenerateFollowUp} disabled={isGeneratingFollowUp}>
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingFollowUp ? "Generating..." : "Generate"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleCopyFollowUp} disabled={!followUpResult}>
                  Copy
                </Button>
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

      {/* Meeting Drawer (leave as-is) */}
      <Drawer open={showMeeting} onOpenChange={setShowMeeting}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Meeting Invite</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">Done</Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick slots</Label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickSlots.map((s) => (
                  <Button
                    key={s.label}
                    variant={toDatetimeLocalValue(meetingStart) === toDatetimeLocalValue(s.getTime()) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMeetingStart(s.getTime())}
                    className="shrink-0"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Custom time</Label>
              <Input
                type="datetime-local"
                value={toDatetimeLocalValue(meetingStart)}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!Number.isNaN(d.getTime())) setMeetingStart(d);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <Select value={String(meetingDuration)} onValueChange={(v) => setMeetingDuration(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-sm">
              <div className="font-medium">{contact.name || "Contact"}</div>
              <div className="text-muted-foreground">{contact.company || ""}</div>
              <div className="mt-2">{meetingStart.toLocaleString()}</div>
            </div>
          </div>

          <DrawerFooter>
            <Button className="w-full" onClick={handleCreateMeetingInvite}>
              Download .ics invite
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Intel Drawer */}
      <Drawer open={showIntel} handleOnly onOpenChange={(v) => setShowIntel(v)}>
        <DrawerContent className="h-[92dvh] overflow-hidden flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Company Brief</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">Done</Button>
            </DrawerClose>
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

      {/* Log Interaction Sheet */}
      <Drawer open={showLogSheet} onOpenChange={setShowLogSheet}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader>
            <DrawerTitle>
              {pendingLogLabel ? `Log ${pendingLogLabel}` : 'Log Interaction'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">How did it go?</p>
              <div className="flex gap-2">
                {([
                  { value: 'positive', label: 'Worth following up', icon: '👍' },
                  { value: 'neutral',  label: 'Neutral', icon: '😐' },
                  { value: 'negative', label: 'Not interested', icon: '👎' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLogOutcome(opt.value)}
                    className={[
                      "flex-1 py-2 px-2 rounded-xl border text-xs font-medium transition-colors",
                      logOutcome === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/50 bg-card/60 hover:bg-muted/50",
                    ].join(' ')}
                    data-testid={`outcome-${opt.value}`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                Quick note <span className="font-normal">(optional)</span>
              </p>
              <Textarea
                placeholder="What was discussed, what you promised..."
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                rows={2}
                className="resize-none rounded-xl"
                data-testid="input-log-note"
              />
            </div>
            <Button
              onClick={() => handleConfirmLog()}
              className="w-full rounded-xl"
              disabled={!logOutcome}
              data-testid="button-confirm-log"
            >
              {logOutcome === 'positive' ? 'Log & Set Reminder' : 'Log Interaction'}
            </Button>
            <button
              onClick={() => handleConfirmLog('neutral')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              data-testid="button-skip-log"
            >
              Skip — just log it
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <ContactBottomBar
        isSaved={true}
        onSave={onDownloadVCard}
        onQuickActions={() => setShowQuickActions(true)}
        onUpdate={onDownloadVCard}
      />
    </div>
  );
}
