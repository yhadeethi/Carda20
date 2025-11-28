import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactResultCard } from "@/components/contact-result-card";
import { CompanyIntelCard } from "@/components/company-intel-card";
import { Contact, CompanyIntelData } from "@shared/schema";
import {
  ChevronRight,
  Users,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecentContact {
  id: number;
  fullName: string | null;
  companyName: string | null;
  createdAt: string;
}

export function RecentContactsList() {
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactDetails, setContactDetails] = useState<Contact | null>(null);
  const [companyIntel, setCompanyIntel] = useState<CompanyIntelData | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery<RecentContact[]>({
    queryKey: ["/api/contacts/recent"],
  });

  const contactDetailQuery = useQuery<Contact>({
    queryKey: ["/api/contacts", selectedContactId],
    enabled: !!selectedContactId,
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

  const handleContactClick = async (contactId: number) => {
    setSelectedContactId(contactId);
    setCompanyIntel(null);
    setIntelError(null);
  };

  const handleBack = () => {
    setSelectedContactId(null);
    setContactDetails(null);
    setCompanyIntel(null);
    setIntelError(null);
  };

  const fetchIntel = (contactId: number) => {
    setIntelError(null);
    intelMutation.mutate(contactId);
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

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Recent Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedContactId) {
    const selectedContact = contactDetailQuery.data;
    
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2"
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to contacts
        </Button>

        {contactDetailQuery.isLoading ? (
          <Card className="glass">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
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
        ) : selectedContact ? (
          <>
            <ContactResultCard
              contact={selectedContact}
              isSaved
            />
            <CompanyIntelCard
              intel={companyIntel}
              isLoading={intelMutation.isPending}
              error={intelError}
              onRetry={() => fetchIntel(selectedContact.id)}
              companyName={selectedContact.companyName}
            />
            {!companyIntel && !intelMutation.isPending && !intelError && (
              <Button
                className="w-full"
                onClick={() => fetchIntel(selectedContact.id)}
                data-testid="button-get-intel"
              >
                Get Company Intel
              </Button>
            )}
          </>
        ) : (
          <Card className="glass">
            <CardContent className="pt-6 text-center text-muted-foreground">
              Contact not found
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No contacts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scan a business card or paste text to add your first contact
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Recent Contacts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => handleContactClick(contact.id)}
              className="flex items-center gap-3 py-3 w-full text-left hover-elevate rounded-lg px-2 -mx-2 transition-smooth"
              data-testid={`contact-item-${contact.id}`}
            >
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(contact.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {contact.fullName || "Unknown"}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {contact.companyName || "No company"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">
                  {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
