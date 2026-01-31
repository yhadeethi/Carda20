import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, useReducedMotion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// NOTE: Event Mode toggle intentionally removed from Scan.
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

import { StoredContact, loadContacts } from "@/lib/contactsStorage";
import { loadContactsV2, ContactV2 } from "@/lib/contacts/storage";
import {
  getContactCountForCompany,
  findCompanyByName,
  extractDomainFromEmail,
  findCompanyByDomain,
} from "@/lib/companiesStorage";

import { Camera, FileText, Loader2, Upload, X, Download, Check } from "lucide-react";
import { SiHubspot } from "react-icons/si";
import { compressImageForOCR, formatFileSize, CompressionError } from "@/lib/imageUtils";

import { ContactDetailView } from "@/components/contact";
import { saveUnifiedContactFromParsed } from "@/lib/contacts/saveUnifiedContact";

type ScanMode = "scan" | "paste";
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
          addTimelineEvent(contactId, "hubspot_synced", `Synced to HubSpot (${result.action})`, {
            hubspotId: result.hubspotId,
          });
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
    } finally {
      setIsSyncing(false);
    }
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
  onContactSaved,
  onContactUpdated,
  onViewInOrgMap,
  onShowingContactChange,
}: ScanTabProps) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanMode, setScanMode] = useState<ScanMode>("scan");
  const [pastedText, setPastedText] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [rawText, setRawText] = useState<string | null>(null);

  // Local “scanned contact” that we show via ContactDetailView immediately
  const [scannedStoredContact, setScannedStoredContact] = useState<StoredContact | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [contactV2, setContactV2] = useState<ContactV2 | null>(null);
  const [v2RefreshKey, setV2RefreshKey] = useState(0);

  // Scan is intentionally single-contact only (events live in the Events tab).

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

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetFlow = () => {
    setScannedStoredContact(null);
    setContactV2(null);
    setRawText(null);
    setPastedText("");
    clearImage();
  };

  const saveContactToStorage = (parsedContact: ParsedContact): StoredContact | null => {
    try {
      const saved = saveUnifiedContactFromParsed(parsedContact, {
        eventName: null,
        source: "scan",
      });
      if (saved?.v2) setContactV2(saved.v2);
      onContactSaved?.();
      return saved?.v1 || null;
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
        const aiRes = await fetch("/api/scan-ai", { method: "POST", body: formData, credentials: "include" });
        if (aiRes.ok) return (await aiRes.json()) as ScanResult;
      } catch {}

      const formData2 = new FormData();
      formData2.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body: formData2, credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        if (text.includes("File size exceeds") || text.includes("maximum size limit")) {
          throw new Error("This photo is too large. Retake further away or crop it.");
        }
        throw new Error(text || "Failed to scan card");
      }
      return (await res.json()) as ScanResult;
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "OCR Warning", description: data.error, variant: "destructive" });
        return;
      }

      setRawText(data.rawText);

      const saved = saveContactToStorage(data.contact);
      if (saved) {
        setScannedStoredContact(saved);
        toast({ title: "Saved", description: "Contact captured successfully" });
      } else {
        toast({ title: "Save failed", description: "Could not save this contact", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Scan failed", description: error.message, variant: "destructive" });
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
        toast({ title: "Saved", description: "Contact captured successfully" });
      } else {
        toast({ title: "Save failed", description: "Could not save this contact", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Extraction failed", description: error.message, variant: "destructive" });
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
          description: `Compressed from ${formatFileSize(result.originalSize)} to ${formatFileSize(result.compressedSize)}`,
        });
      }

      scanCardMutation.mutate(result.file);
    } catch (error) {
      if (error instanceof CompressionError) {
        toast({
          title: error.type === "still_too_large" ? "Image too large" : "Image processing failed",
          description: error.message || "Could not process this image. Try a different photo.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: "Could not process this image. Try a different photo.",
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
    return () => onShowingContactChange?.(false);
  }, [activeStoredContact, onShowingContactChange]);

  const companyIdForContact = getCompanyIdForStoredContact(activeStoredContact);
  const companyContactCount = companyIdForContact ? getContactCountForCompany(companyIdForContact, loadContacts()) : 0;

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
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

      {/* Contact detail view */}
      {activeStoredContact && (
        <div className="space-y-4">
          <ContactDetailView
            contact={activeStoredContact}
            contactV2={contactV2}
            onBack={() => {
              if (isViewingFromHub && onBackToContacts) onBackToContacts();
              else resetFlow();
            }}
            onDelete={onDeleteContact}
            onUpdate={() => setV2RefreshKey((k) => k + 1)}
            onContactUpdated={onContactUpdated}
            onDownloadVCard={() => {
              // kept as-is in your earlier versions; if you want vCard handler re-added here, say so
            }}
            onViewInOrgMap={onViewInOrgMap}
            companyId={companyIdForContact || undefined}
          />
        </div>
      )}

      {/* Normal Scan UI */}
      {!activeStoredContact && (
        <Card className="glass">
          <CardContent className="space-y-4 pt-4">
            {/* Small subheader (like Contacts Hub) */}
            <p className="text-sm text-muted-foreground">
              Scan a business card or paste a signature to extract a contact in seconds.
            </p>

            <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
              {/* Pills identical to Contacts Hub */}
              <TabsList className="relative flex h-14 w-full rounded-full bg-muted p-1 ring-1 ring-border/50">
                <motion.span
                  className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm"
                  animate={{ x: scanMode === "scan" ? "0%" : "100%" }}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.35 }
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

              <TabsContent value="scan" className="mt-4 space-y-4">
                {/* One-tap native iOS sheet */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />

                {!previewImage ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-2xl flex flex-col items-center justify-center gap-3 hover-elevate transition-smooth"
                    data-testid="button-upload-zone"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Upload business card photo</p>
                      <p className="text-sm text-muted-foreground">Tap to choose camera, library, or files</p>
                    </div>
                  </button>
                ) : (
                  <div className="relative">
                    <img
                      src={previewImage}
                      alt="Card preview"
                      className="w-full h-48 object-contain rounded-2xl bg-muted"
                      data-testid="image-preview"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 rounded-full"
                      onClick={clearImage}
                      data-testid="button-clear-image"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleScanCard}
                  disabled={!selectedFile || isProcessing}
                  data-testid="button-scan"
                >
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
                  placeholder={
                    "Paste email signature or business card text here...\n\nExample:\nJohn Smith\nVP of Sales, Acme Corp\njohn@acme.com\n+1 555-0123"
                  }
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="min-h-[150px] resize-none rounded-2xl"
                  data-testid="input-paste-text"
                />
                <Button
                  className="w-full"
                  onClick={handleParseText}
                  disabled={!pastedText.trim() || isProcessing}
                  data-testid="button-extract"
                >
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
