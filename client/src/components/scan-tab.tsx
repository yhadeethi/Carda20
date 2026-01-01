import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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

import { ContactTimelineTab } from "@/components/contact-timeline-tab";
import { StoredContact, saveContact, loadContacts } from "@/lib/contactsStorage";
import {
  loadContactsV2,
  ContactV2,
  upsertContact as upsertContactV2,
} from "@/lib/contacts/storage";
import { generateId as generateTimelineId } from "@/lib/contacts/ids";
import {
  getContactCountForCompany,
  findCompanyByName,
  extractDomainFromEmail,
  findCompanyByDomain,
} from "@/lib/companiesStorage";

import {
  Camera,
  FileText,
  Loader2,
  Upload,
  X,
  Download,
  Check,
} from "lucide-react";
import { SiHubspot } from "react-icons/si";
import {
  compressImageForOCR,
  formatFileSize,
  CompressionError,
} from "@/lib/imageUtils";
import { BatchScanMode } from "@/components/batch-scan-mode";
import { BatchReview } from "@/components/batch-review";
import { ContactDetailView } from "@/components/contact";
import { QueuedScan, getAllQueueItems, clearBatchSession } from "@/lib/batchScanStorage";
import { processBatchQueue } from "@/lib/batchProcessor";
import { addTimelineEvent } from "@/lib/contacts/storage";

type ScanMode = "scan" | "paste";
type BatchState = "idle" | "capturing" | "processing" | "reviewing";

interface ParsedContact {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  linkedinSearchUrl?: string;
  address?: string;
}

interface ScanResult {
  rawText: string;
  contact: ParsedContact;
  error?: string;
}

interface ScanTabProps {
  viewingContact?: StoredContact;
  onBackToContacts?: () => void;
  onDeleteContact?: (id: string) => void;
  eventModeEnabled: boolean;
  currentEventName: string | null;
  onEventModeChange: (enabled: boolean) => void;
  onEventNameChange: (name: string | null) => void;
  onContactSaved?: () => void;
  onContactUpdated?: (contactId: string) => void;
  onViewInOrgMap?: (companyId: string) => void;
  onShowingContactChange?: (showing: boolean) => void;
}

interface HubSpotSyncButtonProps {
  contact: ParsedContact;
  contactId?: string;
  onSynced?: () => void;
}

