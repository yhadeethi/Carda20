import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { User, updateProfileSchema } from "@shared/schema";
import { 
  User as UserIcon, 
  Building2, 
  Briefcase, 
  Phone, 
  Globe, 
  Linkedin, 
  MapPin, 
  Target,
  QrCode,
  Download,
  Share2,
  ExternalLink,
  Loader2,
  Save,
  Copy,
  Check
} from "lucide-react";

type ProfileFormValues = z.infer<typeof updateProfileSchema>;

export function MyCardTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"profile" | "qr">("profile");
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: profile, isLoading } = useQuery<User>({
    queryKey: ["/api/profile"],
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: "",
      companyName: "",
      jobTitle: "",
      phone: "",
      website: "",
      linkedinUrl: "",
      country: "",
      city: "",
      industry: "",
      focusTopics: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.fullName || "",
        companyName: profile.companyName || "",
        jobTitle: profile.jobTitle || "",
        phone: profile.phone || "",
        website: profile.website || "",
        linkedinUrl: profile.linkedinUrl || "",
        country: profile.country || "",
        city: profile.city || "",
        industry: profile.industry || "",
        focusTopics: profile.focusTopics || "",
      });
    }
  }, [profile, form]);

  useEffect(() => {
    if (profile?.publicSlug && qrCanvasRef.current) {
      const publicUrl = `${window.location.origin}/u/${profile.publicSlug}`;
      generateQRCode(qrCanvasRef.current, publicUrl);
    }
  }, [profile?.publicSlug, activeTab]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const res = await apiRequest("POST", "/api/profile", values);
      return res.json() as Promise<User>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const publicUrl = profile?.publicSlug 
    ? `${window.location.origin}/u/${profile.publicSlug}` 
    : null;

  const copyPublicUrl = async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Your public profile link has been copied",
      });
    }
  };

  const downloadQRCode = () => {
    if (qrCanvasRef.current) {
      const link = document.createElement("a");
      link.download = `carda-${profile?.publicSlug || "qr"}.png`;
      link.href = qrCanvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const downloadVCard = async () => {
    if (profile?.publicSlug) {
      window.open(`/api/profile/vcard`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        <Card className="glass">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {/* Profile Header */}
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16 text-lg">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(profile?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold" data-testid="text-profile-name">
                {profile?.fullName || "Your Name"}
              </h2>
              <p className="text-muted-foreground" data-testid="text-profile-title">
                {profile?.jobTitle && profile?.companyName
                  ? `${profile.jobTitle} at ${profile.companyName}`
                  : profile?.jobTitle || profile?.companyName || "Add your details"}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "profile" | "qr")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile-edit">
                <UserIcon className="w-4 h-4" />
                Edit Profile
              </TabsTrigger>
              <TabsTrigger value="qr" className="gap-2" data-testid="tab-qr">
                <QrCode className="w-4 h-4" />
                Share Card
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <UserIcon className="w-3 h-3" />
                            Full Name
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="John Doe" 
                              data-testid="input-profile-name"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Briefcase className="w-3 h-3" />
                            Job Title
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="VP of Sales" 
                              data-testid="input-profile-title"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building2 className="w-3 h-3" />
                          Company
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Acme Corporation" 
                            data-testid="input-profile-company"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            Phone
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="+1 555-0123" 
                              data-testid="input-profile-phone"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="w-3 h-3" />
                            Website
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="url" 
                              placeholder="https://example.com" 
                              data-testid="input-profile-website"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="linkedinUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Linkedin className="w-3 h-3" />
                          LinkedIn URL
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="url" 
                            placeholder="https://linkedin.com/in/yourprofile" 
                            data-testid="input-profile-linkedin"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            City
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="San Francisco" 
                              data-testid="input-profile-city"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="United States" 
                              data-testid="input-profile-country"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building2 className="w-3 h-3" />
                          Industry
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Technology, SaaS, Finance..." 
                            data-testid="input-profile-industry"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="focusTopics"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Target className="w-3 h-3" />
                          Focus Topics
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="AI/ML, Enterprise Sales, Digital Transformation..."
                            className="resize-none"
                            data-testid="input-profile-topics"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="qr" className="mt-6">
              <div className="space-y-6">
                {/* QR Code Display */}
                <div className="flex flex-col items-center">
                  <Card className="p-6 bg-white">
                    <canvas 
                      ref={qrCanvasRef} 
                      width={200} 
                      height={200}
                      className="w-[200px] h-[200px]"
                      data-testid="qr-code-canvas"
                    />
                  </Card>
                  <div className="mt-4 text-center">
                    <p className="font-medium">{profile?.fullName || "Your Name"}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile?.jobTitle && profile?.companyName
                        ? `${profile.jobTitle} at ${profile.companyName}`
                        : "Complete your profile"}
                    </p>
                  </div>
                </div>

                {/* Public URL */}
                {publicUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your public profile link</label>
                    <div className="flex gap-2">
                      <Input
                        value={publicUrl}
                        readOnly
                        className="bg-muted"
                        data-testid="input-public-url"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={copyPublicUrl}
                        data-testid="button-copy-url"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => window.open(publicUrl, "_blank")}
                        data-testid="button-open-profile"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadQRCode}
                    data-testid="button-download-qr"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadVCard}
                    data-testid="button-download-vcard"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Export vCard
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function generateQRCode(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = 200;
  const moduleCount = 25;
  const moduleSize = size / moduleCount;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  const qrData = generateQRData(text, moduleCount);

  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qrData[row][col]) {
        ctx.fillRect(
          col * moduleSize,
          row * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }
}

function generateQRData(text: string, size: number): boolean[][] {
  const data: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
  
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const isOuter = i === 0 || i === 6 || j === 0 || j === 6;
      const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      if (isOuter || isInner) {
        data[i][j] = true;
        data[i][size - 7 + j] = true;
        data[size - 7 + i][j] = true;
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    data[6][i] = i % 2 === 0;
    data[i][6] = i % 2 === 0;
  }

  const hash = simpleHash(text);
  for (let i = 8; i < size - 8; i++) {
    for (let j = 8; j < size - 8; j++) {
      if ((i !== 6 && j !== 6)) {
        const bit = (hash >> ((i * size + j) % 32)) & 1;
        data[i][j] = bit === 1 || Math.random() > 0.5;
      }
    }
  }

  return data;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
