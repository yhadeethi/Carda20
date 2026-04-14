/**
 * Org Map Component v5 - Design System Refresh
 *
 * Changes vs v4:
 * - Redesigned modal header: company pill, glassmorphic control pills
 * - Focus badge (inline pill) replaces plain text
 * - Sparse state: ghost nodes + CTA when contacts.length < 3
 * - Sparse CTA "Add Contact" fires onAddContact(companyName) prop
 * - Canvas background delegated to OrgChartCanvas v5 (dot-grid)
 * - Department legend in canvas (3+ depts only)
 *
 * Preserved from v4 (zero logic changes):
 * - wouldCreateCycle
 * - handleSetManager
 * - handleUpdateOrg
 * - handleNodeClick / handleFocusContact / handleOpenContactFromDiagram
 * - Quick Edit Drawer (department + reportsTo selects)
 * - focusMode / focusId logic
 * - showInteractionHint / handleDismissHint
 * - All props on OrgMapProps (+ new optional onAddContact)
 * - updateContactV2 write path
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
import { Info, Users, GitBranch, Maximize2, X, ExternalLink, Plus } from "lucide-react";
import { StoredContact, Department, DEFAULT_ORG } from "@/lib/contactsStorage";
import { updateContactV2 } from "@/lib/contacts/storage";
import { useToast } from "@/hooks/use-toast";
import { OrgChartCanvas } from "@/components/org-chart-canvas";
import { HierarchyList } from "@/components/hierarchy-list";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgMapProps {
  companyId: string;
  contacts: StoredContact[];
  onContactUpdate: () => void;
  onSelectContact: (contact: StoredContact) => void;
  /** Called when user taps "Add Contact" in the sparse state CTA.
   *  Receives the company name so the scan flow can pre-fill it. */
  onAddContact?: (companyName: string) => void;
  /** Company name — used in the header pill and sparse CTA */
  companyName?: string;
}

// ─── Sparse state ghost nodes ─────────────────────────────────────────────────

function GhostNode({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="absolute flex items-center gap-2.5 p-3"
      style={{
        width: 160,
        border: "1.5px dashed rgba(0,0,0,0.1)",
        borderRadius: 16,
        opacity: 0.45,
        pointerEvents: "none",
        ...style,
      }}
    >
      <div
        className="shrink-0 rounded-xl"
        style={{ width: 36, height: 36, background: "rgba(0,0,0,0.06)" }}
      />
      <div className="flex-1">
        <div
          className="rounded"
          style={{ height: 7, background: "rgba(0,0,0,0.07)", marginBottom: 5 }}
        />
        <div
          className="rounded"
          style={{ height: 7, width: "55%", background: "rgba(0,0,0,0.07)" }}
        />
      </div>
    </div>
  );
}

// ─── Department legend ────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: "Leadership", color: "#5856D6" },
  { label: "Revenue",    color: "#FF3B30" },
  { label: "Operations", color: "#34C759" },
  { label: "Other",      color: "#8E8E93" },
];

