import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, User, Save, Check, Building2, Phone, Mail, MapPin, Globe, Briefcase, ChevronLeft } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { useMyProfile, generateVCardFromProfile, MyProfile } from "@/hooks/use-my-profile";
import { useToast } from "@/hooks/use-toast";

interface MyQRModalProps {
  trigger?: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * "edit"  → profile menu entry: shows edit form only, no QR tab
   * "qr"    → capture menu entry: shows QR with link to edit form
   */
  initialTab?: "qr" | "edit";
}

export function MyQRModal({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialTab = "qr",
}: MyQRModalProps) {
  const { profile, setProfile, hasProfile, isLoaded } = useMyProfile();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"qr" | "edit">(initialTab);
  const [formData, setFormData] = useState<MyProfile>(profile);
  const [saved, setSaved] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (newOpen) {
      setFormData(profile);
      setActiveTab(initialTab);
    }
  };

  const handleInputChange = (field: keyof MyProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setProfile(formData);
    setSaved(true);
    toast({ title: "Profile saved", description: "Your card details have been saved" });
    setTimeout(() => {
      setSaved(false);
      // After saving from profile menu stay on edit; from QR menu go back to QR
      if (initialTab === "qr") setActiveTab("qr");
    }, 1000);
  };

  const vcard = generateVCardFromProfile(profile);

  if (!isLoaded) return null;

  // Uncontrolled trigger support
  const handleTriggerClick = () => {
    if (!isControlled) setInternalOpen(true);
  };

  return (
    <>
      {trigger && (
        <span onClick={handleTriggerClick} style={{ display: "contents" }}>
          {trigger}
        </span>
      )}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="p-0 rounded-t-3xl max-h-[92vh] flex flex-col"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* ── QR view ── */}
          {activeTab === "qr" && (
            <>
              {/* Header */}
              <div className="shrink-0 px-5 pt-1 pb-3 border-b border-border/40">
                <h2 className="text-base font-semibold text-foreground">Share my QR</h2>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6">
                {hasProfile ? (
                  <div className="flex flex-col items-center gap-5">
                    {/* QR code */}
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-black/10">
                      <QRCodeSVG
                        value={vcard}
                        size={180}
                        level="M"
                        includeMargin
                        data-testid="qr-code-display"
                      />
                    </div>

                    {/* Identity */}
                    <div className="text-center">
                      <p className="text-base font-semibold text-foreground" data-testid="text-qr-name">
                        {profile.fullName || "Your Name"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {profile.jobTitle && profile.companyName
                          ? `${profile.jobTitle} · ${profile.companyName}`
                          : profile.jobTitle || profile.companyName || ""}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Ask them to scan this to save your contact details.
                    </p>

                    {/* Edit link */}
                    <button
                      onClick={() => setActiveTab("edit")}
                      className="text-sm font-medium text-primary flex items-center gap-1"
                    >
                      Edit my card details
                      <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">No profile yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Add your details to generate a QR code</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("edit")}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] text-white text-sm font-semibold"
                      data-testid="button-add-profile"
                    >
                      Add my details
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Edit / Profile view ── */}
          {activeTab === "edit" && (
            <>
              {/* Header — back arrow only when coming from QR */}
              <div className="shrink-0 px-5 pt-1 pb-3 border-b border-border/40 flex items-center gap-3">
                {initialTab === "qr" && (
                  <button
                    onClick={() => setActiveTab("qr")}
                    className="text-primary"
                    aria-label="Back to QR"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="text-base font-semibold text-foreground">
                  {initialTab === "qr" ? "Edit my card" : "My profile"}
                </h2>
              </div>

              {/* Scrollable form */}
              <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 space-y-3">

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> Full name
                  </Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    placeholder="John Doe"
                    className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                    data-testid="input-my-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Job title
                    </Label>
                    <Input
                      value={formData.jobTitle}
                      onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                      placeholder="VP of Sales"
                      className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                      data-testid="input-my-title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Company
                    </Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      placeholder="Acme Corp"
                      className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                      data-testid="input-my-company"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="+61 4xx xxx xxx"
                      className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                      data-testid="input-my-phone"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@acme.com"
                      className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                      data-testid="input-my-email"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </Label>
                  <Input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange("website", e.target.value)}
                    placeholder="https://example.com"
                    className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                    data-testid="input-my-website"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <SiLinkedin className="w-3 h-3 text-[#0A66C2]" /> LinkedIn
                  </Label>
                  <div className="relative">
                    <SiLinkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A66C2]" />
                    <Input
                      type="url"
                      value={formData.linkedinUrl}
                      onChange={(e) => handleInputChange("linkedinUrl", e.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="h-11 rounded-xl bg-muted/40 border-0 pl-10 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                      data-testid="input-my-linkedin"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Address
                  </Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => handleInputChange("street", e.target.value)}
                    placeholder="123 Main Street"
                    className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                    data-testid="input-my-street"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="City"
                    className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                    data-testid="input-my-city"
                  />
                  <Input
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    placeholder="State"
                    className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                    data-testid="input-my-state"
                  />
                  <Input
                    value={formData.postcode}
                    onChange={(e) => handleInputChange("postcode", e.target.value)}
                    placeholder="Postcode"
                    className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                    data-testid="input-my-postcode"
                  />
                </div>

                <Input
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  placeholder="Country"
                  className="h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-2 focus-visible:ring-[#4B68F5]/30"
                  data-testid="input-my-country"
                />
              </div>

              {/* Sticky save button */}
              <div className="shrink-0 px-5 pt-3 pb-4 border-t border-border/40 bg-background">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!formData.fullName && !formData.email && !formData.phone}
                  className="w-full h-12 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-[#4B68F5] to-[#7B5CF0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-transform"
                  data-testid="button-save-my-card"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save profile
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
