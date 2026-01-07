/**
 * Org Map Component v3 - iOS 26 Style
 * Features:
 * - Hierarchy-first view (collapsible tree list)
 * - Optional diagram view via modal
 * - Minimal, clean interface
 *
 * IMPORTANT:
 * This version writes org changes via V2 storage (updateContactV2),
 * which also mirrors to V1 (compat) so the rest of the UI stays consistent.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Info, Users, GitBranch, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { StoredContact, Department, DEFAULT_ORG } from "@/lib/contactsStorage";
import { updateContactV2 } from "@/lib/contacts/storage";
import { useToast } from "@/hooks/use-toast";
import { OrgChartCanvas } from "@/components/org-chart-canvas";
import { HierarchyList } from "@/components/hierarchy-list";

interface OrgMapProps {
  companyId: string;
  contacts: StoredContact[];
  onContactUpdate: () => void;
  onSelectContact: (contact: StoredContact) => void;
}

export function OrgMap({ companyId, contacts, onContactUpdate, onSelectContact }: OrgMapProps) {
  const [showDiagram, setShowDiagram] = useState(false);
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const [showInteractionHint, setShowInteractionHint] = useState(false);
  const [relayoutKey] = useState(0);
  const canvasRef = useRef<{ fitView: () => void; zoomIn: () => void; zoomOut: () => void } | null>(null);
  const { toast } = useToast();
  const contactIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);
  const rootContact = useMemo(
    () => contacts.find((c) => !c.org?.reportsToId || !contactIds.has(c.org.reportsToId)) || contacts[0],
    [contacts, contactIds]
  );

  const effectiveFocusContact = focusMode ? selectedContact || rootContact || null : null;
  const focusId = effectiveFocusContact?.id || null;

  useEffect(() => {
    if (!showDiagram) return;
    try {
      const hasSeenHint = window.localStorage.getItem("carda_org_diagram_hint_v1");
      if (!hasSeenHint) setShowInteractionHint(true);
    } catch {
      setShowInteractionHint(true);
    }
  }, [showDiagram]);

  useEffect(() => {
    if (!showDiagram || !focusMode || selectedContact || !rootContact) return;
    setSelectedContact(rootContact);
  }, [showDiagram, focusMode, selectedContact, rootContact]);

  // Check if setting managerId as sourceId's manager would create a cycle
  const wouldCreateCycle = useCallback(
    (sourceId: string, managerId: string): boolean => {
      const visited = new Set<string>();
      const check = (currentId: string): boolean => {
        if (currentId === sourceId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);

        const contact = contacts.find((c) => c.id === currentId);
        if (contact?.org?.reportsToId) {
          return check(contact.org.reportsToId);
        }
        return false;
      };
      return check(managerId);
    },
    [contacts]
  );

  // Handle setting manager from drag-drop connection in diagram
  const handleSetManager = useCallback(
    (sourceId: string, managerId: string) => {
      if (sourceId === managerId) return;

      if (wouldCreateCycle(sourceId, managerId)) {
        toast({
          title: "Cannot create reporting loop",
          description: "This would create a circular reporting structure.",
          variant: "destructive",
        });
        return;
      }

      const contact = contacts.find((c) => c.id === sourceId);
      if (contact) {
        const currentOrg = contact.org || { ...DEFAULT_ORG };
        updateContactV2(sourceId, { org: { ...currentOrg, reportsToId: managerId } });
        onContactUpdate();

        const manager = contacts.find((c) => c.id === managerId);
        toast({
          title: "Reporting line set",
          description: `${contact.name} now reports to ${manager?.name || "Unknown"}`,
        });
      }
    },
    [contacts, wouldCreateCycle, onContactUpdate, toast]
  );

  const handleNodeClick = useCallback((contact: StoredContact) => {
    setSelectedContact(contact);
    setShowQuickEdit(true);
  }, []);

  const handleFocusContact = useCallback((contact: StoredContact) => {
    setSelectedContact(contact);
    setFocusMode(true);
  }, []);

  const handleOpenContactFromDiagram = useCallback(
    (contact: StoredContact) => {
      setShowDiagram(false);
      onSelectContact(contact);
    },
    [onSelectContact]
  );

  const companyContacts = useMemo(() => contacts, [contacts]);

  const managerOptions = useMemo(() => {
    if (!selectedContact) return [] as StoredContact[];
    return companyContacts.filter((c) => c.id !== selectedContact.id);
  }, [companyContacts, selectedContact]);

  const handleUpdateOrg = useCallback(
    (patch: Partial<NonNullable<StoredContact["org"]>>) => {
      if (!selectedContact) return;
      const currentOrg = selectedContact.org || { ...DEFAULT_ORG };

      updateContactV2(selectedContact.id, { org: { ...currentOrg, ...patch } });
      onContactUpdate();

      // Refresh local selected contact from latest props
      const refreshed = contacts.find((c) => c.id === selectedContact.id);
      if (refreshed) setSelectedContact(refreshed);
    },
    [selectedContact, contacts, onContactUpdate]
  );

  const handleFitView = useCallback(() => {
    canvasRef.current?.fitView();
  }, []);

  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomOut();
  }, []);

  const handleDismissHint = useCallback(() => {
    try {
      window.localStorage.setItem("carda_org_diagram_hint_v1", "seen");
    } catch {}
    setShowInteractionHint(false);
  }, []);

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <Users className="w-12 h-12 mb-3 opacity-50" />
        <p className="font-medium">No people yet</p>
        <p className="text-sm mt-1">Add contacts for this company first</p>
      </div>
    );
  }

  const hasReportingLines = contacts.some((c) => c.org?.reportsToId);

  return (
    <div className="flex flex-col h-full">
      {/* Minimal header with View Diagram button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{contacts.length} people</span>
          {hasReportingLines && (
            <>
              <span>·</span>
              <span>{contacts.filter((c) => c.org?.reportsToId).length} lines</span>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-8 text-xs px-3"
          onClick={() => setShowDiagram(true)}
          data-testid="button-view-diagram"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Diagram
        </Button>
      </div>

      {/* Hierarchy List - Main View */}
      <div className="flex-1 min-h-0 rounded-xl bg-card border overflow-hidden">
        <div className="h-full overflow-y-auto p-2">
          <HierarchyList contacts={contacts} onContactUpdate={onContactUpdate} onSelectContact={onSelectContact} />
        </div>
      </div>

      {/* Quick Edit - Bottom Sheet (diagram + list) */}
      <Drawer open={showQuickEdit} onOpenChange={setShowQuickEdit}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="text-base font-semibold">{selectedContact?.name || "Edit relationship"}</DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Department</Label>
                <Select
                  value={selectedContact?.org?.department || "UNKNOWN"}
                  onValueChange={(v) => handleUpdateOrg({ department: v as Department })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["EXEC", "LEGAL", "PROJECT_DELIVERY", "SALES", "FINANCE", "OPS", "UNKNOWN"] as Department[]).map(
                      (d) => (
                        <SelectItem key={d} value={d}>
                          {d.replace("_", " ")}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Reports to</Label>
                <Select
                  value={selectedContact?.org?.reportsToId || "none"}
                  onValueChange={(v) => handleUpdateOrg({ reportsToId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => selectedContact && onSelectContact(selectedContact)}
                disabled={!selectedContact}
              >
                Open Relationship
              </Button>
              <DrawerClose asChild>
                <Button className="flex-1">Done</Button>
              </DrawerClose>
            </div>
          </div>

          <DrawerFooter className="border-t">
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Diagram Modal - Full Screen Sheet */}
      <Dialog open={showDiagram} onOpenChange={setShowDiagram}>
        <DialogContent
          className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 rounded-none sm:rounded-none"
          hideClose
        >
          <div className="flex flex-col h-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
              <div>
                <DialogTitle className="text-lg font-semibold">Org Diagram</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Drag to connect reporting lines
                </DialogDescription>
                {focusMode && focusId && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Focused on <span className="font-medium text-foreground">{effectiveFocusContact?.name || "contact"}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={focusMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFocusMode((v) => !v)}
                  data-testid="button-diagram-focus"
                >
                  Focus
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleFitView} data-testid="button-diagram-fit">
                  Fit View
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDiagram(false)}
                  data-testid="button-close-diagram"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            {showInteractionHint && (
              <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Tip: Drag from a node handle to another node to set a reporting line.</span>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={handleDismissHint}
                >
                  Got it
                </button>
              </div>
            )}

            {/* Diagram Canvas */}
            <div className="flex-1 min-h-0 bg-gradient-to-br from-slate-50 to-white dark:from-gray-900 dark:to-gray-950">
              {hasReportingLines || contacts.length > 0 ? (
                <OrgChartCanvas
                  key={relayoutKey}
                  ref={canvasRef}
                  contacts={contacts}
                  onNodeClick={handleNodeClick}
                  onOpenContact={handleOpenContactFromDiagram}
                  onFocusContact={handleFocusContact}
                  onSetManager={handleSetManager}
                  editMode={true}
                  focusId={focusId}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <GitBranch className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">No reporting lines yet</p>
                  <p className="text-sm mt-1">Tap a person in the list to set "Reports to"</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