function DeptLegend() {
  return (
    <div
      className="absolute top-3 right-3 flex flex-col gap-1.5 z-10"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "0.5px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: "8px 10px",
      }}
    >
      {LEGEND_ITEMS.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="rounded-full shrink-0" style={{ width: 7, height: 7, background: color }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: "#6C6C70" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── OrgMap ───────────────────────────────────────────────────────────────────

export function OrgMap({
  companyId,
  contacts,
  onContactUpdate,
  onSelectContact,
  onAddContact,
  companyName,
}: OrgMapProps) {
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
    () =>
      contacts.find((c) => !c.org?.reportsToId || !contactIds.has(c.org.reportsToId)) ||
      contacts[0],
    [contacts, contactIds]
  );

  const effectiveFocusContact = focusMode ? selectedContact || rootContact || null : null;
  const focusId = effectiveFocusContact?.id || null;

  const isSparse = contacts.length < 3;

  // ── Interaction hint ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!showDiagram) return;
    try {
      const seen = window.localStorage.getItem("carda_org_diagram_hint_v1");
      if (!seen) setShowInteractionHint(true);
    } catch {
      setShowInteractionHint(true);
    }
  }, [showDiagram]);

  useEffect(() => {
    if (!showDiagram || !focusMode || selectedContact || !rootContact) return;
    setSelectedContact(rootContact);
  }, [showDiagram, focusMode, selectedContact, rootContact]);

  // ── Cycle guard ───────────────────────────────────────────────────────────

  const wouldCreateCycle = useCallback(
    (sourceId: string, managerId: string): boolean => {
      const visited = new Set<string>();
      const check = (currentId: string): boolean => {
        if (currentId === sourceId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        const contact = contacts.find((c) => c.id === currentId);
        if (contact?.org?.reportsToId) return check(contact.org.reportsToId);
        return false;
      };
      return check(managerId);
    },
    [contacts]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const managerOptions = useMemo(() => {
    if (!selectedContact) return [] as StoredContact[];
    return contacts.filter((c) => c.id !== selectedContact.id);
  }, [contacts, selectedContact]);

  const handleUpdateOrg = useCallback(
    (patch: Partial<NonNullable<StoredContact["org"]>>) => {
      if (!selectedContact) return;
      const currentOrg = selectedContact.org || { ...DEFAULT_ORG };
      updateContactV2(selectedContact.id, { org: { ...currentOrg, ...patch } });
      onContactUpdate();
      const refreshed = contacts.find((c) => c.id === selectedContact.id);
      if (refreshed) setSelectedContact(refreshed);
    },
    [selectedContact, contacts, onContactUpdate]
  );

  const handleFitView = useCallback(() => canvasRef.current?.fitView(), []);

  const handleDismissHint = useCallback(() => {
    try {
      window.localStorage.setItem("carda_org_diagram_hint_v1", "seen");
    } catch {}
    setShowInteractionHint(false);
  }, []);

  // ── Empty state ───────────────────────────────────────────────────────────

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
  const displayName = companyName || "this company";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── List view header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{contacts.length} {contacts.length === 1 ? "person" : "people"}</span>
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

      {/* ── Hierarchy List ── */}
      <div className="flex-1 min-h-0 rounded-xl bg-card border overflow-hidden">
        <div className="h-full overflow-y-auto p-2">
          <HierarchyList
            contacts={contacts}
            onContactUpdate={onContactUpdate}
            onSelectContact={onSelectContact}
          />
        </div>
      </div>

      {/* ── Quick Edit Drawer ── */}
      <Drawer open={showQuickEdit} onOpenChange={setShowQuickEdit}>
        <DrawerContent className="max-h-[85vh]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <DrawerHeader className="pb-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/70 to-primary flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0 shadow-lg shadow-primary/20">
                {selectedContact?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-xl font-bold truncate">
                  {selectedContact?.name || "Contact"}
                </DrawerTitle>
                {selectedContact?.title && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {selectedContact.title}
                  </p>
                )}
              </div>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Department
              </Label>
              <Select
                value={selectedContact?.org?.department || "UNKNOWN"}
                onValueChange={(v) => handleUpdateOrg({ department: v as Department })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["EXEC", "LEGAL", "PROJECT_DELIVERY", "SALES", "FINANCE", "OPS", "UNKNOWN"] as Department[]
                  ).map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Reports To
              </Label>
              <Select
                value={selectedContact?.org?.reportsToId || "none"}
                onValueChange={(v) =>
                  handleUpdateOrg({ reportsToId: v === "none" ? null : v })
                }
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

      {/* ── Diagram Modal ── */}
      <Dialog open={showDiagram} onOpenChange={setShowDiagram}>
        <DialogContent
          className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 rounded-none sm:rounded-none"
          hideClose
        >
          <div className="flex flex-col h-full">

            {/* ── Modal header ── */}
            <div
              className="flex flex-col gap-2 border-b px-4 py-3"
              style={{
                background: "rgba(242,242,247,0.94)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              }}
            >
              {/* Row 1: title + close */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-[17px] font-semibold text-[#1C1C1E]">
                    Organization Chart
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-[#6C6C70] mt-0.5">
                    Tap anyone to edit reporting lines and relationships
                  </DialogDescription>

                  {/* Focus badge */}
                  {focusMode && focusId && effectiveFocusContact && (
                    <div
                      className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(0,122,255,0.1)",
                        border: "0.5px solid rgba(0,122,255,0.2)",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#007AFF",
                      }}
                    >
                      ⊕ Focused on {effectiveFocusContact.name || "contact"}
                    </div>
                  )}
                </div>

                {/* Close — mobile */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full sm:hidden shadow-sm"
                  onClick={() => setShowDiagram(false)}
                  data-testid="button-close-diagram-mobile"
                  aria-label="Close diagram"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Row 2: company pill + controls */}
              <div className="flex items-center justify-between gap-2">
                {/* Company pill */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.72)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "0.5px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-md text-white shrink-0"
                    style={{
                      width: 20,
                      height: 20,
                      background: "linear-gradient(135deg, #007AFF, #5856D6)",
                      fontSize: 8,
                      fontWeight: 700,
                    }}
                  >
                    {(companyName ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1C1C1E" }}>
                    {displayName}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5"
                    style={{
                      fontSize: 11,
                      color: "#AEAEB2",
                      background: "rgba(118,118,128,0.12)",
                    }}
                  >
                    {contacts.length}
                  </span>
                </div>

                {/* Control pills */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: focusMode ? "#007AFF" : "rgba(255,255,255,0.72)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: focusMode ? "none" : "0.5px solid rgba(0,0,0,0.08)",
                      color: focusMode ? "white" : "#1C1C1E",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                    onClick={() => setFocusMode((v) => !v)}
                    data-testid="button-diagram-focus"
                  >
                    ⊕ Focus
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: "rgba(255,255,255,0.72)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "0.5px solid rgba(0,0,0,0.08)",
                      color: "#1C1C1E",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                    onClick={handleFitView}
                    data-testid="button-diagram-fit"
                  >
                    ⛶ Fit View
                  </button>
                  {/* Close — desktop */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden sm:inline-flex rounded-full h-9 w-9 shadow-sm"
                    onClick={() => setShowDiagram(false)}
                    data-testid="button-close-diagram-desktop"
                    aria-label="Close diagram"
                  >
                    <X className="w-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Interaction hint ── */}
            {showInteractionHint && (
              <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 backdrop-blur-sm px-4 py-3 text-sm text-foreground shadow-sm">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm">
                    Tap any person to edit their department and reporting relationships. Use pinch to zoom.
                  </span>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                  onClick={handleDismissHint}
                >
                  Got it
                </button>
              </div>
            )}

            {/* ── Canvas area ── */}
            <div className="flex-1 min-h-0 relative">

              {/* Sparse state: ghost nodes + CTA */}
              {isSparse && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
                  style={{
                    background: "#F5F5FA",
                    backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                >
                  {/* Ghost placeholders */}
                  <div className="relative" style={{ width: 340, height: 280 }}>
                    {/* Real node sits above — rendered by canvas below */}
                    {/* Ghost children */}
                    <GhostNode style={{ left: 20,  top: 160 }} />
                    <GhostNode style={{ left: 190, top: 160 }} />
                    {/* Ghost edge lines */}
                    <svg
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                    >
                      <path
                        d="M 170 100 C 170 130 97 150 97 160"
                        stroke="rgba(0,0,0,0.06)"
                        strokeWidth="1.5"
                        fill="none"
                        strokeDasharray="4 3"
                      />
                      <path
                        d="M 170 100 C 170 130 267 150 267 160"
                        stroke="rgba(0,0,0,0.06)"
                        strokeWidth="1.5"
                        fill="none"
                        strokeDasharray="4 3"
                      />
                    </svg>
                  </div>

                  {/* CTA card */}
                  <div
                    className="pointer-events-auto text-center"
                    style={{
                      background: "rgba(255,255,255,0.9)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      border: "0.5px solid rgba(255,255,255,0.95)",
                      borderRadius: 22,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)",
                      padding: "16px 20px",
                      width: 280,
                      marginTop: -40,
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>🏢</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 3 }}>
                      Build {displayName}'s org chart
                    </p>
                    <p style={{ fontSize: 12, color: "#6C6C70", lineHeight: 1.5, marginBottom: 12 }}>
                      Scan or add more contacts from {displayName} to map their reporting structure over time.
                    </p>
                    <Button
                      variant="gradient"
                      className="w-full rounded-xl"
                      onClick={() => {
                        setShowDiagram(false);
                        onAddContact?.(companyName ?? "");
                      }}
                    >
                      + Add Contact from {displayName}
                    </Button>
                  </div>
                </div>
              )}

              {/* ReactFlow canvas — always rendered (sparse contacts still show) */}
              {(hasReportingLines || contacts.length > 0) ? (
                <>
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
                  {/* Department legend — only show when chart is populated */}
                  {!isSparse && <DeptLegend />}
                </>
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
