/**
 * Org Map Component v4 - Modern, Clean Design
 * Features:
 * - Hierarchy-first view (collapsible tree list)
 * - Optional diagram view via modal
 * - Tap-to-edit interactions (no drag-to-connect)
 * - Minimal, clean interface with modern card design
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
          className="gap-1 h-8 text-xs px-3 rounded-full"
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

      {/* Quick Edit - Modern Bottom Sheet */}
      <Drawer open={showQuickEdit} onOpenChange={setShowQuickEdit}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b bg-card">
            <DrawerTitle className="text-base font-semibold">{selectedContact?.name || "Edit Relationship"}</DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-5 bg-background">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Department</Label>
                <Select
                  value={selectedContact?.org?.department || "UNKNOWN"}
                  onValueChange={(v) => handleUpdateOrg({ department: v as Department })}
                >
                  <SelectTrigger className="h-11 rounded-lg transition-all duration-200 hover:border-primary/50">
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
                <Label className="text-xs font-medium text-muted-foreground">Reports to</Label>
                <Select
                  value={selectedContact?.org?.reportsToId || "none"}
                  onValueChange={(v) => handleUpdateOrg({ reportsToId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-11 rounded-lg transition-all duration-200 hover:border-primary/50">
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
                className="flex-1 rounded-full transition-all duration-200"
                onClick={() => selectedContact && onSelectContact(selectedContact)}
                disabled={!selectedContact}
              >
                Open Relationship
              </Button>
              <DrawerClose asChild>
                <Button className="flex-1 rounded-full shadow-sm transition-all duration-200">Done</Button>
              </DrawerClose>
            </div>
          </div>

          <DrawerFooter className="border-t bg-card">
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full rounded-full transition-all duration-200">
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
            <div className="flex flex-col gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base font-semibold sm:text-lg">Organization Chart</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                    Tap anyone to edit reporting lines and relationships
                  </DialogDescription>
                  {focusMode && focusId && (
                    <div className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                      Focused on{" "}
                      <span className="font-medium text-foreground">
                        {effectiveFocusContact?.name || "contact"}
                      </span>
                    </div>
                  )}
                </div>
                {/* Mobile-only close button - prominent and always visible */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full sm:hidden shadow-sm transition-all duration-200 hover:shadow-md hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowDiagram(false)}
                  data-testid="button-close-diagram-mobile"
                  aria-label="Close diagram"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Button
                  variant={focusMode ? "default" : "outline"}
                  size="sm"
                  className="rounded-full min-h-9 px-4 shadow-sm transition-all duration-200 hover:shadow-md"
                  onClick={() => setFocusMode((v) => !v)}
                  data-testid="button-diagram-focus"
                >
                  Focus
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-9 w-9 shadow-sm transition-all duration-200 hover:shadow-md hover:bg-accent"
                  onClick={handleZoomOut}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-9 w-9 shadow-sm transition-all duration-200 hover:shadow-md hover:bg-accent"
                  onClick={handleZoomIn}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full min-h-9 px-4 shadow-sm transition-all duration-200 hover:shadow-md"
                  onClick={handleFitView}
                  data-testid="button-diagram-fit"
                >
                  Fit View
                </Button>
                {/* Desktop-only close button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden sm:inline-flex rounded-full h-9 w-9 shadow-sm transition-all duration-200 hover:shadow-md hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowDiagram(false)}
                  data-testid="button-close-diagram-desktop"
                  aria-label="Close diagram"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            {showInteractionHint && (
              <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 backdrop-blur-sm px-4 py-3 text-sm text-foreground shadow-sm">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm">
                    Tap any person to edit their department and reporting relationships. Use the action buttons on the right to focus or view details.
                  </span>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline shrink-0 transition-opacity hover:opacity-80"
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
