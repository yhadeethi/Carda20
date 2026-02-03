import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  ArrowLeft,
  Camera,
  Plus,
  Users,
  Calendar,
  MapPin,
  Tag,
  X,
  Loader2,
  FileText,
  Check,
  User,
  Building2,
  Mail,
  Phone,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserEvent, Contact } from "@shared/schema";

interface EventDetailProps {
  eventId: number;
  onBack: () => void;
  onScanAtEvent: (eventId: number) => void;
  onSelectContact?: (contact: Contact) => void;
}

export function EventDetail({ eventId, onBack, onScanAtEvent, onSelectContact }: EventDetailProps) {
  const { toast } = useToast();
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showAddContactDrawer, setShowAddContactDrawer] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [editLink, setEditLink] = useState("");

  const [manualName, setManualName] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  const { data: event, isLoading: eventLoading } = useQuery<UserEvent>({
    queryKey: ["/api/user-events", eventId],
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/user-events", eventId, "contacts"],
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: Partial<UserEvent>) => {
      const response = await apiRequest("PATCH", `/api/user-events/${eventId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
      setShowEditDrawer(false);
      toast({ title: "Event updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update event", variant: "destructive" });
    },
  });

  const endEventMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/user-events/${eventId}`, { isActive: false, endedAt: new Date().toISOString() });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-events/active"] });
      toast({ title: "Event ended" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to end event", variant: "destructive" });
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      const response = await apiRequest("POST", "/api/contacts", contactData);
      const contact = await response.json();
      await apiRequest("POST", `/api/user-events/${eventId}/attach-contacts`, { contactIds: [contact.id] });
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-events", eventId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowAddContactDrawer(false);
      resetManualForm();
      toast({ title: "Contact added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add contact", variant: "destructive" });
    },
  });

  const resetManualForm = () => {
    setManualName("");
    setManualCompany("");
    setManualTitle("");
    setManualEmail("");
    setManualPhone("");
  };

  const openEditDrawer = useCallback(() => {
    if (event) {
      setEditTitle(event.title);
      setEditNotes(event.notes || "");
      setEditTags(event.tags || []);
      setEditLink(event.eventLink || "");
      setShowEditDrawer(true);
    }
  }, [event]);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  const handleSaveEvent = () => {
    updateEventMutation.mutate({
      title: editTitle,
      notes: editNotes || null,
      tags: editTags.length > 0 ? editTags : null,
      eventLink: editLink || null,
    });
  };

  const handleAddManualContact = () => {
    if (!manualName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    createContactMutation.mutate({
      fullName: manualName.trim(),
      companyName: manualCompany.trim() || null,
      jobTitle: manualTitle.trim() || null,
      email: manualEmail.trim() || null,
      phone: manualPhone.trim() || null,
    });
  };

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const isActive = event.isActive === 1;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{event.title}</h1>
            {isActive && (
              <Badge variant="default" className="shrink-0">Active</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(event.startedAt || event.createdAt!).toLocaleDateString()}
            </span>
            {event.locationLabel && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {event.locationLabel}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(`/api/user-events/${eventId}/report`, '_blank')}
          data-testid="button-export-report"
        >
          <FileText className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={openEditDrawer}>
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>

      {event.tags && event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {event.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {event.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
          </CardContent>
        </Card>
      )}

      {event.eventLink && (
        <a
          href={event.eventLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          Event Website
        </a>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2"
          onClick={() => onScanAtEvent(eventId)}
          data-testid="button-scan-at-event"
        >
          <Camera className="w-4 h-4" />
          Scan Cards
        </Button>
        <Drawer open={showAddContactDrawer} onOpenChange={setShowAddContactDrawer}>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowAddContactDrawer(true)}
            data-testid="button-add-contact-manual"
          >
            <Plus className="w-4 h-4" />
            Add Manually
          </Button>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Add Contact Manually</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  placeholder="Full name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  data-testid="input-manual-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Input
                  placeholder="Company name"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  data-testid="input-manual-company"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Title</label>
                <Input
                  placeholder="Job title"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  data-testid="input-manual-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  placeholder="email@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  data-testid="input-manual-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  placeholder="+1234567890"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  data-testid="input-manual-phone"
                />
              </div>
            </div>
            <DrawerFooter>
              <Button
                onClick={handleAddManualContact}
                disabled={createContactMutation.isPending}
                className="gap-2"
              >
                {createContactMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Contact
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">
            Contacts ({contacts.length})
          </h2>
        </div>

        {contactsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No contacts captured yet</p>
              <p className="text-sm mt-1">Scan business cards or add contacts manually</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <Card
                key={contact.id}
                className="cursor-pointer hover-elevate"
                onClick={() => onSelectContact?.(contact)}
                data-testid={`card-contact-${contact.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{contact.fullName || "Unknown"}</h4>
                      {(contact.jobTitle || contact.companyName) && (
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.jobTitle}
                          {contact.jobTitle && contact.companyName && " at "}
                          {contact.companyName}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {contact.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {isActive && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => endEventMutation.mutate()}
          disabled={endEventMutation.isPending}
          data-testid="button-end-event"
        >
          {endEventMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          End Event
        </Button>
      )}

      <Drawer open={showEditDrawer} onOpenChange={setShowEditDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Event</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Name</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="input-edit-title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {editTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {editTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event Link</label>
              <Input
                placeholder="https://..."
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={handleSaveEvent}
              disabled={updateEventMutation.isPending}
              className="gap-2"
            >
              {updateEventMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
