/**
 * Org Map Component for Org Intelligence v2
 * Features:
 * - Segmented control: Org Chart | Influence Map
 * - View/Edit toggle (default View)
 * - Department swimlanes for Org Chart
 * - Force-directed graph for Influence Map
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  User,
  MoreVertical,
  Shield,
  Minus,
  AlertTriangle,
  CircleDot,
  Users,
  UserPlus,
  Eye,
  Check,
  Network,
  GitBranch,
  GripVertical,
  Trash2,
  Info,
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

interface OrgMapProps {
  companyId: string;
  contacts: StoredContact[];
  onContactUpdate: () => void;
  onSelectContact: (contact: StoredContact) => void;
}

type ViewType = 'chart' | 'influence';

// Department display order and labels
const DEPARTMENT_ORDER: Department[] = ['EXEC', 'LEGAL', 'PROJECT_DELIVERY', 'SALES', 'FINANCE', 'OPS', 'UNKNOWN'];
const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: 'Executive',
  LEGAL: 'Legal',
  PROJECT_DELIVERY: 'Project Delivery',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OPS: 'Operations',
  UNKNOWN: 'Unassigned',
};

const DEPARTMENT_COLORS: Record<Department, string> = {
  EXEC: 'border-l-purple-500',
  LEGAL: 'border-l-indigo-500',
  PROJECT_DELIVERY: 'border-l-emerald-500',
  SALES: 'border-l-pink-500',
  FINANCE: 'border-l-amber-500',
  OPS: 'border-l-cyan-500',
  UNKNOWN: 'border-l-gray-400',
};

export function OrgMap({ companyId, contacts, onContactUpdate, onSelectContact }: OrgMapProps) {
  const [viewType, setViewType] = useState<ViewType>('chart');
  const [editMode, setEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<StoredContact | null>(null);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ sourceId: string; targetId: string } | null>(null);
  const { toast } = useToast();

  // Group contacts by department for swimlanes
  const departmentGroups = useMemo(() => {
    const groups: Record<Department, StoredContact[]> = {
      EXEC: [],
      LEGAL: [],
      PROJECT_DELIVERY: [],
      SALES: [],
      FINANCE: [],
      OPS: [],
      UNKNOWN: [],
    };
    
    contacts.forEach((c) => {
      const dept = c.org?.department || 'UNKNOWN';
      groups[dept].push(c);
    });
    
    // Sort contacts within each department by hierarchy (roots first, then by reports)
    Object.keys(groups).forEach((dept) => {
      const deptContacts = groups[dept as Department];
      const sorted = sortByHierarchy(deptContacts, contacts);
      groups[dept as Department] = sorted;
    });
    
    return groups;
  }, [contacts]);

  // Sort contacts by hierarchy within department
  function sortByHierarchy(deptContacts: StoredContact[], allContacts: StoredContact[]): StoredContact[] {
    const roots: StoredContact[] = [];
    const hasReports: StoredContact[] = [];
    const leaves: StoredContact[] = [];
    
    deptContacts.forEach((c) => {
      const isRoot = !c.org?.reportsToId;
      const hasDirectReports = allContacts.some((other) => other.org?.reportsToId === c.id);
      
      if (isRoot && hasDirectReports) {
        roots.push(c);
      } else if (isRoot) {
        leaves.push(c);
      } else if (hasDirectReports) {
        hasReports.push(c);
      } else {
        leaves.push(c);
      }
    });
    
    return [...roots, ...hasReports, ...leaves];
  }

  const handleSetOrgRole = (contactId: string, role: OrgRole) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const currentOrg = contact.org || { ...DEFAULT_ORG };
      updateContact(contactId, { org: { ...currentOrg, role } });
      onContactUpdate();
    }
  };

  const handleSetInfluence = (contactId: string, level: InfluenceLevel) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const currentOrg = contact.org || { ...DEFAULT_ORG };
      updateContact(contactId, { org: { ...currentOrg, influence: level } });
      onContactUpdate();
    }
  };

  const handleSetManager = (contactId: string, managerId: string | null) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const currentOrg = contact.org || { ...DEFAULT_ORG };
      updateContact(contactId, { org: { ...currentOrg, reportsToId: managerId } });
      setShowManagerPicker(false);
      setEditingContact(null);
      onContactUpdate();
      
      if (managerId) {
        const manager = contacts.find(c => c.id === managerId);
        toast({
          title: "Reporting line set",
          description: `${contact.name} now reports to ${manager?.name || 'Unknown'}`,
        });
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    if (!editMode) return;
    e.dataTransfer.setData('contactId', contactId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Check if targetId is a descendant of sourceId (would create cycle)
  const isDescendant = useCallback((sourceId: string, targetId: string): boolean => {
    const visited = new Set<string>();
    const check = (currentId: string): boolean => {
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      
      const directReports = contacts.filter(c => c.org?.reportsToId === currentId);
      for (const report of directReports) {
        if (report.id === targetId) return true;
        if (check(report.id)) return true;
      }
      return false;
    };
    return check(sourceId);
  }, [contacts]);

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!editMode) return;
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('contactId');
    
    if (sourceId && sourceId !== targetId) {
      // Check for cycle prevention
      if (isDescendant(sourceId, targetId)) {
        toast({
          title: "Cannot create reporting loop",
          description: "This would create a circular reporting structure.",
          variant: "destructive",
        });
        return;
      }
      setDragTarget({ sourceId, targetId });
    }
  };

  const confirmDragDrop = () => {
    if (!dragTarget) return;
    
    // Double-check cycle prevention before confirming
    if (isDescendant(dragTarget.sourceId, dragTarget.targetId)) {
      toast({
        title: "Cannot create reporting loop",
        description: "This would create a circular reporting structure.",
        variant: "destructive",
      });
      setDragTarget(null);
      return;
    }
    
    handleSetManager(dragTarget.sourceId, dragTarget.targetId);
    setDragTarget(null);
  };

  const cancelDragDrop = () => {
    setDragTarget(null);
  };

  const handleClearAllReportingLines = () => {
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
  };

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>To build an Org Map, add contacts for this company first.</p>
      </div>
    );
  }

  // Check if any contacts have departments assigned
  const hasDepartments = contacts.some(c => c.org?.department && c.org.department !== 'UNKNOWN');
  const hasReportingLines = contacts.some(c => c.org?.reportsToId);

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* View Type Segmented Control */}
        <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
          <TabsList className="h-8">
            <TabsTrigger value="chart" className="text-xs gap-1 px-3" data-testid="tab-org-chart">
              <GitBranch className="w-3.5 h-3.5" />
              Org Chart
            </TabsTrigger>
            <TabsTrigger value="influence" className="text-xs gap-1 px-3" data-testid="tab-influence-map">
              <Network className="w-3.5 h-3.5" />
              Influence Map
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Edit Mode Toggle */}
        {viewType === 'chart' && (
          <div className="flex items-center gap-2">
            <Label htmlFor="edit-mode" className="text-xs text-muted-foreground">
              {editMode ? 'Edit' : 'View'}
            </Label>
            <Switch
              id="edit-mode"
              checked={editMode}
              onCheckedChange={setEditMode}
              data-testid="switch-edit-mode"
            />
          </div>
        )}
      </div>

      {/* Edit Mode Actions */}
      {editMode && viewType === 'chart' && hasReportingLines && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowClearConfirm(true)}
            data-testid="button-clear-reporting"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear all reporting lines
          </Button>
        </div>
      )}

      {/* Helper Card for new users */}
      {!hasDepartments && !hasReportingLines && (
        <Card className="border-dashed">
          <CardContent className="py-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Get started with Org Map</p>
              <p>Use the Contacts tab to assign departments via Auto-group or manually edit each contact. 
                 Turn on Edit mode above to drag contacts onto each other to set reporting lines.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {viewType === 'chart' ? (
        <OrgChartView
          contacts={contacts}
          departmentGroups={departmentGroups}
          editMode={editMode}
          onSetOrgRole={handleSetOrgRole}
          onSetInfluence={handleSetInfluence}
          onSetManager={(id) => {
            const contact = contacts.find(c => c.id === id);
            if (contact) {
              setEditingContact(contact);
              setShowManagerPicker(true);
            }
          }}
          onViewContact={onSelectContact}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ) : (
        <InfluenceMapView
          contacts={contacts}
          onSelectContact={onSelectContact}
        />
      )}

      {/* Manager Picker Dialog */}
      <Dialog open={showManagerPicker} onOpenChange={setShowManagerPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Manager for {editingContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSetManager(editingContact!.id, null)}
            >
              <Minus className="w-4 h-4 mr-2" />
              No Manager (Top Level)
            </Button>
            {contacts
              .filter((c) => c.id !== editingContact?.id)
              .map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSetManager(editingContact!.id, c.id)}
                >
                  <User className="w-4 h-4 mr-2" />
                  <span className="truncate">{c.name}</span>
                  {c.title && (
                    <span className="text-muted-foreground text-xs ml-2 truncate">
                      {c.title}
                    </span>
                  )}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Drag-Drop Confirmation Dialog */}
      <Dialog open={!!dragTarget} onOpenChange={() => setDragTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Reporting Line</DialogTitle>
            <DialogDescription>
              {dragTarget && (
                <>
                  Set <strong>{contacts.find(c => c.id === dragTarget.sourceId)?.name}</strong> to report to{' '}
                  <strong>{contacts.find(c => c.id === dragTarget.targetId)?.name}</strong>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelDragDrop}>
              Cancel
            </Button>
            <Button onClick={confirmDragDrop} data-testid="button-confirm-reporting">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

// Org Chart View with Department Swimlanes
interface OrgChartViewProps {
  contacts: StoredContact[];
  departmentGroups: Record<Department, StoredContact[]>;
  editMode: boolean;
  onSetOrgRole: (contactId: string, role: OrgRole) => void;
  onSetInfluence: (contactId: string, level: InfluenceLevel) => void;
  onSetManager: (contactId: string) => void;
  onViewContact: (contact: StoredContact) => void;
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
}

function OrgChartView({
  contacts,
  departmentGroups,
  editMode,
  onSetOrgRole,
  onSetInfluence,
  onSetManager,
  onViewContact,
  onDragStart,
  onDragOver,
  onDrop,
}: OrgChartViewProps) {
  // Filter to only show departments that have contacts
  const activeDepartments = DEPARTMENT_ORDER.filter((dept) => departmentGroups[dept].length > 0);
  
  if (activeDepartments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p>No contacts with assigned departments.</p>
        <p className="text-sm mt-1">Use Auto-group in the Contacts tab to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeDepartments.map((dept) => (
        <div key={dept} className={`border-l-4 ${DEPARTMENT_COLORS[dept]} pl-3 space-y-2`}>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            {DEPARTMENT_LABELS[dept]}
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {departmentGroups[dept].length}
            </Badge>
          </h4>
          <div className="flex flex-wrap gap-3">
            {departmentGroups[dept].map((contact) => (
              <OrgNode
                key={contact.id}
                contact={contact}
                allContacts={contacts}
                editMode={editMode}
                onSetOrgRole={onSetOrgRole}
                onSetInfluence={onSetInfluence}
                onSetManager={() => onSetManager(contact.id)}
                onViewContact={() => onViewContact(contact)}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </div>
        </div>
      ))}
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
        setDimensions({ width: rect.width, height: Math.max(300, Math.min(400, rect.width * 0.8)) });
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
      <div className="text-center py-12 text-muted-foreground">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No contacts to visualize.</p>
      </div>
    );
  }

  if (!hasInfluenceData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Influence Map</p>
        <p className="text-sm mt-1">
          Assign influence levels to contacts to visualize their network.
        </p>
      </div>
    );
  }

  const handleNodeClick = useCallback((node: GraphNode) => {
    const contact = contacts.find(c => c.id === node.id);
    if (contact) {
      onSelectContact(contact);
    }
  }, [contacts, onSelectContact]);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center" data-testid="influence-map-legend">
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

      {/* Graph Container */}
      <div 
        ref={containerRef} 
        className="border rounded-lg bg-card overflow-hidden"
        style={{ height: dimensions.height }}
        data-testid="influence-map-container"
      >
        {ForceGraph ? (
          <ForceGraph
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel={(node: GraphNode) => `${node.name}${node.title ? ` - ${node.title}` : ''}`}
            nodeColor={(node: GraphNode) => node.color}
            nodeVal={(node: GraphNode) => node.val}
            linkColor={() => 'rgba(156, 163, 175, 0.3)'}
            linkWidth={1}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name?.split(' ')[0] || '';
              const fontSize = Math.max(8 / globalScale, 3);
              ctx.font = `${fontSize}px Sans-Serif`;
              
              // Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val / 2, 0, 2 * Math.PI);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // Draw ring for influence
              if (node.influence !== 'UNKNOWN') {
                ctx.strokeStyle = node.influence === 'HIGH' ? '#f97316' : 
                                  node.influence === 'MEDIUM' ? '#eab308' : '#3b82f6';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              }
              
              // Draw label below node
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillText(label, node.x, node.y + node.val / 2 + 2);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading visualization...
          </div>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Click on a node to view contact details. Drag to rearrange.
      </p>
    </div>
  );
}

// Individual Org Node Component
interface OrgNodeProps {
  contact: StoredContact;
  allContacts: StoredContact[];
  editMode: boolean;
  onSetOrgRole: (contactId: string, role: OrgRole) => void;
  onSetInfluence: (contactId: string, level: InfluenceLevel) => void;
  onSetManager: () => void;
  onViewContact: () => void;
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
}

function OrgNode({
  contact,
  allContacts,
  editMode,
  onSetOrgRole,
  onSetInfluence,
  onSetManager,
  onViewContact,
  onDragStart,
  onDragOver,
  onDrop,
}: OrgNodeProps) {
  const roleConfig: Record<OrgRole, { icon: typeof Shield; color: string }> = {
    CHAMPION: { icon: Shield, color: "text-green-600 dark:text-green-400" },
    NEUTRAL: { icon: Minus, color: "text-gray-500" },
    BLOCKER: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400" },
    UNKNOWN: { icon: CircleDot, color: "text-gray-400" },
  };

  const influenceColors: Record<InfluenceLevel, string> = {
    HIGH: "border-orange-400",
    MEDIUM: "border-yellow-400",
    LOW: "border-blue-400",
    UNKNOWN: "border-border",
  };

  const RoleIcon = roleConfig[contact.org?.role || 'UNKNOWN'].icon;
  const roleColor = roleConfig[contact.org?.role || 'UNKNOWN'].color;
  const borderColor = influenceColors[contact.org?.influence || 'UNKNOWN'];

  // Find manager name
  const manager = contact.org?.reportsToId
    ? allContacts.find((c) => c.id === contact.org?.reportsToId)
    : null;

  // Find direct reports
  const directReports = allContacts.filter((c) => c.org?.reportsToId === contact.id);

  return (
    <Card
      className={`w-44 border-2 ${borderColor} ${editMode ? 'cursor-grab' : 'hover-elevate cursor-pointer'}`}
      draggable={editMode}
      onDragStart={(e) => onDragStart(e, contact.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, contact.id)}
      onClick={!editMode ? onViewContact : undefined}
      data-testid={`org-node-${contact.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          {editMode && (
            <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate" title={contact.name}>
              {contact.name || "Unknown"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate" title={contact.title}>
              {contact.title || "No title"}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onViewContact}>
                <Eye className="w-4 h-4 mr-2" />
                View Full Contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSetManager}>
                <User className="w-4 h-4 mr-2" />
                Set Manager
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">Org Role</DropdownMenuLabel>
              {(['CHAMPION', 'NEUTRAL', 'BLOCKER', 'UNKNOWN'] as OrgRole[]).map((role) => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => onSetOrgRole(contact.id, role)}
                >
                  {contact.org?.role === role && <Check className="w-4 h-4 mr-2" />}
                  {contact.org?.role !== role && <span className="w-4 mr-2" />}
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">Influence</DropdownMenuLabel>
              {(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as InfluenceLevel[]).map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() => onSetInfluence(contact.id, level)}
                >
                  {contact.org?.influence === level && <Check className="w-4 h-4 mr-2" />}
                  {contact.org?.influence !== level && <span className="w-4 mr-2" />}
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Role and Influence chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {contact.org?.role && contact.org.role !== 'UNKNOWN' && (
            <div className={`flex items-center gap-0.5 ${roleColor}`}>
              <RoleIcon className="w-3 h-3" />
              <span className="text-[9px] font-medium">{contact.org.role.charAt(0) + contact.org.role.slice(1).toLowerCase()}</span>
            </div>
          )}
          {contact.org?.influence && contact.org.influence !== 'UNKNOWN' && (
            <span className="text-[9px] text-muted-foreground">
              {contact.org.influence.charAt(0) + contact.org.influence.slice(1).toLowerCase()}
            </span>
          )}
        </div>

        {/* Manager indicator */}
        {manager && (
          <p className="text-[9px] text-muted-foreground truncate">
            Reports to: {manager.name}
          </p>
        )}

        {/* Direct reports count */}
        {directReports.length > 0 && (
          <p className="text-[9px] text-muted-foreground">
            {directReports.length} direct report{directReports.length !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
