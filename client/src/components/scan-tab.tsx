import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyIntelCard } from "@/components/company-intel-card";
import { CompanyIntelData } from "@shared/schema";
import { Camera, FileText, Loader2, Upload, X, Download, Sparkles, CheckCircle2, AlertTriangle, User, Building, Briefcase, Mail, Phone, Globe, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ScanMode = "scan" | "paste";

interface ParsedContact {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
}

interface ScanResult {
  rawText: string;
  contact: ParsedContact;
  error?: string;
}

export function ScanTab() {
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
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

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

  const scanCardMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
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
      toast({
        title: "Card scanned",
        description: "Contact information extracted successfully",
      });
      checkDuplicate(data.contact);
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
      const res = await apiRequest("POST", "/api/parse", { text });
      return res.json() as Promise<ScanResult>;
    },
    onSuccess: (data) => {
      setRawText(data.rawText);
      setContact(data.contact);
      setEditedContact(data.contact);
      toast({
        title: "Text parsed",
        description: "Contact information extracted successfully",
      });
      checkDuplicate(data.contact);
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateCheckMutation = useMutation({
    mutationFn: async (contact: ParsedContact) => {
      const res = await apiRequest("POST", "/api/check_duplicate", {
        email: contact.email,
        companyName: contact.companyName,
      });
      return res.json() as Promise<{ isDuplicate: boolean; existingContactId?: number }>;
    },
    onSuccess: (data) => {
      if (data.isDuplicate) {
        setDuplicateWarning("A contact with this email already exists in your collection");
      } else {
        setDuplicateWarning(null);
      }
    },
  });

  const intelMutation = useMutation({
    mutationFn: async (contact: ParsedContact) => {
      const res = await apiRequest("POST", "/api/intel", {
        companyName: contact.companyName,
        email: contact.email,
        website: contact.website,
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

  const checkDuplicate = (contact: ParsedContact) => {
    if (contact.email || contact.companyName) {
      duplicateCheckMutation.mutate(contact);
    }
  };

  const handleScanCard = () => {
    if (selectedFile) {
      scanCardMutation.mutate(selectedFile);
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
    setDuplicateWarning(null);
    setPastedText("");
    clearImage();
    setIsEditing(false);
  };

  const isProcessing = scanCardMutation.isPending || parseTextMutation.isPending;

  const currentContact = isEditing ? editedContact : contact;

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {!contact && (
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Scan Business Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  {scanCardMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
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
                      Extracting...
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

      {contact && (
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Contact Extracted
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(!isEditing)}
                  data-testid="button-toggle-edit"
                >
                  {isEditing ? "Done" : "Edit"}
                </Button>
              </div>
              {duplicateWarning && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  {duplicateWarning}
                </div>
              )}
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
                </div>
              ) : (
                <div className="space-y-3">
                  {currentContact?.fullName && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium" data-testid="text-contact-name">{currentContact.fullName}</span>
                    </div>
                  )}
                  {currentContact?.jobTitle && (
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span data-testid="text-contact-title">{currentContact.jobTitle}</span>
                    </div>
                  )}
                  {currentContact?.companyName && (
                    <div className="flex items-center gap-3">
                      <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span data-testid="text-contact-company">{currentContact.companyName}</span>
                    </div>
                  )}
                  {currentContact?.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={`mailto:${currentContact.email}`} className="text-primary hover:underline" data-testid="text-contact-email">
                        {currentContact.email}
                      </a>
                    </div>
                  )}
                  {currentContact?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${currentContact.phone}`} className="text-primary hover:underline" data-testid="text-contact-phone">
                        {currentContact.phone}
                      </a>
                    </div>
                  )}
                  {currentContact?.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={currentContact.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="text-contact-website">
                        {currentContact.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                  {currentContact?.linkedinUrl && (
                    <div className="flex items-center gap-3">
                      <Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={currentContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="text-contact-linkedin">
                        LinkedIn Profile
                      </a>
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
                
                <Button
                  onClick={resetFlow}
                  variant="ghost"
                  className="w-full"
                  data-testid="button-new-scan"
                >
                  Scan Another Card
                </Button>
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
