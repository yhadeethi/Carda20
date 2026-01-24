import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { saveContact } from "@/lib/contactsStorage";
import { loadContactsV2, ContactV2, upsertContact as upsertContactV2 } from "@/lib/contacts/storage";
import { generateId as generateTimelineId } from "@/lib/contacts/ids";
import { X } from "lucide-react";

interface CreateContactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactCreated?: () => void;
}

export function CreateContactDrawer({ open, onOpenChange, onContactCreated }: CreateContactDrawerProps) {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    title: "",
    email: "",
    phone: "",
    website: "",
    linkedinUrl: "",
    address: "",
  });

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      company: "",
      title: "",
      email: "",
      phone: "",
      website: "",
      linkedinUrl: "",
      address: "",
    });
  };

  const handleSave = () => {
    // Validate at least one field is filled
    const hasData = Object.values(formData).some(value => value.trim() !== "");

    if (!hasData) {
      toast({
        title: "Empty contact",
        description: "Please fill in at least one field",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save using the same logic as scan
      const savedContact = saveContact(formData, null);

      if (!savedContact) {
        toast({
          title: "Save failed",
          description: "Could not save this contact",
          variant: "destructive",
        });
        return;
      }

      // Create V2 contact with timeline
      const existingV2Contacts = loadContactsV2();
      const existingV2 = existingV2Contacts.find((c) => c.id === savedContact.id);

      let v2Contact: ContactV2;

      if (existingV2) {
        v2Contact = {
          ...existingV2,
          name: savedContact.name,
          company: savedContact.company,
          title: savedContact.title,
          email: savedContact.email,
          phone: savedContact.phone,
          website: savedContact.website,
          linkedinUrl: savedContact.linkedinUrl,
          address: savedContact.address,
          companyId: savedContact.companyId,
          timeline: [
            ...existingV2.timeline,
            {
              id: generateTimelineId(),
              type: "contact_updated" as const,
              at: new Date().toISOString(),
              summary: "Contact updated manually",
            },
          ],
          lastTouchedAt: new Date().toISOString(),
        };
      } else {
        v2Contact = {
          ...savedContact,
          tasks: [],
          reminders: [],
          timeline: [
            {
              id: generateTimelineId(),
              type: "manual_created" as const,
              at: savedContact.createdAt || new Date().toISOString(),
              summary: "Contact created manually",
            },
          ],
          lastTouchedAt: savedContact.createdAt,
          notes: "",
        };
      }

      upsertContactV2(v2Contact);

      toast({
        title: "Contact created",
        description: `${formData.name || "Contact"} has been saved successfully`,
      });

      resetForm();
      onOpenChange(false);
      onContactCreated?.();
    } catch (error) {
      console.error("[CreateContactDrawer] Failed to save contact:", error);
      toast({
        title: "Save failed",
        description: "An error occurred while saving the contact",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle>Create Contact</DrawerTitle>
                <DrawerDescription>Add a new contact manually</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="e.g. John Smith"
                value={formData.name}
                onChange={handleInputChange("name")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="e.g. Acme Corporation"
                value={formData.company}
                onChange={handleInputChange("company")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                placeholder="e.g. VP of Sales"
                value={formData.title}
                onChange={handleInputChange("title")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. john@acme.com"
                value={formData.email}
                onChange={handleInputChange("email")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. +1 555-0123"
                value={formData.phone}
                onChange={handleInputChange("phone")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="e.g. https://acme.com"
                value={formData.website}
                onChange={handleInputChange("website")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input
                id="linkedinUrl"
                type="url"
                placeholder="e.g. https://linkedin.com/in/johnsmith"
                value={formData.linkedinUrl}
                onChange={handleInputChange("linkedinUrl")}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="e.g. 123 Main St, New York, NY 10001"
                value={formData.address}
                onChange={handleInputChange("address")}
                className="rounded-xl"
              />
            </div>
          </div>

          <DrawerFooter>
            <Button
              onClick={handleSave}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              Save Contact
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full rounded-xl"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
