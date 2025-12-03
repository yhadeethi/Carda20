import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CompanyIntelCard } from "@/components/company-intel-card";
import { CompanyIntelData } from "@shared/schema";
import { StoredContact, saveContact } from "@/lib/contactsStorage";
import { Camera, FileText, Loader2, Upload, X, Download, Sparkles, CheckCircle2, User, Building, Briefcase, Mail, Phone, Globe, MapPin, Search, ArrowLeft, Calendar, Trash2 } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { compressImageForOCR, formatFileSize, CompressionError } from "@/lib/imageUtils";

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
  eventModeEnabled: boolean;
  currentEventName: string | null;
  onEventModeChange: (enabled: boolean) => void;
  onEventNameChange: (name: string | null) => void;
  onContactSaved?: () => void;
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
}: ScanTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scanMode, setScanMode] = useState<ScanMode>("scan");
  const [pastedText, setPastedText] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [rawText, setRawText] = useState<string | null>(null);
  const [contact, setContact] = useState<ParsedContact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState<ParsedContact | null>(null);
  
  const [companyIntel, setCompanyIntel] = useState<CompanyIntelData | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const [showEventNameDialog, setShowEventNameDialog] = useState(false);
  const [tempEventName, setTempEventName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (viewingContact) {
      const parsed: ParsedContact = {
        fullName: viewingContact.name,
        jobTitle: viewingContact.title,
        companyName: viewingContact.company,
        email: viewingContact.email,
        phone: viewingContact.phone,
        website: viewingContact.website,
        linkedinUrl: viewingContact.linkedinUrl,
        address: viewingContact.address,
      };
      setContact(parsed);
      setEditedContact(parsed);
    }
  }, [viewingContact]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const saveContactToStorage = (parsedContact: ParsedContact) => {
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
      saveContact(contactData, eventModeEnabled ? currentEventName : null);
      onContactSaved?.();
    } catch (e) {
      console.error("[ScanTab] Failed to save contact to storage:", e);
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
        if (aiRes.ok) {
          const result = await aiRes.json() as ScanResult;
          console.log("[Scan] AI parsing succeeded");
          return result;
        }
        console.log("[Scan] AI endpoint failed, falling back to deterministic");
      } catch (aiError) {
        console.log("[Scan] AI endpoint error, falling back:", aiError);
      }
      
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
          throw new Error("This photo is too large for the scanner. Please retake the photo a bit further away or crop it.");
        }
        throw new Error(text || "Failed to scan card");
      }
      return res.json() as Promise<ScanResult>;
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
      setContact(data.contact);
      setEditedContact(data.contact);
      saveContactToStorage(data.contact);
      toast({
        title: "Card scanned",
        description: "Contact information extracted successfully",
      });
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
        if (aiRes.ok) {
          const result = await aiRes.json() as ScanResult;
          console.log("[Parse] AI parsing succeeded");
          return result;
        }
        console.log("[Parse] AI endpoint failed, falling back to deterministic");
      } catch (aiError) {
        console.log("[Parse] AI endpoint error, falling back:", aiError);
      }
      
      const res = await apiRequest("POST", "/api/parse", { text });
      return res.json() as Promise<ScanResult>;
    },
    onSuccess: (data) => {
      setRawText(data.rawText);
      setContact(data.contact);
      setEditedContact(data.contact);
      saveContactToStorage(data.contact);
      toast({
        title: "Text parsed",
        description: "Contact information extracted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const intelMutation = useMutation({
    mutationFn: async (contact: ParsedContact) => {
      const res = await apiRequest("POST", "/api/intel", {
        companyName: contact.companyName,
        email: contact.email,
        website: contact.website,
        contactName: contact.fullName,
        contactTitle: contact.jobTitle,
      });
      return res.json() as Promise<CompanyIntelData>;
    },
    onSuccess: (data) => {
      setCompanyIntel(data);
      setIntelError(null);
    },
    onError: (error: Error) => {
      setIntelError(error.message);
      setCompanyIntel(null);
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
        if (error.type === 'still_too_large') {
          toast({
            title: "Image too large",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Image processing failed",
            description: error.message || "Could not process this image. Please try a different photo.",
            variant: "destructive",
          });
        }
      } else {
        console.error("Unexpected error during compression:", error);
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
    if (pastedText.trim()) {
      parseTextMutation.mutate(pastedText);
    }
  };

  const handleDownloadVCard = async () => {
    if (!editedContact) return;
    
    try {
      const res = await fetch("/api/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedContact),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to generate vCard");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${editedContact.fullName?.replace(/[^a-z0-9]/gi, "_") || "contact"}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "vCard downloaded",
        description: "Contact saved to your device",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not generate vCard",
        variant: "destructive",
      });
    }
  };

  const handleGenerateIntel = () => {
    if (editedContact) {
      setIntelError(null);
      intelMutation.mutate(editedContact);
    }
  };

  const handleFieldChange = (field: keyof ParsedContact, value: string) => {
    if (editedContact) {
      setEditedContact({ ...editedContact, [field]: value || undefined });
    }
  };

  const resetFlow = () => {
    setContact(null);
    setEditedContact(null);
    setRawText(null);
    setCompanyIntel(null);
    setIntelError(null);
    setPastedText("");
    clearImage();
    setIsEditing(false);
  };

  const handleEventModeToggle = (enabled: boolean) => {
    if (enabled && !currentEventName) {
      setShowEventNameDialog(true);
      setTempEventName("");
    } else {
      onEventModeChange(enabled);
    }
  };

  const handleEventNameSubmit = () => {
    if (tempEventName.trim()) {
      onEventNameChange(tempEventName.trim());
      onEventModeChange(true);
      setShowEventNameDialog(false);
    }
  };

  const handleChangeEvent = () => {
    setTempEventName(currentEventName || "");
    setShowEventNameDialog(true);
  };

  const isProcessing = isCompressing || scanCardMutation.isPending || parseTextMutation.isPending;

  const currentContact = editedContact;

  const isViewingFromHub = !!viewingContact;

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <Dialog open={showEventNameDialog} onOpenChange={setShowEventNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What event are you at?</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. All-Energy 2025"
            value={tempEventName}
            onChange={(e) => setTempEventName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEventNameSubmit()}
            autoFocus
            data-testid="input-event-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventNameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEventNameSubmit} disabled={!tempEventName.trim()} data-testid="button-save-event">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {!contact && !isViewingFromHub && (
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Scan Business Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="py-2 px-3 rounded-lg bg-muted/50" data-testid="event-mode-row">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={eventModeEnabled}
                    onCheckedChange={handleEventModeToggle}
                    data-testid="switch-event-mode"
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Event mode</span>
                  </div>
                </div>
                {eventModeEnabled && currentEventName && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium" data-testid="current-event-name">
                      {currentEventName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleChangeEvent}
                      data-testid="button-change-event"
                    >
                      Change
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scan" className="gap-2" data-testid="mode-scan">
                  <Camera className="w-4 h-4" />
                  Scan Card
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-2" data-testid="mode-paste">
                  <FileText className="w-4 h-4" />
                  Paste Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                
                {!previewImage ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
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
                    <img
                      src={previewImage}
                      alt="Card preview"
                      className="w-full h-48 object-contain rounded-xl bg-muted"
                      data-testid="image-preview"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={clearImage}
                      data-testid="button-clear-image"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full mt-4"
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
                  placeholder="Paste email signature or business card text here...&#10;&#10;Example:&#10;John Smith&#10;VP of Sales, Acme Corp&#10;john@acme.com&#10;+1 555-0123"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="min-h-[150px] resize-none"
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

      {(contact || isViewingFromHub) && (
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {isViewingFromHub && onBackToContacts ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBackToContacts}
                    className="gap-1 -ml-2"
                    data-testid="button-back-to-contacts"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Contacts
                  </Button>
                ) : (
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Contact Extracted
                  </CardTitle>
                )}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(!isEditing)}
                    data-testid="button-toggle-edit"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </Button>
                  {isViewingFromHub && viewingContact && onDeleteContact && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid="button-delete-contact-detail"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <Input
                      value={editedContact?.fullName || ""}
                      onChange={(e) => handleFieldChange("fullName", e.target.value)}
                      placeholder="Full Name"
                      data-testid="input-edit-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Job Title</Label>
                    <Input
                      value={editedContact?.jobTitle || ""}
                      onChange={(e) => handleFieldChange("jobTitle", e.target.value)}
                      placeholder="Job Title"
                      data-testid="input-edit-title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Company</Label>
                    <Input
                      value={editedContact?.companyName || ""}
                      onChange={(e) => handleFieldChange("companyName", e.target.value)}
                      placeholder="Company Name"
                      data-testid="input-edit-company"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={editedContact?.email || ""}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      placeholder="email@example.com"
                      data-testid="input-edit-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input
                      type="tel"
                      value={editedContact?.phone || ""}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      data-testid="input-edit-phone"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Website</Label>
                    <Input
                      type="url"
                      value={editedContact?.website || ""}
                      onChange={(e) => handleFieldChange("website", e.target.value)}
                      placeholder="https://example.com"
                      data-testid="input-edit-website"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                    <Input
                      type="url"
                      value={editedContact?.linkedinUrl || ""}
                      onChange={(e) => handleFieldChange("linkedinUrl", e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      data-testid="input-edit-linkedin"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Input
                      value={editedContact?.address || ""}
                      onChange={(e) => handleFieldChange("address", e.target.value)}
                      placeholder="123 Main Street, City, State 1234"
                      data-testid="input-edit-address"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 min-w-0">
                  {currentContact?.fullName && (
                    <div className="flex items-center gap-3 min-w-0">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate" data-testid="text-contact-name">{currentContact.fullName}</span>
                    </div>
                  )}
                  {currentContact?.jobTitle && (
                    <div className="flex items-center gap-3 min-w-0">
                      <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate" data-testid="text-contact-title">{currentContact.jobTitle}</span>
                    </div>
                  )}
                  {currentContact?.companyName && (
                    <div className="flex items-center gap-3 min-w-0">
                      <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate" data-testid="text-contact-company">{currentContact.companyName}</span>
                    </div>
                  )}
                  {currentContact?.email && (
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a 
                        href={`mailto:${currentContact.email}`} 
                        className="text-primary hover:underline text-sm truncate" 
                        title={currentContact.email}
                        data-testid="text-contact-email"
                      >
                        {currentContact.email}
                      </a>
                    </div>
                  )}
                  {currentContact?.phone && (
                    <div className="flex items-center gap-3 min-w-0">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${currentContact.phone}`} className="text-primary hover:underline truncate" data-testid="text-contact-phone">
                        {currentContact.phone}
                      </a>
                    </div>
                  )}
                  {currentContact?.address && (
                    <div className="flex items-start gap-3 min-w-0">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span 
                        className="text-sm leading-snug break-words" 
                        data-testid="text-contact-address"
                      >
                        {currentContact.address}
                      </span>
                    </div>
                  )}
                  {currentContact?.website && (
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a 
                        href={currentContact.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary hover:underline truncate"
                        title={currentContact.website}
                        data-testid="text-contact-website"
                      >
                        {currentContact.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                  {currentContact?.linkedinUrl && (
                    <div className="flex items-center gap-3 min-w-0">
                      <SiLinkedin className="w-4 h-4 text-[#0A66C2] shrink-0" />
                      <a href={currentContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="text-contact-linkedin">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  
                  {(currentContact?.phone || currentContact?.email || currentContact?.linkedinUrl || currentContact?.fullName || currentContact?.companyName) && (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t flex-wrap" data-testid="action-row">
                      {currentContact?.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1.5"
                          data-testid="button-action-call"
                        >
                          <a href={`tel:${currentContact.phone}`}>
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </a>
                        </Button>
                      )}
                      {currentContact?.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1.5"
                          data-testid="button-action-email"
                        >
                          <a href={`mailto:${currentContact.email}`}>
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </a>
                        </Button>
                      )}
                      {currentContact?.linkedinUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1.5"
                          data-testid="button-action-linkedin"
                        >
                          <a href={currentContact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <SiLinkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                            LinkedIn
                          </a>
                        </Button>
                      ) : (currentContact?.fullName || currentContact?.companyName) && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1.5"
                          data-testid="button-action-search-linkedin"
                        >
                          <a 
                            href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([currentContact?.fullName, currentContact?.companyName].filter(Boolean).join(' '))}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <SiLinkedin className="w-3.5 h-3.5 text-muted-foreground" />
                            <Search className="w-2.5 h-2.5 -ml-0.5" />
                            Search LinkedIn
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <Button
                  onClick={handleDownloadVCard}
                  className="w-full"
                  data-testid="button-download-vcard"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download vCard
                </Button>
                
                <Button
                  onClick={handleGenerateIntel}
                  variant="outline"
                  className="w-full"
                  disabled={!editedContact?.companyName && !editedContact?.email}
                  data-testid="button-generate-intel"
                >
                  {intelMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Intel...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Company Intel
                    </>
                  )}
                </Button>
                
                {!isViewingFromHub && (
                  <Button
                    onClick={resetFlow}
                    variant="ghost"
                    className="w-full"
                    data-testid="button-new-scan"
                  >
                    Scan Another Card
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {(companyIntel || intelError || intelMutation.isPending) && (
            <CompanyIntelCard
              intel={companyIntel}
              isLoading={intelMutation.isPending}
              error={intelError}
              onRetry={handleGenerateIntel}
              companyName={editedContact?.companyName}
            />
          )}
        </div>
      )}
    </div>
  );
}
