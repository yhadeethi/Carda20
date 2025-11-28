import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactResultCard } from "@/components/contact-result-card";
import { CompanyIntelCard } from "@/components/company-intel-card";
import { RecentContactsList } from "@/components/recent-contacts-list";
import { Contact, ParsedContact, CompanyIntelData } from "@shared/schema";
import { Camera, FileText, Loader2, Upload, X, ImageIcon } from "lucide-react";

type ScanMode = "scan" | "paste";

export function ScanTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scanMode, setScanMode] = useState<ScanMode>("scan");
  const [pastedText, setPastedText] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedContact, setParsedContact] = useState<ParsedContact | null>(null);
  const [savedContact, setSavedContact] = useState<Contact | null>(null);
  const [companyIntel, setCompanyIntel] = useState<CompanyIntelData | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

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
      const res = await fetch("/api/scan_contact", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to scan card");
      }
      return res.json() as Promise<ParsedContact>;
    },
    onSuccess: (data) => {
      setParsedContact(data);
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

  const extractTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/extract_contact_from_text", { text });
      return res.json() as Promise<ParsedContact>;
    },
    onSuccess: (data) => {
      setParsedContact(data);
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

  const saveContactMutation = useMutation({
    mutationFn: async (contact: ParsedContact) => {
      const res = await apiRequest("POST", "/api/contacts", {
        ...contact,
        rawText: scanMode === "paste" ? pastedText : undefined,
      });
      return res.json() as Promise<Contact>;
    },
    onSuccess: (data) => {
      setSavedContact(data);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/recent"] });
      toast({
        title: "Contact saved",
        description: "Contact has been added to your collection",
      });
      fetchIntel(data.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const intelMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const res = await apiRequest("POST", "/api/company_intel", { contactId });
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

  const fetchIntel = (contactId: number) => {
    setIntelError(null);
    intelMutation.mutate(contactId);
  };

  const handleScanCard = () => {
    if (selectedFile) {
      scanCardMutation.mutate(selectedFile);
    }
  };

  const handleExtractText = () => {
    if (pastedText.trim()) {
      extractTextMutation.mutate(pastedText);
    }
  };

  const handleSaveContact = () => {
    if (parsedContact) {
      saveContactMutation.mutate(parsedContact);
    }
  };

  const resetFlow = () => {
    setParsedContact(null);
    setSavedContact(null);
    setCompanyIntel(null);
    setIntelError(null);
    setPastedText("");
    clearImage();
  };

  const isProcessing = scanCardMutation.isPending || extractTextMutation.isPending;

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {/* Scan Input Section */}
      {!parsedContact && (
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Add Contact</CardTitle>
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
                  onClick={handleExtractText}
                  disabled={!pastedText.trim() || isProcessing}
                  data-testid="button-extract"
                >
                  {extractTextMutation.isPending ? (
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

      {/* Parsed Contact Result */}
      {parsedContact && !savedContact && (
        <ContactResultCard
          contact={parsedContact}
          onSave={handleSaveContact}
          onDiscard={resetFlow}
          isSaving={saveContactMutation.isPending}
        />
      )}

      {/* Saved Contact with Intel */}
      {savedContact && (
        <div className="space-y-4">
          <ContactResultCard
            contact={savedContact}
            isSaved
            onNewScan={resetFlow}
          />
          
          <CompanyIntelCard
            intel={companyIntel}
            isLoading={intelMutation.isPending}
            error={intelError}
            onRetry={() => fetchIntel(savedContact.id)}
            companyName={savedContact.companyName}
          />
        </div>
      )}

      {/* Recent Contacts */}
      {!parsedContact && !savedContact && (
        <RecentContactsList />
      )}
    </div>
  );
}
