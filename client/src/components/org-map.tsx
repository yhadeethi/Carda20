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
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, GitBranch, Maximize2, X, ExternalLink } from "lucide-react";
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

  // Extract company info from contacts for logo display
  const companyInfo = useMemo(() => {
    if (contacts.length === 0) return { name: "", domain: "", website: "" };

    // Get the most common company name
    const companyCounts: Record<string, number> = {};
    contacts.forEach(c => {
      if (c.company) companyCounts[c.company] = (companyCounts[c.company] || 0) + 1;
    });

    let mostCommonCompany = "";
    let maxCount = 0;
    for (const [company, count] of Object.entries(companyCounts)) {
      if (count > maxCount) {
        mostCommonCompany = company;
        maxCount = count;
      }
    }

    // Find a contact with that company to get website/email
    const companyContact = contacts.find(c => c.company === mostCommonCompany) || contacts[0];

    return {
      name: mostCommonCompany || companyContact?.company || "",
      domain: "",
      website: companyContact?.website || "",
    };
  }, [contacts]);

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
        <DrawerContent className="max-h-[85vh]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <DrawerHeader className="pb-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/70 to-primary flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0 shadow-lg shadow-primary/20">
                {selectedContact?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-xl font-bold truncate">{selectedContact?.name || "Contact"}</DrawerTitle>
                {selectedContact?.title && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{selectedContact.title}</p>
                )}
              </div>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</Label>
              <Select
                value={selectedContact?.org?.department || "UNKNOWN"}
                onValueChange={(v) => handleUpdateOrg({ department: v as Department })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select department" />
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
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reports To</Label>
              <Select
                value={selectedContact?.org?.reportsToId || "none"}
                onValueChange={(v) => handleUpdateOrg({ reportsToId: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {managerOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email || "Unknown"}
                      {m.title ? ` · ${m.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DrawerFooter className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                if (selectedContact) {
                  onSelectContact(selectedContact);
                  setShowQuickEdit(false);
                }
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Open Contact
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">
                Done
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
          <div className="flex flex-col h-full" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            {/* Modal Header - Compact */}
            <div className="flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-xl">
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="text-sm font-semibold truncate">Org Chart</DialogTitle>
                {focusMode && focusId && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {effectiveFocusContact?.name || "contact"}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant={focusMode ? "default" : "outline"}
                  size="sm"
                  className="rounded-full h-7 px-3 text-xs"
                  onClick={() => setFocusMode((v) => !v)}
                  data-testid="button-diagram-focus"
                >
                  Focus
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-7 px-3 text-xs"
                  onClick={handleFitView}
                  data-testid="button-diagram-fit"
                >
                  Fit
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-7 w-7"
                  onClick={() => setShowDiagram(false)}
                  data-testid="button-close-diagram"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

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
                  companyName={companyInfo.name}
                  companyDomain={companyInfo.domain}
                  companyWebsite={companyInfo.website}
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
