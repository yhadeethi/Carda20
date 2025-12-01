import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { QrCode, User, Save, Check, Building2, Phone, Mail, MapPin, Globe, Briefcase, Linkedin } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { useMyProfile, generateVCardFromProfile, MyProfile } from "@/hooks/use-my-profile";
import { useToast } from "@/hooks/use-toast";

interface MyQRModalProps {
  trigger?: React.ReactNode;
}

export function MyQRModal({ trigger }: MyQRModalProps) {
  const { profile, setProfile, hasProfile, isLoaded } = useMyProfile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"qr" | "edit">(hasProfile ? "qr" : "edit");
  const [formData, setFormData] = useState<MyProfile>(profile);
  const [saved, setSaved] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setFormData(profile);
      setActiveTab(hasProfile ? "qr" : "edit");
    }
  };

  const handleInputChange = (field: keyof MyProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setProfile(formData);
    setSaved(true);
    toast({
      title: "Profile saved",
      description: "Your card details have been saved",
    });
    setTimeout(() => {
      setSaved(false);
      setActiveTab("qr");
    }, 1000);
  };

  const vcard = generateVCardFromProfile(profile);

  const defaultTrigger = (
    <Button 
      size="icon" 
      variant="ghost" 
      data-testid="button-my-qr"
      aria-label="Show My QR"
    >
      <QrCode className="w-4 h-4" />
    </Button>
  );

  if (!isLoaded) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            My QR Code
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "qr" | "edit")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr" className="gap-2" data-testid="tab-my-qr">
              <QrCode className="w-4 h-4" />
              My QR
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-2" data-testid="tab-edit-profile">
              <User className="w-4 h-4" />
              Edit Card
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="mt-4">
            {hasProfile ? (
              <div className="flex flex-col items-center gap-4">
                <Card className="p-4 bg-white">
                  <QRCodeSVG
                    value={vcard}
                    size={200}
                    level="M"
                    includeMargin
                    data-testid="qr-code-display"
                  />
                </Card>
                <div className="text-center">
                  <p className="font-medium" data-testid="text-qr-name">{profile.fullName || "Your Name"}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.jobTitle && profile.companyName
                      ? `${profile.jobTitle} at ${profile.companyName}`
                      : profile.jobTitle || profile.companyName || ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center px-4">
                  Ask them to scan this to save your contact details.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-medium">No profile yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Add your details to generate a QR code
                </p>
                <Button onClick={() => setActiveTab("edit")} data-testid="button-add-profile">
                  Add My Details
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="edit" className="mt-4 flex-1 flex flex-col min-h-0 -mx-6 -mb-6">
            <div className="flex-1 overflow-y-auto px-6 pb-28">
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> Full Name
                  </Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    placeholder="John Doe"
                    data-testid="input-my-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Job Title
                    </Label>
                    <Input
                      value={formData.jobTitle}
                      onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                      placeholder="VP of Sales"
                      data-testid="input-my-title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Company
                    </Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      placeholder="Acme Corp"
                      data-testid="input-my-company"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="+1 555-0123"
                      data-testid="input-my-phone"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@acme.com"
                      data-testid="input-my-email"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </Label>
                  <Input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange("website", e.target.value)}
                    placeholder="https://example.com"
                    data-testid="input-my-website"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <SiLinkedin className="w-3 h-3 text-[#0A66C2]" /> LinkedIn
                  </Label>
                  <div className="relative">
                    <SiLinkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A66C2]" />
                    <Input
                      type="url"
                      value={formData.linkedinUrl}
                      onChange={(e) => handleInputChange("linkedinUrl", e.target.value)}
                      placeholder="https://www.linkedin.com/in/username"
                      className="pl-10"
                      data-testid="input-my-linkedin"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Address
                  </Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => handleInputChange("street", e.target.value)}
                    placeholder="123 Main Street"
                    data-testid="input-my-street"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="City"
                    data-testid="input-my-city"
                  />
                  <Input
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    placeholder="State"
                    data-testid="input-my-state"
                  />
                  <Input
                    value={formData.postcode}
                    onChange={(e) => handleInputChange("postcode", e.target.value)}
                    placeholder="Postcode"
                    data-testid="input-my-postcode"
                  />
                </div>

                <Input
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  placeholder="Country"
                  data-testid="input-my-country"
                />
              </div>
            </div>

            <div 
              className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 px-6 pt-3 z-20"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
            >
              <button
                type="button"
                onClick={handleSave}
                disabled={!formData.fullName && !formData.email && !formData.phone}
                className="w-full rounded-xl py-3 text-base font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-save-my-card"
              >
                {saved ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    Saved!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Save className="h-4 w-4" />
                    Save My Card
                  </span>
                )}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