function HubSpotSyncButton({ contact, contactId, onSynced }: HubSpotSyncButtonProps) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "synced" | "error">("idle");

  const { data: hubspotStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/hubspot/status"],
  });

  const handleSync = async () => {
    if (!contact.email) {
      toast({
        title: "Email required",
        description: "Contact must have an email to sync with HubSpot",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const nameParts = (contact.fullName || "").split(" ");
      const firstname = nameParts[0] || "";
      const lastname = nameParts.slice(1).join(" ") || "";

      const response = await apiRequest("POST", "/api/hubspot/sync", {
        email: contact.email,
        firstname,
        lastname,
        phone: contact.phone,
        company: contact.companyName,
        jobtitle: contact.jobTitle,
        website: contact.website,
        address: contact.address,
      });

      const result = await response.json();

      if (result.success) {
        setSyncStatus("synced");
        toast({
          title: result.action === "created" ? "Added to HubSpot" : "Updated in HubSpot",
          description: `Contact ${result.action} successfully`,
        });

        if (contactId) {
          addTimelineEvent(
            contactId,
            "hubspot_synced",
            `Synced to HubSpot (${result.action})`,
            { hubspotId: result.hubspotId }
          );
          onSynced?.();
        }
      } else {
        setSyncStatus("error");
        toast({
          title: "Sync failed",
          description: result.error || "Failed to sync with HubSpot",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setSyncStatus("error");
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with HubSpot",
        variant: "destructive",
      });
    }
    setIsSyncing(false);
  };

  if (!hubspotStatus?.connected) return null;

  return (
    <Button
      variant={syncStatus === "synced" ? "default" : "outline"}
      onClick={handleSync}
      disabled={isSyncing}
      className="gap-1.5"
      data-testid="button-hubspot-sync"
    >
      {isSyncing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : syncStatus === "synced" ? (
        <Check className="w-4 h-4" />
      ) : (
        <SiHubspot className="w-4 h-4 text-[#FF7A59]" />
      )}
      {syncStatus === "synced" ? "Synced" : "HubSpot"}
    </Button>
  );
}

export function ScanTab({
  viewingContact,
  onBackToContacts,
  onDeleteContact,
  eventModeEnabled,
  currentEventName,
  onEventModeChange,
  onEventNameChange,
  onContactSaved,
  onContactUpdated,
  onViewInOrgMap,
  onShowingContactChange,
}: ScanTabProps) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [scanMode, setScanMode] = useState<ScanMode>("scan");
  const [pastedText, setPastedText] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadChoice, setShowUploadChoice] = useState(false);

  const [rawText, setRawText] = useState<string | null>(null);

  // Local “scanned contact” that we show via ContactDetailView immediately
  const [scannedStoredContact, setScannedStoredContact] = useState<StoredContact | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);

  const [tempEventName, setTempEventName] = useState("");
  const [isEditingEventName, setIsEditingEventName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [contactV2, setContactV2] = useState<ContactV2 | null>(null);
  const [v2RefreshKey, setV2RefreshKey] = useState(0);

  // Batch scan state
  const [batchState, setBatchState] = useState<BatchState>("idle");
  const [batchItems, setBatchItems] = useState<QueuedScan[]>([]);

  // When navigating in from Relationships (hub)
  useEffect(() => {
    if (viewingContact) {
      setScannedStoredContact(null);

      const v2Contacts = loadContactsV2();
      const v2 = v2Contacts.find((c) => c.id === viewingContact.id);
      setContactV2(v2 || null);
    }
  }, [viewingContact, v2RefreshKey]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setPreviewImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  
const openCameraPicker = () => {
  setShowUploadChoice(false);
  requestAnimationFrame(() => cameraInputRef.current?.click());
};

const openLibraryPicker = () => {
  setShowUploadChoice(false);
  requestAnimationFrame(() => libraryInputRef.current?.click());
};

const clearImage = () => {
    setSelectedFile(null);
    setPreviewImage(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  };

  const resetFlow = () => {
    setScannedStoredContact(null);
    setContactV2(null);
    setRawText(null);
    setPastedText("");
    clearImage();
    setBatchState("idle");
    setBatchItems([]);
  };

  const saveContactToStorage = (parsedContact: ParsedContact): StoredContact | null => {
    try {
      const contactData = {
        name: parsedContact.fullName || "",
        company: parsedContact.companyName || "",
        title: parsedContact.jobTitle || "",
        email: parsedContact.email || "",
        phone: parsedContact.phone || "",
        website: parsedContact.website || "",
        linkedinUrl: parsedContact.linkedinUrl || "",
        address: parsedContact.address || "",
      };

      const savedContact = saveContact(contactData, eventModeEnabled ? currentEventName : null);
      if (!savedContact) return null;

      const existingV2Contacts = loadContactsV2();
      const existingV2 = existingV2Contacts.find((c) => c.id === savedContact.id);

      let v2Contact: ContactV2;

      if (existingV2) {
        v2Contact = {
          ...existingV2,
          name: savedContact.name,
          company: savedContact.company,
          title: savedContact.title,
          email: savedContact.email,
          phone: savedContact.phone,
          website: savedContact.website,
          linkedinUrl: savedContact.linkedinUrl,
          address: savedContact.address,
          eventName: savedContact.eventName,
          companyId: savedContact.companyId,
          timeline: [
            ...existingV2.timeline,
            {
              id: generateTimelineId(),
              type: "contact_updated" as const,
              at: new Date().toISOString(),
              summary: "Contact updated via scan",
            },
          ],
          lastTouchedAt: new Date().toISOString(),
        };
      } else {
        v2Contact = {
          ...savedContact,
          tasks: [],
          reminders: [],
          timeline: [
            {
              id: generateTimelineId(),
              type: "scan_created" as const,
              at: savedContact.createdAt || new Date().toISOString(),
              summary: "Contact created via scan",
            },
          ],
          lastTouchedAt: savedContact.createdAt,
          notes: "",
        };
      }

      upsertContactV2(v2Contact);
      setContactV2(v2Contact);

      onContactSaved?.();

      return savedContact;
    } catch (e) {
      console.error("[ScanTab] Failed to save contact to storage:", e);
      return null;
    }
  };

  const scanCardMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      try {
        const aiRes = await fetch("/api/scan-ai", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (aiRes.ok) return (await aiRes.json()) as ScanResult;
      } catch {}

      const formData2 = new FormData();
      formData2.append("image", file);
      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData2,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        if (text.includes("File size exceeds") || text.includes("maximum size limit")) {
          throw new Error(
            "This photo is too large for the scanner. Please retake the photo a bit further away or crop it."
          );
        }
        throw new Error(text || "Failed to scan card");
      }
      return (await res.json()) as ScanResult;
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({
          title: "OCR Warning",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setRawText(data.rawText);

      const saved = saveContactToStorage(data.contact);
      if (saved) {
        setScannedStoredContact(saved);
        toast({
          title: "Saved",
          description: "Contact captured successfully",
        });
      } else {
        toast({
          title: "Save failed",
          description: "Could not save this contact",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Scan failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const parseTextMutation = useMutation({
    mutationFn: async (text: string) => {
      try {
        const aiRes = await apiRequest("POST", "/api/parse-ai", { text });
        if (aiRes.ok) return (await aiRes.json()) as ScanResult;
      } catch {}

      const res = await apiRequest("POST", "/api/parse", { text });
      return (await res.json()) as ScanResult;
    },
    onSuccess: (data) => {
      setRawText(data.rawText);

      const saved = saveContactToStorage(data.contact);
      if (saved) {
        setScannedStoredContact(saved);
        toast({
          title: "Saved",
          description: "Contact captured successfully",
        });
      } else {
        toast({
          title: "Save failed",
          description: "Could not save this contact",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScanCard = async () => {
    if (!selectedFile) return;

    try {
      setIsCompressing(true);
      const result = await compressImageForOCR(selectedFile);

      if (result.wasCompressed) {
        toast({
          title: "Image optimized",
          description: `Compressed from ${formatFileSize(result.originalSize)} to ${formatFileSize(
            result.compressedSize
          )}`,
        });
      }

      scanCardMutation.mutate(result.file);
    } catch (error) {
      if (error instanceof CompressionError) {
        toast({
          title: error.type === "still_too_large" ? "Image too large" : "Image processing failed",
          description: error.message || "Could not process this image. Please try a different photo.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: "Could not process this image. Please try a different photo.",
          variant: "destructive",
        });
      }
    } finally {
      setIsCompressing(false);
    }
  };

  const handleParseText = () => {
    if (pastedText.trim()) parseTextMutation.mutate(pastedText);
  };

  const handleDownloadVCard = async (payload?: any) => {
    const contactForVcard = payload || {
      fullName: viewingContact?.name || scannedStoredContact?.name,
      jobTitle: viewingContact?.title || scannedStoredContact?.title,
      companyName: viewingContact?.company || scannedStoredContact?.company,
      email: viewingContact?.email || scannedStoredContact?.email,
      phone: viewingContact?.phone || scannedStoredContact?.phone,
      website: viewingContact?.website || scannedStoredContact?.website,
      linkedinUrl: viewingContact?.linkedinUrl || scannedStoredContact?.linkedinUrl,
      address: viewingContact?.address || scannedStoredContact?.address,
    };

    try {
      const res = await fetch("/api/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForVcard),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to generate vCard");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(contactForVcard.fullName || "contact").replace(/[^a-z0-9]/gi, "_")}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "vCard downloaded",
        description: "Contact saved to your device",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate vCard",
        variant: "destructive",
      });
    }
  };

  // Event mode inline input
  const shouldShowInput = scanMode === "scan" && eventModeEnabled && (isEditingEventName || !currentEventName);

  const handleEventModeToggle = (enabled: boolean) => {
    if (enabled) {
      onEventModeChange(true);
      if (!currentEventName) setTempEventName("");
    } else {
      onEventModeChange(false);
      onEventNameChange(null);
      setTempEventName("");
      setIsEditingEventName(false);
    }
  };

  const handleEventNameSubmit = () => {
    if (tempEventName.trim()) {
      onEventNameChange(tempEventName.trim());
      onEventModeChange(true);
      setIsEditingEventName(false);
    }
  };

  const handleChangeEvent = () => {
    setTempEventName(currentEventName || "");
    setIsEditingEventName(true);
  };

  const handleCancelEventEdit = () => {
    setIsEditingEventName(false);
    setTempEventName("");
    if (!currentEventName) onEventModeChange(false);
  };

  // Batch scan handlers

  const handleExitBatchMode = () => {
    setBatchState("idle");
    clearBatchSession();
  };

  const handleBatchProcess = async (items: QueuedScan[]) => {
    setBatchState("processing");
    setBatchItems(items);

    await processBatchQueue({
      onComplete: ({ successful, failed }) => {
        const updatedItems = getAllQueueItems();
        setBatchItems(updatedItems);
        setBatchState("reviewing");
        toast({
          title: `Processing complete`,
          description: `${successful} successful, ${failed} failed`,
        });
      },
    });
  };

  const handleBatchComplete = () => {
    setBatchState("idle");
    setBatchItems([]);
    onContactSaved?.();
  };

  const handleBatchBack = () => setBatchState("capturing");

  const isProcessing = isCompressing || scanCardMutation.isPending || parseTextMutation.isPending;

  // Helper to find company ID for org map
  const getCompanyIdForStoredContact = (c?: StoredContact | null): string | null => {
    const companyName = c?.company;
    const email = c?.email;

    if (companyName) {
      const byName = findCompanyByName(companyName);
      if (byName) return byName.id;
    }

    if (email) {
      const domain = extractDomainFromEmail(email);
      if (domain) {
        const byDomain = findCompanyByDomain(domain);
        if (byDomain) return byDomain.id;
      }
    }

    return null;
  };

  const activeStoredContact = viewingContact || scannedStoredContact;
  const isViewingFromHub = !!viewingContact;

  // Notify parent when showing/hiding a contact (for hiding bottom nav)
  useEffect(() => {
    onShowingContactChange?.(!!activeStoredContact);
    // Cleanup: reset to false when unmounting to prevent stale nav state
    return () => {
      onShowingContactChange?.(false);
    };
  }, [activeStoredContact, onShowingContactChange]);

  const companyIdForContact = getCompanyIdForStoredContact(activeStoredContact);
  const companyContactCount = companyIdForContact
    ? getContactCountForCompany(companyIdForContact, loadContacts())
    : 0;

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
<AlertDialog open={showUploadChoice} onOpenChange={setShowUploadChoice}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Add business card photo</AlertDialogTitle>
      <AlertDialogDescription>Choose how you want to add the photo.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
      <AlertDialogCancel data-testid="button-upload-cancel">Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={openLibraryPicker} data-testid="button-upload-library">
        Library
      </AlertDialogAction>
      <AlertDialogAction onClick={openCameraPicker} data-testid="button-upload-camera">
        Camera
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {viewingContact?.name || "this contact"}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-detail">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (viewingContact && onDeleteContact) {
                  onDeleteContact(viewingContact.id);
                  setShowDeleteConfirm(false);
                }
              }}
              data-testid="button-confirm-delete-detail"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Scan Mode */}
      {batchState === "capturing" && currentEventName && (
        <BatchScanMode eventName={currentEventName} onProcess={handleBatchProcess} onExit={handleExitBatchMode} />
      )}

      {/* Batch Processing / Review */}
      {(batchState === "processing" || batchState === "reviewing") && currentEventName && (
        <BatchReview items={batchItems} eventName={currentEventName} onComplete={handleBatchComplete} onBack={handleBatchBack} />
      )}

      {/* If we have an active contact (either from hub or scanned) show the SAME Relationship detail UI */}
      {activeStoredContact && (
        <div className="space-y-4">
          <ContactDetailView
            contact={activeStoredContact}
            contactV2={contactV2}
            onBack={() => {
              if (isViewingFromHub && onBackToContacts) {
                onBackToContacts();
              } else {
                resetFlow();
              }
            }}
            onDelete={onDeleteContact}
            onUpdate={() => setV2RefreshKey((k) => k + 1)}
            onContactUpdated={onContactUpdated}
            onDownloadVCard={() => handleDownloadVCard()}
            onViewInOrgMap={onViewInOrgMap}
            companyId={companyIdForContact || undefined}
          />
        </div>
      )}

      {/* Normal Scan UI (only when NOT showing a contact detail view) */}
      {!activeStoredContact && batchState === "idle" && (
        <Card className="glass">
<CardContent className="space-y-4 pt-4">

            <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
              <TabsList className="relative flex h-14 w-full rounded-full bg-muted p-1 ring-1 ring-border/50">
  <motion.span
    className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm"
    animate={{ x: scanMode === "scan" ? "0%" : "100%" }}
    transition={
      reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 520, damping: 42, mass: 0.35 }
    }
  />

  <TabsTrigger
    value="scan"
    className="relative flex-1 min-w-0 h-12 rounded-full px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
    data-testid="mode-scan"
  >
    <span className="relative z-10 flex w-full min-w-0 items-center justify-center">
      <span className="min-w-0 truncate">Scan Card</span>
    </span>
  </TabsTrigger>

  <TabsTrigger
    value="paste"
    className="relative flex-1 min-w-0 h-12 rounded-full px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
    data-testid="mode-paste"
  >
    <span className="relative z-10 flex w-full min-w-0 items-center justify-center">
      <span className="min-w-0 truncate">Paste Text</span>
    </span>
  </TabsTrigger>
</TabsList>

{scanMode === "scan" && (
  <div className="mt-3 space-y-2" data-testid="event-mode-wrapper">
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/30 px-3 py-2"
      data-testid="event-mode-row"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">Event mode</div>
        <div className="text-xs text-muted-foreground truncate">
          {eventModeEnabled && (currentEventName || pendingEventName)
            ? (currentEventName || pendingEventName)
            : "Batch scan + tag an event"}
        </div>
      </div>

      <Switch
        checked={eventModeEnabled}
        onCheckedChange={handleEventModeToggle}
        data-testid="switch-event-mode"
      />
    </div>

    {eventModeEnabled && (shouldShowInput || isEditingEventName) && (
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Event name (e.g. All-Energy 2025)"
          value={tempEventName}
          onChange={(e) => setTempEventName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEventNameSubmit()}
          autoFocus={shouldShowInput}
          className="flex-1 rounded-2xl h-11"
          data-testid="input-event-name"
        />

        <Button
          onClick={handleEventNameSubmit}
          disabled={!tempEventName.trim()}
          className="rounded-2xl h-11 px-4"
          data-testid="button-save-event"
        >
          Save
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl h-11 w-11"
          onClick={handleCancelEventEdit}
          data-testid="button-cancel-event-edit"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )}

    {eventModeEnabled && (currentEventName || pendingEventName) && !shouldShowInput && (
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-full px-3"
          onClick={handleChangeEvent}
          data-testid="button-change-event"
        >
          Change
        </Button>
      </div>
    )}
  </div>
)}


              <TabsContent value="scan" className="mt-4">
                <input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleImageSelect}
  className="hidden"
  data-testid="input-file-upload-camera"
/>

<input
  ref={libraryInputRef}
  type="file"
  accept="image/*"
  onChange={handleImageSelect}
  className="hidden"
  data-testid="input-file-upload-library"
/>

                {!previewImage ? (
                  <button
                    onClick={() => setShowUploadChoice(true)}
                    className="w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center gap-3 hover-elevate transition-smooth"
                    data-testid="button-upload-zone"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Upload business card photo</p>
                      <p className="text-sm text-muted-foreground">Tap to take a photo or select from gallery</p>
                    </div>
                  </button>
                ) : (
                  <div className="relative">
                    <img src={previewImage} alt="Card preview" className="w-full h-48 object-contain rounded-xl bg-muted" data-testid="image-preview" />
                    <Button size="icon" variant="secondary" className="absolute top-2 right-2" onClick={clearImage} data-testid="button-clear-image">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <Button className="w-full mt-4" onClick={handleScanCard} disabled={!selectedFile || isProcessing} data-testid="button-scan">
                  {isCompressing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Optimizing image...
                    </>
                  ) : scanCardMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning with AI...
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Scan Card
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="paste" className="mt-4 space-y-4">
                <Textarea
                  placeholder="Paste email signature or business card text here...&#10;&#10;Example:&#10;John Smith&#10;VP of Sales, Acme Corp&#10;john@acme.com&#10;+1 555-0123"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="min-h-[150px] resize-none"
                  data-testid="input-paste-text"
                />
                <Button className="w-full" onClick={handleParseText} disabled={!pastedText.trim() || isProcessing} data-testid="button-extract">
                  {parseTextMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting with AI...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Extract Contact
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
