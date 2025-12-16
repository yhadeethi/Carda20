/**
 * Org Map Component v3 - iOS 26 Style
 * Features:
 * - Hierarchy-first view (collapsible tree list)
 * - Optional diagram view via modal
 * - No more Influence feature
 * - Minimal, clean interface
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  GitBranch,
  Maximize2,
  X,
} from "lucide-react";
import {
  StoredContact,
  updateContact,
  Department,
  DEFAULT_ORG,
  clearAllReportingLines,
  restoreReportingLines,
} from "@/lib/contactsStorage";
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
  const [relayoutKey, setRelayoutKey] = useState(0);
  const canvasRef = useRef<{ fitView: () => void; zoomIn: () => void; zoomOut: () => void } | null>(null);
  const { toast } = useToast();

  // Check if setting managerId as sourceId's manager would create a cycle
  const wouldCreateCycle = useCallback((sourceId: string, managerId: string): boolean => {
    const visited = new Set<string>();
    const check = (currentId: string): boolean => {
      if (currentId === sourceId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      
      const contact = contacts.find(c => c.id === currentId);
      if (contact?.org?.reportsToId) {
        return check(contact.org.reportsToId);
      }
      return false;
    };
    return check(managerId);
  }, [contacts]);

  // Handle setting manager from drag-drop connection in diagram
  const handleSetManager = useCallback((sourceId: string, managerId: string) => {
    if (sourceId === managerId) return;
    
    if (wouldCreateCycle(sourceId, managerId)) {
      toast({
        title: "Cannot create reporting loop",
        description: "This would create a circular reporting structure.",
        variant: "destructive",
      });
      return;
    }
    
    const contact = contacts.find(c => c.id === sourceId);
    if (contact) {
      const currentOrg = contact.org || { ...DEFAULT_ORG };
      updateContact(sourceId, { org: { ...currentOrg, reportsToId: managerId } });
      onContactUpdate();
      
      const manager = contacts.find(c => c.id === managerId);
      toast({
        title: "Reporting line set",
        description: `${contact.name} now reports to ${manager?.name || 'Unknown'}`,
      });
    }
  }, [contacts, wouldCreateCycle, onContactUpdate, toast]);

  const handleNodeClick = useCallback((contact: StoredContact) => {
    setSelectedContact(contact);
  }, []);

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

  const hasReportingLines = contacts.some(c => c.org?.reportsToId);

  return (
    <div className="flex flex-col h-full">
      {/* Minimal header with View Diagram button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="w-4 h-4" />
          <span>{contacts.length} {contacts.length === 1 ? 'person' : 'people'}</span>
          {hasReportingLines && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{contacts.filter(c => c.org?.reportsToId).length} reporting lines</span>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowDiagram(true)}
          data-testid="button-view-diagram"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          View Diagram
        </Button>
      </div>

      {/* Hierarchy List - Main View */}
      <div className="flex-1 min-h-0 rounded-xl bg-card border overflow-hidden">
        <div className="h-full overflow-y-auto p-2">
          <HierarchyList
            contacts={contacts}
            onContactUpdate={onContactUpdate}
            onSelectContact={onSelectContact}
          />
        </div>
      </div>

      {/* Diagram Modal - Full Screen Sheet */}
      <Dialog open={showDiagram} onOpenChange={setShowDiagram}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 rounded-none sm:rounded-none">
          <div className="flex flex-col h-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
              <div>
                <DialogTitle className="text-lg font-semibold">Org Diagram</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Drag to connect reporting lines
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitView}
                  data-testid="button-diagram-fit"
                >
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

            {/* Diagram Canvas - Clean background, no grid */}
            <div className="flex-1 min-h-0 bg-gradient-to-br from-slate-50 to-white dark:from-gray-900 dark:to-gray-950">
              {hasReportingLines || contacts.length > 0 ? (
                <OrgChartCanvas
                  key={relayoutKey}
                  ref={canvasRef}
                  contacts={contacts}
                  onNodeClick={handleNodeClick}
                  onSetManager={handleSetManager}
                  editMode={true}
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
