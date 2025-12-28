import { useState, useMemo, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Edit, X, Sparkles, Bell, Calendar, StickyNote, Briefcase } from "lucide-react";
import { SiHubspot } from "react-icons/si";
import { ContactHeroCard, Contact } from "./ContactHeroCard";
import { ContactBottomBar } from "./ContactBottomBar";
import { QuickActionsSheet, QuickAction } from "./QuickActionsSheet";
import { TimelineFeed, TimelineItem } from "./TimelineFeed";
import { StoredContact } from "@/lib/contactsStorage";
import { ContactV2, addTimelineEvent, addReminder, updateContactV2 } from "@/lib/contacts/storage";
import { apiRequest } from "@/lib/queryClient";

interface ContactDetailViewProps {
  contact: StoredContact;
  contactV2: ContactV2 | null;
  onBack: () => void;
  onDelete?: (id: string) => void;
  onUpdate: () => void;
  onContactUpdated?: (contactId: string) => void;
  onDownloadVCard: () => void;
  onViewInOrgMap?: (companyId: string) => void;
  companyId?: string | null;
}

export function ContactDetailView({
  contact,
  contactV2,
  onBack,
  onDelete,
  onUpdate,
  onContactUpdated,
  onDownloadVCard,
  onViewInOrgMap,
  companyId,
}: ContactDetailViewProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState({
    name: contact.name || "",
    title: contact.title || "",
    company: contact.company || "",
    email: contact.email || "",
    phone: contact.phone || "",
    website: contact.website || "",
    linkedinUrl: contact.linkedinUrl || "",
  });
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  const { data: hubspotStatus } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/hubspot/status'],
  });

  const heroContact: Contact = useMemo(() => ({
    id: contact.id,
    name: contact.name,
    title: contact.title,
    company: contact.company,
    phone: contact.phone,
    email: contact.email,
    website: contact.website,
    linkedinUrl: contact.linkedinUrl,
    scannedAt: contact.createdAt,
    lastTouchedAt: contactV2?.lastTouchedAt,
    syncedToHubspot: contactV2?.timeline?.some(t => t.type === 'hubspot_synced'),
  }), [contact, contactV2]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    if (!contactV2?.timeline) return [];
    return contactV2.timeline.map(t => ({
      id: t.id,
      type: t.type,
      title: t.summary,
      detail: typeof t.meta === 'object' && t.meta !== null ? (t.meta as any).bodyPreview || undefined : undefined,
      at: t.at,
    })).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [contactV2]);

  const handleSaveEdits = async () => {
    setIsSavingEdits(true);
    try {
      const updated = updateContactV2(contact.id, editedFields);
      if (!updated) {
        throw new Error("Failed to update contact");
      }
      
      setIsEditing(false);
      toast({ title: "Contact updated" });
      
      onUpdate();
      onContactUpdated?.(contact.id);
      
      try {
        addTimelineEvent(contact.id, 'contact_updated', 'Contact details updated');
      } catch (timelineErr) {
        console.warn("[ContactDetailView] Timeline event failed:", timelineErr);
      }
    } catch (e) {
      console.error("[ContactDetailView] Save failed:", e);
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleCall = () => {
    if (contact.phone) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  const handleEmail = () => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  const handleOpenWebsite = () => {
    if (contact.website) {
      window.open(contact.website, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenLinkedIn = () => {
    if (contact.linkedinUrl) {
      window.open(contact.linkedinUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleAddNote = async (text: string) => {
    if (!contactV2) return;
    setIsAddingNote(true);
    try {
      addTimelineEvent(contactV2.id, 'note_added', text);
      onUpdate();
      toast({ title: "Note added" });
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
    }
    setIsAddingNote(false);
  };

  const handleSyncToHubspot = async () => {
    if (!contact.email) {
      toast({
        title: "Email required",
        description: "Contact must have an email to sync with HubSpot",
        variant: "destructive",
      });
      return;
    }

    setIsSyncingHubspot(true);
    try {
      const nameParts = (contact.name || '').split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';

      const response = await apiRequest('POST', '/api/hubspot/sync', {
        email: contact.email,
        firstname,
        lastname,
        phone: contact.phone,
        company: contact.company,
        jobtitle: contact.title,
        website: contact.website,
      });
      
      const result = await response.json();

      if (result.success) {
        if (contactV2) {
          addTimelineEvent(
            contactV2.id,
            'hubspot_synced',
            `Synced to HubSpot (${result.action})`,
            { hubspotId: result.hubspotId }
          );
        }
        onUpdate();
        toast({
          title: result.action === 'created' ? "Added to HubSpot" : "Updated in HubSpot",
          description: `Contact ${result.action} successfully`,
        });
      } else {
        toast({
          title: "Sync failed",
          description: result.error || "Failed to sync with HubSpot",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with HubSpot",
        variant: "destructive",
      });
    }
    setIsSyncingHubspot(false);
  };

  const quickActions: QuickAction[] = useMemo(() => {
    const actions: QuickAction[] = [
      {
        id: "followup",
        label: "Generate Follow-up",
        icon: <Sparkles className="w-5 h-5" />,
        onClick: () => {
          toast({ title: "Coming soon", description: "Follow-up generator coming soon" });
        },
      },
      {
        id: "reminder",
        label: "Add Reminder",
        icon: <Bell className="w-5 h-5" />,
        onClick: () => {
          if (contactV2) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3);
            addReminder(contactV2.id, `Follow up with ${contact.name}`, dueDate.toISOString());
            onUpdate();
            toast({ title: "Reminder set for 3 days" });
          }
        },
      },
      {
        id: "meeting",
        label: "Schedule Meeting",
        icon: <Calendar className="w-5 h-5" />,
        onClick: () => {
          toast({ title: "Coming soon", description: "Meeting scheduler coming soon" });
        },
      },
      {
        id: "intel",
        label: "Company Brief",
        icon: <Briefcase className="w-5 h-5" />,
        onClick: () => {
          toast({ title: "Coming soon", description: "Company intel coming soon" });
        },
      },
    ];

    if (hubspotStatus?.connected) {
      const isSynced = contactV2?.timeline?.some(t => t.type === 'hubspot_synced');
      actions.push({
        id: "hubspot",
        label: "Sync to HubSpot",
        icon: <SiHubspot className="w-5 h-5 text-[#FF7A59]" />,
        status: isSynced ? "Synced" : "Not synced",
        onClick: handleSyncToHubspot,
      });
    }

    actions.push({
      id: "note",
      label: "Add Note",
      icon: <StickyNote className="w-5 h-5" />,
      onClick: () => {
        setShowQuickActions(false);
      },
    });

    return actions;
  }, [contactV2, hubspotStatus, contact.name]);

  return (
    <div className="flex flex-col min-h-full pb-24" data-testid="contact-detail-view">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 -ml-2"
          data-testid="button-back-to-contacts"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(!isEditing)}
            data-testid="button-toggle-edit"
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </Button>
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive"
              data-testid="button-delete-contact"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing ? (
        <div className="space-y-3 mb-6 p-4 rounded-2xl bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input
              value={editedFields.name}
              onChange={(e) => setEditedFields(f => ({ ...f, name: e.target.value }))}
              placeholder="Full Name"
              data-testid="input-edit-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Job Title</Label>
            <Input
              value={editedFields.title}
              onChange={(e) => setEditedFields(f => ({ ...f, title: e.target.value }))}
              placeholder="Job Title"
              data-testid="input-edit-title"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Company</Label>
            <Input
              value={editedFields.company}
              onChange={(e) => setEditedFields(f => ({ ...f, company: e.target.value }))}
              placeholder="Company"
              data-testid="input-edit-company"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={editedFields.email}
              onChange={(e) => setEditedFields(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
              data-testid="input-edit-email"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input
              type="tel"
              value={editedFields.phone}
              onChange={(e) => setEditedFields(f => ({ ...f, phone: e.target.value }))}
              placeholder="+1 (555) 123-4567"
              data-testid="input-edit-phone"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <Input
              value={editedFields.website}
              onChange={(e) => setEditedFields(f => ({ ...f, website: e.target.value }))}
              placeholder="https://example.com"
              data-testid="input-edit-website"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">LinkedIn</Label>
            <Input
              value={editedFields.linkedinUrl}
              onChange={(e) => setEditedFields(f => ({ ...f, linkedinUrl: e.target.value }))}
              placeholder="https://linkedin.com/in/username"
              data-testid="input-edit-linkedin"
            />
          </div>
          <Button 
            onClick={handleSaveEdits} 
            disabled={isSavingEdits}
            className="w-full mt-2"
            data-testid="button-save-edits"
          >
            {isSavingEdits ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      ) : (
        <>
          {/* Hero Card */}
          <ContactHeroCard
            contact={heroContact}
            onCall={handleCall}
            onEmail={handleEmail}
            onOpenWebsite={handleOpenWebsite}
            onOpenLinkedIn={handleOpenLinkedIn}
          />

          {/* Timeline Feed */}
          <div className="mt-6">
            <TimelineFeed
              items={timelineItems}
              onAddNote={handleAddNote}
              isAddingNote={isAddingNote}
            />
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contact.name || "this contact"}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(contact.id);
                setShowDeleteConfirm(false);
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Actions Sheet */}
      <QuickActionsSheet
        open={showQuickActions}
        onOpenChange={setShowQuickActions}
        actions={quickActions}
      />

      {/* Bottom Bar */}
      <ContactBottomBar
        isSaved={true}
        onSave={onDownloadVCard}
        onQuickActions={() => setShowQuickActions(true)}
        onUpdate={onDownloadVCard}
      />
    </div>
  );
}
