/**
 * Org Map Component for Org Intelligence v2 - Apple-Grade Design
 * Features:
 * - Full-canvas layout with glass toolbar
 * - Segmented control: Org | Influence
 * - Toolbar buttons: Fit, Zoom +/-, Auto-layout, Edit toggle
 * - React Flow canvas with dagre layout
 * - Bottom sheet for node tap
 * - Force-directed graph for Influence Map
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Minus,
  Plus,
  Users,
  Network,
  GitBranch,
  Trash2,
  Info,
  Pencil,
  Sparkles,
  Maximize2,
} from "lucide-react";
import {
  StoredContact,
  updateContact,
  OrgRole,
  InfluenceLevel,
  Department,
  DEFAULT_ORG,
  clearAllReportingLines,
  restoreReportingLines,
} from "@/lib/contactsStorage";
import { useToast } from "@/hooks/use-toast";
import { OrgChartCanvas } from "@/components/org-chart-canvas";
import { motion, AnimatePresence } from "framer-motion";

interface OrgMapProps {
  companyId: string;
  contacts: StoredContact[];
  onContactUpdate: () => void;
  onSelectContact: (contact: StoredContact) => void;
}

type ViewType = 'org' | 'influence';

// Department display labels
const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: 'Exec',
  LEGAL: 'Legal',
  PROJECT_DELIVERY: 'Delivery',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OPS: 'Ops',
  UNKNOWN: 'Unknown',
};

const DEPARTMENT_ORDER: Department[] = ['EXEC', 'LEGAL', 'PROJECT_DELIVERY', 'SALES', 'FINANCE', 'OPS', 'UNKNOWN'];

export function OrgMap({ companyId, contacts, onContactUpdate, onSelectContact }: OrgMapProps) {
  const [viewType, setViewType] = useState<ViewType>('org');
  const [editMode, setEditMode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<StoredContact | null>(null);
  const [relayoutKey, setRelayoutKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef<{ fitView: () => void; zoomIn: () => void; zoomOut: () => void } | null>(null);
  const { toast } = useToast();

  const handleNodeClick = useCallback((contact: StoredContact) => {
    setSelectedContact(contact);
  }, []);

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

  // Handle setting manager from drag-drop connection
  const handleSetManager = useCallback((sourceId: string, managerId: string) => {
    if (sourceId === managerId) return;
    
    // Check for cycle
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

  const handleRelayout = useCallback(() => {
    setRelayoutKey((k) => k + 1);
    toast({ title: "Layout refreshed" });
  }, [toast]);

  const handleFitView = useCallback(() => {
    canvasRef.current?.fitView();
  }, []);

  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomOut();
  }, []);

  const handleClearAllReportingLines = useCallback(() => {
    const previousManagers = clearAllReportingLines(contacts);
    setShowClearConfirm(false);
    onContactUpdate();
    
    toast({
      title: "Reporting lines cleared",
      description: `Cleared ${previousManagers.size} reporting relationship${previousManagers.size !== 1 ? 's' : ''}`,
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            restoreReportingLines(previousManagers);
            onContactUpdate();
            toast({ title: "Undo complete", description: "Reporting lines restored" });
          }}
        >
          Undo
        </Button>
      ),
    });
  }, [contacts, onContactUpdate, toast]);

  // Quick edit handlers
  const handleQuickEditField = useCallback((field: 'department' | 'role' | 'influence' | 'reportsToId', value: string | null) => {
    if (!selectedContact) return;
    
    const currentOrg = selectedContact.org || { ...DEFAULT_ORG };
    const updatedOrg = { ...currentOrg, [field]: value };
    
    updateContact(selectedContact.id, { org: updatedOrg });
    setSelectedContact({ ...selectedContact, org: updatedOrg });
    onContactUpdate();
  }, [selectedContact, onContactUpdate]);

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-320px)] min-h-[300px] text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>To build an Org Map, add contacts for this company first.</p>
      </div>
    );
  }

  const hasDepartments = contacts.some(c => c.org?.department && c.org.department !== 'UNKNOWN');
  const hasReportingLines = contacts.some(c => c.org?.reportsToId);

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Glass Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-xl bg-background/80 backdrop-blur-xl border shadow-sm">
        {/* View Type Segmented Control */}
        <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
          <TabsList className="h-8 bg-muted/50">
            <TabsTrigger value="org" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-org">
              <GitBranch className="w-3.5 h-3.5" />
              Org
            </TabsTrigger>
            <TabsTrigger value="influence" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-influence">
              <Network className="w-3.5 h-3.5" />
              Influence
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1">
          {/* Fit View */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleFitView}
            data-testid="button-fit-view"
            title="Fit to view"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          {/* Zoom Controls */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-none border-r"
              onClick={handleZoomOut}
              data-testid="button-zoom-out"
              title="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-none"
              onClick={handleZoomIn}
              data-testid="button-zoom-in"
              title="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-1" />

          {/* Auto-layout (only for Org view) */}
          {viewType === 'org' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleRelayout}
              data-testid="button-relayout"
              title="Auto-layout"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}

          {/* Edit Mode Toggle (only for Org view) */}
          {viewType === 'org' && (
            <Button
              size="icon"
              variant={editMode ? "default" : "ghost"}
              className="h-8 w-8"
              onClick={() => setEditMode(!editMode)}
              data-testid="button-edit-mode"
              title={editMode ? "Exit edit mode" : "Edit reporting lines"}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}

          {/* Clear All (only when has reporting lines) */}
          {viewType === 'org' && hasReportingLines && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setShowClearConfirm(true)}
              data-testid="button-clear-reporting"
              title="Clear all reporting lines"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Helper Card for new users */}
      <AnimatePresence>
        {!hasDepartments && !hasReportingLines && viewType === 'org' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-dashed mb-2">
              <CardContent className="py-3 flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Get started with Org Map</p>
                  <p>Use the People tab to assign departments via Auto-group. Tap nodes to set reporting lines.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas Container */}
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border bg-muted/30">
        <AnimatePresence mode="wait">
          {viewType === 'org' ? (
            <motion.div
              key="org"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <OrgChartCanvas
                key={relayoutKey}
                ref={canvasRef}
                contacts={contacts}
                onNodeClick={handleNodeClick}
                onSetManager={handleSetManager}
                editMode={editMode}
              />
            </motion.div>
          ) : (
            <motion.div
              key="influence"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <InfluenceMapView
                contacts={contacts}
                onSelectContact={onSelectContact}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Sheet for Node Tap */}
      <Drawer open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {selectedContact?.name || "Contact"}
            </DrawerTitle>
            {selectedContact?.title && (
              <p className="text-sm text-muted-foreground">{selectedContact.title}</p>
            )}
          </DrawerHeader>
          <div className="p-4 space-y-4">
            {/* Department Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select
                value={selectedContact?.org?.department || 'UNKNOWN'}
                onValueChange={(value) => handleQuickEditField('department', value as Department)}
              >
                <SelectTrigger data-testid="select-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_ORDER.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {DEPARTMENT_LABELS[dept]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Influence Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Influence Level</label>
              <Select
                value={selectedContact?.org?.influence || 'UNKNOWN'}
                onValueChange={(value) => handleQuickEditField('influence', value as InfluenceLevel)}
              >
                <SelectTrigger data-testid="select-influence">
                  <SelectValue placeholder="Select influence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Org Role</label>
              <Select
                value={selectedContact?.org?.role || 'UNKNOWN'}
                onValueChange={(value) => handleQuickEditField('role', value as OrgRole)}
              >
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAMPION">Champion</SelectItem>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  <SelectItem value="BLOCKER">Blocker</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reports To Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reports To</label>
              <Select
                value={selectedContact?.org?.reportsToId || '_none'}
                onValueChange={(value) => handleQuickEditField('reportsToId', value === '_none' ? null : value)}
              >
                <SelectTrigger data-testid="select-manager">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Manager (Top Level)</SelectItem>
                  {contacts
                    .filter((c) => c.id !== selectedContact?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || c.email || "Unknown"}
                        {c.title && ` - ${c.title}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Full Profile Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (selectedContact) {
                  onSelectContact(selectedContact);
                  setSelectedContact(null);
                }
              }}
              data-testid="button-view-profile"
            >
              <User className="w-4 h-4 mr-2" />
              View Full Profile
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="button-close-drawer">Done</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear All Reporting Lines</DialogTitle>
            <DialogDescription>
              This will remove all manager relationships for this company's contacts. 
              You can undo this action immediately after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearAllReportingLines} data-testid="button-confirm-clear">
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Influence Map View with Force-Directed Graph
interface InfluenceMapViewProps {
  contacts: StoredContact[];
  onSelectContact: (contact: StoredContact) => void;
}

interface GraphNode {
  id: string;
  name: string;
  title: string;
  influence: InfluenceLevel;
  role: OrgRole;
  department: Department;
  val: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
}

function InfluenceMapView({ contacts, onSelectContact }: InfluenceMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 });
  const [ForceGraph, setForceGraph] = useState<any>(null);
  
  // Dynamically import react-force-graph-2d
  useEffect(() => {
    import('react-force-graph-2d').then((module) => {
      setForceGraph(() => module.default);
    });
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Build graph data
  const graphData = useMemo(() => {
    const influenceSize: Record<InfluenceLevel, number> = {
      HIGH: 20,
      MEDIUM: 12,
      LOW: 6,
      UNKNOWN: 4,
    };

    const roleColors: Record<OrgRole, string> = {
      CHAMPION: '#22c55e',
      NEUTRAL: '#6b7280',
      BLOCKER: '#ef4444',
      UNKNOWN: '#a1a1aa',
    };

    const nodes: GraphNode[] = contacts.map((c) => ({
      id: c.id,
      name: c.name || 'Unknown',
      title: c.title || '',
      influence: c.org?.influence || 'UNKNOWN',
      role: c.org?.role || 'UNKNOWN',
      department: c.org?.department || 'UNKNOWN',
      val: influenceSize[c.org?.influence || 'UNKNOWN'],
      color: roleColors[c.org?.role || 'UNKNOWN'],
    }));

    // Create links from reporting relationships
    const links: GraphLink[] = contacts
      .filter((c) => c.org?.reportsToId)
      .map((c) => ({
        source: c.id,
        target: c.org!.reportsToId!,
      }));

    return { nodes, links };
  }, [contacts]);

  const hasData = contacts.length > 0;
  const hasInfluenceData = contacts.some(c => c.org?.influence && c.org.influence !== 'UNKNOWN');

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No contacts to visualize.</p>
      </div>
    );
  }

  if (!hasInfluenceData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Influence Map</p>
        <p className="text-sm mt-1">
          Assign influence levels to contacts to visualize their network.
        </p>
      </div>
    );
  }

  const handleNodeClick = (node: GraphNode) => {
    const contact = contacts.find(c => c.id === node.id);
    if (contact) {
      onSelectContact(contact);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center py-2 px-3 border-b bg-background/50" data-testid="influence-map-legend">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Size:</span>
          <span>Influence level</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span>Champion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>Blocker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
          <span>Unknown</span>
        </div>
      </div>

      {/* Force Graph */}
      <div ref={containerRef} className="flex-1 min-h-0" data-testid="influence-map-canvas">
        {ForceGraph && dimensions.height > 0 && (
          <ForceGraph
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeRelSize={1}
            nodeVal={(node: GraphNode) => node.val}
            nodeColor={(node: GraphNode) => node.color}
            nodeLabel={(node: GraphNode) => `${node.name}${node.title ? ` - ${node.title}` : ''}`}
            linkColor={() => '#d1d5db'}
            linkWidth={1}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = 10 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              
              // Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // Draw ring for influence
              if (node.influence !== 'UNKNOWN') {
                ctx.strokeStyle = node.influence === 'HIGH' ? '#f97316' : 
                                  node.influence === 'MEDIUM' ? '#eab308' : '#60a5fa';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              }
              
              // Draw label below node
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = '#374151';
              ctx.fillText(label, node.x, node.y + node.val + 2);
            }}
          />
        )}
      </div>
    </div>
  );
}
