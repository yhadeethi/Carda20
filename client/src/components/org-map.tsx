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

      {/* Bottom Sheet for Node Tap - Apple-style Quick Edit */}
      <Drawer open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
                {selectedContact?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <DrawerTitle className="text-lg truncate">
                  {selectedContact?.name || "Contact"}
                </DrawerTitle>
                {selectedContact?.title && (
                  <p className="text-sm text-muted-foreground truncate">{selectedContact.title}</p>
                )}
              </div>
            </div>
          </DrawerHeader>
          
          <div className="px-4 pb-4 space-y-4 overflow-y-auto">
            {/* Two-column grid for compact layout */}
            <div className="grid grid-cols-2 gap-3">
              {/* Department Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
                <Select
                  value={selectedContact?.org?.department || 'UNKNOWN'}
                  onValueChange={(value) => handleQuickEditField('department', value as Department)}
                >
                  <SelectTrigger className="h-9" data-testid="select-department">
                    <SelectValue placeholder="Select" />
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Influence</label>
                <Select
                  value={selectedContact?.org?.influence || 'UNKNOWN'}
                  onValueChange={(value) => handleQuickEditField('influence', value as InfluenceLevel)}
                >
                  <SelectTrigger className="h-9" data-testid="select-influence">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role Select - full width with Unknown option */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Org Role</label>
              <div className="flex gap-2">
                {(['CHAMPION', 'NEUTRAL', 'BLOCKER', 'UNKNOWN'] as const).map((role) => (
                  <Button
                    key={role}
                    variant={selectedContact?.org?.role === role || (!selectedContact?.org?.role && role === 'UNKNOWN') ? "default" : "outline"}
                    size="sm"
                    className={`flex-1 text-xs ${
                      selectedContact?.org?.role === role || (!selectedContact?.org?.role && role === 'UNKNOWN') ? '' :
                      role === 'CHAMPION' ? 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950' :
                      role === 'BLOCKER' ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950' :
                      ''
                    }`}
                    onClick={() => handleQuickEditField('role', role)}
                    data-testid={`button-role-${role.toLowerCase()}`}
                  >
                    {role === 'CHAMPION' ? 'Champion' : role === 'NEUTRAL' ? 'Neutral' : role === 'BLOCKER' ? 'Blocker' : '—'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Reports To Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reports To</label>
              <Select
                value={selectedContact?.org?.reportsToId || '_none'}
                onValueChange={(value) => handleQuickEditField('reportsToId', value === '_none' ? null : value)}
              >
                <SelectTrigger className="h-9" data-testid="select-manager">
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
          </div>
          
          <DrawerFooter className="pt-2 border-t">
            <div className="flex gap-2">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1" data-testid="button-close-drawer">Done</Button>
              </DrawerClose>
              <Button
                variant="default"
                className="flex-1"
                onClick={() => {
                  if (selectedContact) {
                    onSelectContact(selectedContact);
                    setSelectedContact(null);
                  }
                }}
                data-testid="button-view-profile"
              >
                <User className="w-4 h-4 mr-2" />
                Full Profile
              </Button>
            </div>
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
  gradientColors?: { inner: string; outer: string };
}

interface GraphLink {
  source: string;
  target: string;
}

function InfluenceMapView({ contacts, onSelectContact }: InfluenceMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 });
  const [ForceGraph, setForceGraph] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
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
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Fit to view after initial layout
  useEffect(() => {
    if (graphRef.current && dimensions.width > 0 && dimensions.height > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 60);
      }, 500);
    }
  }, [ForceGraph, dimensions]);

  // Build graph data with improved sizing
  const graphData = useMemo(() => {
    const influenceSize: Record<InfluenceLevel, number> = {
      HIGH: 24,
      MEDIUM: 16,
      LOW: 10,
      UNKNOWN: 8,
    };

    const roleColors: Record<OrgRole, string> = {
      CHAMPION: '#22c55e',
      NEUTRAL: '#71717a',
      BLOCKER: '#ef4444',
      UNKNOWN: '#a1a1aa',
    };

    const roleGradientColors: Record<OrgRole, { inner: string; outer: string }> = {
      CHAMPION: { inner: '#4ade80', outer: '#16a34a' },
      NEUTRAL: { inner: '#a1a1aa', outer: '#52525b' },
      BLOCKER: { inner: '#f87171', outer: '#dc2626' },
      UNKNOWN: { inner: '#d4d4d8', outer: '#a1a1aa' },
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
      gradientColors: roleGradientColors[c.org?.role || 'UNKNOWN'],
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
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Influence Map</p>
        <p className="text-sm mt-1 max-w-[240px]">
          Assign influence levels and roles to contacts to visualize their network.
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
      {/* Compact Legend with Glass Effect */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground justify-center py-1.5 px-3 bg-background/60 backdrop-blur-sm border-b" data-testid="influence-map-legend">
        <div className="flex items-center gap-1">
          <span className="font-medium text-foreground/70">Size</span>
          <span>=</span>
          <span>Influence</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
            <span>Champion</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-zinc-500 shadow-sm" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
            <span>Blocker</span>
          </div>
        </div>
      </div>

      {/* Force Graph Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative" data-testid="influence-map-canvas">
        {ForceGraph && dimensions.height > 0 && (
          <ForceGraph
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeRelSize={1}
            nodeVal={(node: GraphNode) => node.val}
            nodeColor={(node: GraphNode) => node.color}
            nodeLabel=""
            linkColor={() => 'rgba(156, 163, 175, 0.4)'}
            linkWidth={1.5}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onNodeHover={(node: GraphNode | null) => setHoveredNode(node?.id || null)}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={50}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const isHovered = hoveredNode === node.id;
              const radius = node.val * (isHovered ? 1.15 : 1);
              const label = node.name;
              
              // Shadow for depth
              ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 2;
              
              // Create gradient fill for bubble effect
              const gradient = ctx.createRadialGradient(
                node.x - radius * 0.3,
                node.y - radius * 0.3,
                0,
                node.x,
                node.y,
                radius
              );
              gradient.addColorStop(0, node.gradientColors?.inner || node.color);
              gradient.addColorStop(1, node.gradientColors?.outer || node.color);
              
              // Draw main bubble
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
              ctx.fillStyle = gradient;
              ctx.fill();
              
              // Reset shadow for other elements
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              
              // Draw subtle highlight for gloss effect
              ctx.beginPath();
              ctx.arc(node.x - radius * 0.25, node.y - radius * 0.25, radius * 0.35, 0, 2 * Math.PI);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
              ctx.fill();
              
              // Draw influence ring for HIGH influence
              if (node.influence === 'HIGH') {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
                ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
              }
              
              // Draw label with smart positioning
              const fontSize = Math.max(10, 11 / globalScale);
              ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              
              // Label background pill for readability
              const textWidth = ctx.measureText(label).width;
              const labelY = node.y + radius + 4;
              const pillPadding = 4;
              const pillHeight = fontSize + 4;
              
              ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
              ctx.beginPath();
              ctx.roundRect(
                node.x - textWidth / 2 - pillPadding,
                labelY - 2,
                textWidth + pillPadding * 2,
                pillHeight,
                3
              );
              ctx.fill();
              
              // Draw text
              ctx.fillStyle = '#374151';
              ctx.fillText(label, node.x, labelY);
            }}
          />
        )}
      </div>
    </div>
  );
}
