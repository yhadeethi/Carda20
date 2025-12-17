/**
 * Batch Review Screen
 * Review and approve extracted contacts from batch scan
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Check,
  X,
  Edit,
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QueuedScan, updateQueueItem, clearBatchSession } from "@/lib/batchScanStorage";
import { saveContact } from "@/lib/contactsStorage";

interface BatchReviewProps {
  items: QueuedScan[];
  eventName: string;
  onComplete: () => void;
  onBack: () => void;
}

interface EditableContact {
  fullName: string;
  jobTitle: string;
  companyName: string;
  email: string;
  phone: string;
  website: string;
  linkedinUrl: string;
  address: string;
}

export function BatchReview({ items, eventName, onComplete, onBack }: BatchReviewProps) {
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<QueuedScan | null>(null);
  const [editedContact, setEditedContact] = useState<EditableContact | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const completedItems = items.filter(i => i.status === 'completed');
  const failedItems = items.filter(i => i.status === 'failed');
  const processingItems = items.filter(i => i.status === 'processing');
  const pendingItems = items.filter(i => i.status === 'pending');

  const isProcessing = processingItems.length > 0 || pendingItems.length > 0;
  const progress = items.length > 0 
    ? ((completedItems.length + failedItems.length) / items.length) * 100 
    : 0;

  const handleApprove = useCallback((itemId: string) => {
    setApprovedIds(prev => new Set([...Array.from(prev), itemId]));
    setRejectedIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const handleReject = useCallback((itemId: string) => {
    setRejectedIds(prev => new Set([...Array.from(prev), itemId]));
    setApprovedIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const handleEdit = useCallback((item: QueuedScan) => {
    setEditingItem(item);
    setEditedContact({
      fullName: item.result?.contact.fullName || '',
      jobTitle: item.result?.contact.jobTitle || '',
      companyName: item.result?.contact.companyName || '',
      email: item.result?.contact.email || '',
      phone: item.result?.contact.phone || '',
      website: item.result?.contact.website || '',
      linkedinUrl: item.result?.contact.linkedinUrl || '',
      address: item.result?.contact.address || '',
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingItem || !editedContact) return;
    
    updateQueueItem(editingItem.id, {
      result: {
        rawText: editingItem.result?.rawText || '',
        contact: editedContact,
      },
    });
    
    setEditingItem(null);
    setEditedContact(null);
    handleApprove(editingItem.id);
    toast({ title: "Contact updated" });
  }, [editingItem, editedContact, handleApprove, toast]);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    let savedCount = 0;

    for (const item of completedItems) {
      if (approvedIds.has(item.id) && item.result?.contact) {
        try {
          saveContact({
            name: item.result.contact.fullName || '',
            company: item.result.contact.companyName || '',
            title: item.result.contact.jobTitle || '',
            email: item.result.contact.email || '',
            phone: item.result.contact.phone || '',
            website: item.result.contact.website || '',
            linkedinUrl: item.result.contact.linkedinUrl || '',
            address: item.result.contact.address || '',
          }, eventName);
          savedCount++;
        } catch (err) {
          console.error("[BatchReview] Failed to save contact:", err);
        }
      }
    }

    clearBatchSession();
    setIsSaving(false);
    
    toast({
      title: `${savedCount} contact${savedCount !== 1 ? 's' : ''} saved`,
      description: eventName ? `Tagged with "${eventName}"` : undefined,
    });
    
    onComplete();
  }, [completedItems, approvedIds, eventName, onComplete, toast]);

  const handleApproveAll = useCallback(() => {
    const newApproved = new Set(approvedIds);
    completedItems.forEach(item => newApproved.add(item.id));
    setApprovedIds(newApproved);
    setRejectedIds(new Set());
  }, [completedItems, approvedIds]);

  return (
    <>
      <Drawer open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Contact</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="px-4 max-h-[60vh]">
            {editedContact && (
              <div className="space-y-3 pb-4">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={editedContact.fullName}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, fullName: e.target.value} : null)}
                    placeholder="Full Name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={editedContact.jobTitle}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, jobTitle: e.target.value} : null)}
                    placeholder="Job Title"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={editedContact.companyName}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, companyName: e.target.value} : null)}
                    placeholder="Company"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={editedContact.email}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, email: e.target.value} : null)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    type="tel"
                    value={editedContact.phone}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, phone: e.target.value} : null)}
                    placeholder="+1 555-123-4567"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Website</Label>
                  <Input
                    value={editedContact.website}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, website: e.target.value} : null)}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">LinkedIn</Label>
                  <Input
                    value={editedContact.linkedinUrl}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, linkedinUrl: e.target.value} : null)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={editedContact.address}
                    onChange={(e) => setEditedContact(prev => prev ? {...prev, address: e.target.value} : null)}
                    placeholder="Address"
                  />
                </div>
              </div>
            )}
          </ScrollArea>
          <DrawerFooter>
            <Button onClick={handleSaveEdit}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Card className="glass">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1 -ml-2"
              disabled={isProcessing || isSaving}
              data-testid="button-back-to-capture"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Badge variant="secondary" className="text-xs">
              {eventName}
            </Badge>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing cards...
                </span>
                <span className="text-muted-foreground">
                  {completedItems.length + failedItems.length}/{items.length}
                </span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {!isProcessing && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    {completedItems.length}
                  </span>
                  {failedItems.length > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-4 h-4" />
                      {failedItems.length}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApproveAll}
                  data-testid="button-approve-all"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve All
                </Button>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {completedItems.map((item) => {
                    const contact = item.result?.contact;
                    const isApproved = approvedIds.has(item.id);
                    const isRejected = rejectedIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          isApproved ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
                          isRejected ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
                          'bg-card'
                        }`}
                        data-testid={`review-item-${item.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={item.thumbnail}
                            alt="Card"
                            className="w-12 h-16 rounded object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {contact?.fullName || 'Unknown'}
                            </p>
                            {contact?.companyName && (
                              <p className="text-sm text-muted-foreground truncate">
                                {contact.companyName}
                              </p>
                            )}
                            {contact?.email && (
                              <p className="text-xs text-muted-foreground truncate">
                                {contact.email}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(item)}
                              className="h-8 w-8"
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={isApproved ? "default" : "ghost"}
                              size="icon"
                              onClick={() => handleApprove(item.id)}
                              className={`h-8 w-8 ${isApproved ? 'bg-green-600 hover:bg-green-700' : ''}`}
                              data-testid={`button-approve-${item.id}`}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={isRejected ? "destructive" : "ghost"}
                              size="icon"
                              onClick={() => handleReject(item.id)}
                              className="h-8 w-8"
                              data-testid={`button-reject-${item.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {failedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                      data-testid={`review-failed-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={item.thumbnail}
                          alt="Card"
                          className="w-12 h-16 rounded object-cover shrink-0 opacity-50"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Processing failed
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.error || 'Unknown error'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                onClick={handleSaveAll}
                disabled={approvedIds.size === 0 || isSaving}
                className="w-full"
                size="lg"
                data-testid="button-save-approved"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save {approvedIds.size} Contact{approvedIds.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
