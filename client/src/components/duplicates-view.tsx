/**
 * Duplicates View
 * Shows potential duplicate contacts for merging
 */

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Merge,
  Mail,
  Phone,
  Building,
  User,
  Undo2,
  AlertTriangle,
  Check,
  ArrowRight,
} from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import {
  loadContactsV2,
  saveContactsV2,
  getContactById,
  addTimelineEvent,
  addMergeHistoryEntry,
  loadMergeHistory,
  undoLastMerge,
  ContactV2,
} from "@/lib/contacts/storage";
import {
  findDuplicateGroups,
  mergeContacts,
  DuplicateGroup,
  pickBestValue,
} from "@/lib/contacts/dedupe";
import { generateId } from "@/lib/contacts/ids";

interface DuplicatesViewProps {
  onRefresh: () => void;
}

interface MergeField {
  key: keyof ContactV2;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MERGE_FIELDS: MergeField[] = [
  { key: 'name', label: 'Name', icon: User },
  { key: 'title', label: 'Title', icon: User },
  { key: 'company', label: 'Company', icon: Building },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'linkedinUrl', label: 'LinkedIn', icon: SiLinkedin as React.ComponentType<{ className?: string }> },
];

export function DuplicatesView({ onRefresh }: DuplicatesViewProps) {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<ContactV2[]>([]);
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'left' | 'right'>>({});
  const [showConfirmMerge, setShowConfirmMerge] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const contacts = useMemo(() => loadContactsV2(), [refreshKey]);
  const duplicateGroups = useMemo(() => findDuplicateGroups(contacts, 60), [contacts]);
  const mergeHistory = useMemo(() => loadMergeHistory(), [refreshKey]);

  const handleSelectGroup = useCallback((group: DuplicateGroup) => {
    const groupContacts = group.contactIds
      .map(id => contacts.find(c => c.id === id))
      .filter(Boolean) as ContactV2[];
    
    if (groupContacts.length < 2) return;

    setSelectedContacts(groupContacts.slice(0, 2)); // Only handle 2 at a time
    setSelectedGroup(group);

    // Auto-pick best values
    const choices: Record<string, 'left' | 'right'> = {};
    MERGE_FIELDS.forEach(field => {
      const leftVal = groupContacts[0][field.key];
      const rightVal = groupContacts[1][field.key];
      const best = pickBestValue(leftVal as string, rightVal as string);
      choices[field.key] = best === leftVal ? 'left' : 'right';
    });
    setFieldChoices(choices);
  }, [contacts]);

  const handleMerge = useCallback(() => {
    if (selectedContacts.length < 2) return;

    const [left, right] = selectedContacts;
    
    // Build merged contact based on field choices
    const merged: ContactV2 = { ...left };
    MERGE_FIELDS.forEach(field => {
      const choice = fieldChoices[field.key] || 'left';
      (merged as unknown as Record<string, unknown>)[field.key] = choice === 'left' 
        ? left[field.key] 
        : right[field.key];
    });

    // Merge arrays
    const fullMerged = mergeContacts(merged, right);

    // Add merge timeline event
    addTimelineEvent(
      fullMerged.id,
      'contact_merged',
      `Merged with ${right.name}`,
      { mergedFromId: right.id }
    );

    // Save merge history for undo
    addMergeHistoryEntry({
      id: generateId(),
      mergedAt: new Date().toISOString(),
      primaryContactId: fullMerged.id,
      mergedContactSnapshots: [
        { id: left.id, data: left as unknown as Record<string, unknown> },
        { id: right.id, data: right as unknown as Record<string, unknown> },
      ],
    });

    // Update contacts list
    const updatedContacts = contacts
      .filter(c => c.id !== left.id && c.id !== right.id)
      .concat(fullMerged);
    
    saveContactsV2(updatedContacts);

    // Reset state
    setSelectedGroup(null);
    setSelectedContacts([]);
    setFieldChoices({});
    setShowConfirmMerge(false);
    setRefreshKey(k => k + 1);
    onRefresh();

    toast({ title: "Contacts merged successfully" });
  }, [selectedContacts, fieldChoices, contacts, onRefresh, toast]);

  const handleUndoLastMerge = useCallback(() => {
    const success = undoLastMerge();
    if (success) {
      setRefreshKey(k => k + 1);
      onRefresh();
      toast({ title: "Merge undone" });
    } else {
      toast({ title: "Nothing to undo", variant: "destructive" });
    }
  }, [onRefresh, toast]);

  if (duplicateGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No duplicates found</p>
        <p className="text-sm text-muted-foreground/70 mt-1 text-center px-8">
          Your contacts are clean! We'll alert you when potential duplicates appear.
        </p>
        {mergeHistory.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleUndoLastMerge}
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Undo Last Merge
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Undo button */}
          {mergeHistory.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndoLastMerge}
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Undo Last Merge
              </Button>
            </div>
          )}

          {/* Duplicate groups */}
          {duplicateGroups.map((group, idx) => {
            const groupContacts = group.contactIds
              .map(id => contacts.find(c => c.id === id))
              .filter(Boolean) as ContactV2[];

            return (
              <Card
                key={idx}
                className="cursor-pointer hover-elevate transition-all"
                onClick={() => handleSelectGroup(group)}
                data-testid={`duplicate-group-${idx}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={group.score >= 90 ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {group.score}% match
                        </Badge>
                        {group.reasons[0] && (
                          <span className="text-xs text-muted-foreground">
                            {group.reasons[0].description}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {groupContacts.slice(0, 2).map(contact => (
                          <div key={contact.id} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                              {contact.name?.charAt(0) || '?'}
                            </div>
                            <span className="text-sm font-medium truncate">
                              {contact.name}
                            </span>
                            {contact.company && (
                              <span className="text-xs text-muted-foreground truncate">
                                • {contact.company}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Merge className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Merge Drawer */}
      <Drawer open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Merge Contacts</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="px-4 max-h-[60vh]">
            {selectedContacts.length === 2 && (
              <div className="space-y-4 pb-4">
                {/* Contact headers */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedContacts.map((contact, idx) => (
                    <div key={contact.id} className="text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg mx-auto mb-2">
                        {contact.name?.charAt(0) || '?'}
                      </div>
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.company || 'No company'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Field selection */}
                <div className="space-y-3">
                  {MERGE_FIELDS.map(field => {
                    const leftVal = selectedContacts[0][field.key] as string || '';
                    const rightVal = selectedContacts[1][field.key] as string || '';
                    
                    if (!leftVal && !rightVal) return null;

                    const Icon = field.icon;
                    const choice = fieldChoices[field.key] || 'left';

                    return (
                      <div key={field.key} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{field.label}</span>
                        </div>
                        <RadioGroup
                          value={choice}
                          onValueChange={(v) => setFieldChoices(prev => ({ ...prev, [field.key]: v as 'left' | 'right' }))}
                          className="grid grid-cols-2 gap-2"
                        >
                          <Label
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                              choice === 'left' ? 'border-primary bg-primary/5' : 'border-muted'
                            }`}
                          >
                            <RadioGroupItem value="left" className="sr-only" />
                            <span className="text-sm truncate">{leftVal || '—'}</span>
                            {choice === 'left' && <Check className="w-4 h-4 text-primary ml-auto" />}
                          </Label>
                          <Label
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                              choice === 'right' ? 'border-primary bg-primary/5' : 'border-muted'
                            }`}
                          >
                            <RadioGroupItem value="right" className="sr-only" />
                            <span className="text-sm truncate">{rightVal || '—'}</span>
                            {choice === 'right' && <Check className="w-4 h-4 text-primary ml-auto" />}
                          </Label>
                        </RadioGroup>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        This will merge both contacts
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Tasks, reminders, and timeline events will be combined. You can undo this action.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <DrawerFooter>
            <Button onClick={() => setShowConfirmMerge(true)}>
              <Merge className="w-4 h-4 mr-2" />
              Merge Contacts
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmMerge} onOpenChange={setShowConfirmMerge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Merge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to merge these contacts? This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
