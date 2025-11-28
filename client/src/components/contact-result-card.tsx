import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ParsedContact, Contact } from "@shared/schema";
import {
  User,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Save,
  X,
  Check,
  Plus,
  Loader2,
  Download,
} from "lucide-react";

interface ContactResultCardProps {
  contact: ParsedContact | Contact;
  onSave?: () => void;
  onDiscard?: () => void;
  onNewScan?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function ContactResultCard({
  contact,
  onSave,
  onDiscard,
  onNewScan,
  isSaving,
  isSaved,
}: ContactResultCardProps) {
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
    if ("id" in contact && contact.id) {
      window.open(`/api/contacts/${contact.id}/vcard`, "_blank");
    }
  };

  const InfoRow = ({
    icon: Icon,
    label,
    value,
    isLink,
  }: {
    icon: typeof User;
    label: string;
    value: string | null | undefined;
    isLink?: boolean;
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
              href={value.startsWith("http") ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate block"
              data-testid={`link-${label.toLowerCase().replace(/\s/g, "-")}`}
            >
              {value}
            </a>
          ) : (
            <p className="text-sm font-medium truncate" data-testid={`text-${label.toLowerCase().replace(/\s/g, "-")}`}>
              {value}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="glass overflow-visible">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(contact.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate" data-testid="text-contact-name">
                {contact.fullName || "Unknown Contact"}
              </CardTitle>
              {contact.jobTitle && (
                <p className="text-sm text-muted-foreground truncate" data-testid="text-contact-title">
                  {contact.jobTitle}
                </p>
              )}
            </div>
          </div>
          {isSaved && (
            <Badge variant="secondary" className="flex-shrink-0 gap-1">
              <Check className="w-3 h-3" />
              Saved
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        <InfoRow icon={Building2} label="Company" value={contact.companyName} />
        <InfoRow icon={Mail} label="Email" value={contact.email} />
        <InfoRow icon={Phone} label="Phone" value={contact.phone} />
        <InfoRow icon={Globe} label="Website" value={contact.website} isLink />
        <InfoRow icon={Linkedin} label="LinkedIn" value={contact.linkedinUrl} isLink />

        {/* Action Buttons */}
        <div className="pt-4 space-y-2">
          {!isSaved && onSave && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={onSave}
                disabled={isSaving}
                data-testid="button-save-contact"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Contact
                  </>
                )}
              </Button>
              {onDiscard && (
                <Button
                  variant="outline"
                  onClick={onDiscard}
                  disabled={isSaving}
                  data-testid="button-discard-contact"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {isSaved && (
            <div className="flex gap-2">
              {"id" in contact && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={downloadVCard}
                  data-testid="button-download-contact-vcard"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export vCard
                </Button>
              )}
              {onNewScan && (
                <Button
                  className="flex-1"
                  onClick={onNewScan}
                  data-testid="button-new-scan"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Scan
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
