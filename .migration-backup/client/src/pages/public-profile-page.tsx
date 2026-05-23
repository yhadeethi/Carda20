import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicProfile } from "@shared/schema";
import {
  CreditCard,
  Building2,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Download,
  UserX,
} from "lucide-react";

export default function PublicProfilePage() {
  const [, params] = useRoute("/u/:slug");
  const slug = params?.slug;

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ["/api/public_profile", slug],
    enabled: !!slug,
  });

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const downloadVCard = () => {
    if (slug) {
      window.open(`/api/public_profile/${slug}/vcard`, "_blank");
    }
  };

  const InfoRow = ({
    icon: Icon,
    label,
    value,
    isLink,
    href,
  }: {
    icon: typeof Mail;
    label: string;
    value: string | null | undefined;
    isLink?: boolean;
    href?: string;
  }) => {
    if (!value) return null;

    return (
      <div className="flex items-center gap-3 py-2">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLink ? (
            <a
              href={href || (value.startsWith("http") ? value : `https://${value}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate block"
            >
              {value}
            </a>
          ) : (
            <p className="text-sm font-medium truncate">{value}</p>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
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

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <UserX className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Profile not found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This profile doesn't exist or may have been removed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <CreditCard className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg">Carda</span>
      </div>

      {/* Profile Card */}
      <Card className="w-full max-w-md glass">
        <CardContent className="pt-6">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center text-center mb-6">
            <Avatar className="w-20 h-20 text-2xl mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold" data-testid="text-public-name">
              {profile.fullName || "Anonymous"}
            </h1>
            {profile.jobTitle && profile.companyName && (
              <p className="text-muted-foreground mt-1" data-testid="text-public-title">
                {profile.jobTitle} at {profile.companyName}
              </p>
            )}
            {profile.jobTitle && !profile.companyName && (
              <p className="text-muted-foreground mt-1">{profile.jobTitle}</p>
            )}
            {!profile.jobTitle && profile.companyName && (
              <p className="text-muted-foreground mt-1">{profile.companyName}</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-1 mb-6">
            <InfoRow
              icon={Mail}
              label="Email"
              value={profile.email}
              isLink
              href={`mailto:${profile.email}`}
            />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={profile.phone}
              isLink
              href={`tel:${profile.phone}`}
            />
            <InfoRow
              icon={Globe}
              label="Website"
              value={profile.website}
              isLink
            />
            <InfoRow
              icon={Linkedin}
              label="LinkedIn"
              value={profile.linkedinUrl}
              isLink
            />
            {location && (
              <InfoRow
                icon={MapPin}
                label="Location"
                value={location}
              />
            )}
          </div>

          {/* Save vCard Button */}
          <Button
            className="w-full"
            onClick={downloadVCard}
            data-testid="button-save-vcard"
          >
            <Download className="mr-2 h-4 w-4" />
            Save Contact
          </Button>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-sm text-muted-foreground">
        Powered by Carda
      </p>
    </div>
  );
}
