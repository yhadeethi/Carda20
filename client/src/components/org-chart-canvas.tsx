/**
 * OrgChartCanvas v2 - Interactive React Flow org chart with dagre layout
 * Features:
 * - Automatic tree layout using dagre
 * - Apple-style contact nodes with strong shadows, prominent accent bars
 * - Avatar with initials, name (font-weight 600), title, department chips
 * - Edge rendering for reporting lines
 * - Pinch-zoom and pan on mobile
 * - Press scale animation (0.97) for tactile feedback
 * - Imperative handle for parent control (fitView, zoom)
 */

import { useState, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  NodeProps,
  MarkerType,
  Connection,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import {
  StoredContact,
  Department,
} from "@/lib/contactsStorage";

// Dev-only console log
if (process.env.NODE_ENV === 'development') {
  console.log('OrgChartCanvas v2 loaded');
}

// Department colors for node styling - Apple-inspired with vibrant accents
const DEPARTMENT_COLORS: Record<Department, { bg: string; border: string; text: string; accent: string; accentLight: string }> = {
  EXEC: { 
    bg: "bg-purple-50/95 dark:bg-purple-950/60", 
    border: "border-purple-200/80 dark:border-purple-700/60", 
    text: "text-purple-700 dark:text-purple-300", 
    accent: "bg-purple-500",
    accentLight: "bg-purple-100 dark:bg-purple-900/50"
  },
  LEGAL: { 
    bg: "bg-indigo-50/95 dark:bg-indigo-950/60", 
    border: "border-indigo-200/80 dark:border-indigo-700/60", 
    text: "text-indigo-700 dark:text-indigo-300", 
    accent: "bg-indigo-500",
    accentLight: "bg-indigo-100 dark:bg-indigo-900/50"
  },
  PROJECT_DELIVERY: { 
    bg: "bg-emerald-50/95 dark:bg-emerald-950/60", 
    border: "border-emerald-200/80 dark:border-emerald-700/60", 
    text: "text-emerald-700 dark:text-emerald-300", 
    accent: "bg-emerald-500",
    accentLight: "bg-emerald-100 dark:bg-emerald-900/50"
  },
  SALES: { 
    bg: "bg-pink-50/95 dark:bg-pink-950/60", 
    border: "border-pink-200/80 dark:border-pink-700/60", 
    text: "text-pink-700 dark:text-pink-300", 
    accent: "bg-pink-500",
    accentLight: "bg-pink-100 dark:bg-pink-900/50"
  },
  FINANCE: { 
    bg: "bg-amber-50/95 dark:bg-amber-950/60", 
    border: "border-amber-200/80 dark:border-amber-700/60", 
    text: "text-amber-700 dark:text-amber-300", 
    accent: "bg-amber-500",
    accentLight: "bg-amber-100 dark:bg-amber-900/50"
  },
  OPS: { 
    bg: "bg-cyan-50/95 dark:bg-cyan-950/60", 
    border: "border-cyan-200/80 dark:border-cyan-700/60", 
    text: "text-cyan-700 dark:text-cyan-300", 
    accent: "bg-cyan-500",
    accentLight: "bg-cyan-100 dark:bg-cyan-900/50"
  },
  UNKNOWN: { 
    bg: "bg-gray-50/95 dark:bg-gray-900/60", 
    border: "border-gray-200/80 dark:border-gray-700/60", 
    text: "text-gray-600 dark:text-gray-400", 
    accent: "bg-gray-400",
    accentLight: "bg-gray-100 dark:bg-gray-800/50"
  },
};

const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: 'Executive',
  LEGAL: 'Legal',
  PROJECT_DELIVERY: 'Delivery',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OPS: 'Operations',
  UNKNOWN: 'Unknown',
};

// Node dimensions for dagre layout - slightly larger for better visuals
const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;

interface ContactNodeData extends Record<string, unknown> {
  contact: StoredContact;
  onNodeClick?: (contact: StoredContact) => void;
}

// Get initials from name
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Custom Apple-style Contact Node Component with enhanced visuals
function ContactNode({ data, selected }: NodeProps<Node<ContactNodeData>>) {
  const { contact, onNodeClick } = data;
  const department = contact.org?.department || 'UNKNOWN';
  const colors = DEPARTMENT_COLORS[department];

  const handleClick = useCallback(() => {
    if (onNodeClick) {
      onNodeClick(contact);
    }
  }, [contact, onNodeClick]);

  return (
    <div
      className={`
        group relative rounded-2xl border cursor-pointer overflow-hidden
        transition-all duration-200 ease-out
        ${colors.bg} ${colors.border}
        ${selected 
          ? 'ring-2 ring-primary ring-offset-2 shadow-xl scale-[1.02]' 
          : 'shadow-lg shadow-black/8 dark:shadow-black/20 hover:shadow-xl hover:shadow-black/12 hover:scale-[1.01] active:scale-[0.97] active:shadow-md'
        }
      `}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT - 8 }}
      onClick={handleClick}
      data-testid={`org-node-${contact.id}`}
    >
      {/* Top highlight stroke for glass depth */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 dark:via-white/20 to-transparent" />
      
      {/* Left accent bar - more prominent */}
      <div className={`absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full ${colors.accent} shadow-sm`} />
      
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-300 dark:!bg-gray-600 !w-3 !h-3 !border-2 !border-white dark:!border-gray-800 !shadow-sm"
      />
      
      <div className="flex items-start gap-3 p-3.5 pl-5">
        {/* Avatar with gradient and shadow */}
        <div 
          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md ${colors.accent}`}
          style={{
            background: `linear-gradient(135deg, ${getGradientColor(department, 'light')} 0%, ${getGradientColor(department, 'dark')} 100%)`,
          }}
        >
          {getInitials(contact.name || '')}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p 
            className="font-semibold text-sm truncate text-foreground leading-tight" 
            style={{ fontWeight: 600 }}
            data-testid={`org-node-name-${contact.id}`}
          >
            {contact.name || 'Unknown'}
          </p>
          {contact.title && (
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {contact.title}
            </p>
          )}
          
          {/* Chips row - more prominent */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Badge 
              variant="secondary" 
              className={`text-[10px] px-2 py-0.5 h-[20px] font-medium ${colors.text} ${colors.accentLight} border-0`}
            >
              {DEPARTMENT_LABELS[department]}
            </Badge>
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-300 dark:!bg-gray-600 !w-3 !h-3 !border-2 !border-white dark:!border-gray-800 !shadow-sm"
      />
    </div>
  );
}

// Get gradient colors for avatar
function getGradientColor(department: Department, shade: 'light' | 'dark'): string {
  const gradients: Record<Department, { light: string; dark: string }> = {
    EXEC: { light: '#a855f7', dark: '#7c3aed' },
    LEGAL: { light: '#818cf8', dark: '#6366f1' },
    PROJECT_DELIVERY: { light: '#34d399', dark: '#10b981' },
    SALES: { light: '#f472b6', dark: '#ec4899' },
    FINANCE: { light: '#fbbf24', dark: '#f59e0b' },
    OPS: { light: '#22d3ee', dark: '#06b6d4' },
    UNKNOWN: { light: '#9ca3af', dark: '#6b7280' },
  };
  return gradients[department][shade];
}

const nodeTypes = {
  contact: ContactNode,
};

// Build graph data from contacts using dagre for layout
function buildGraphWithLayout(
  contacts: StoredContact[],
  onNodeClick?: (contact: StoredContact) => void
): { nodes: Node<ContactNodeData>[]; edges: Edge[] } {
  if (contacts.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Create dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({ 
    rankdir: 'TB', 
    nodesep: 70, 
    ranksep: 110,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Find root nodes (nodes with no manager or manager not in this company)
  const contactIds = new Set(contacts.map(c => c.id));
  const rootNodes = contacts.filter(c => !c.org?.reportsToId || !contactIds.has(c.org.reportsToId));
  
  // If multiple roots, add virtual company root
  const hasVirtualRoot = rootNodes.length > 1;
  const VIRTUAL_ROOT_ID = '__virtual_root__';
  
  if (hasVirtualRoot) {
    g.setNode(VIRTUAL_ROOT_ID, { width: 1, height: 1 });
  }

  // Add nodes to dagre
  contacts.forEach((contact) => {
    g.setNode(contact.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges for reporting relationships
  const edges: Edge[] = [];
  contacts.forEach((contact) => {
    if (contact.org?.reportsToId && contactIds.has(contact.org.reportsToId)) {
      g.setEdge(contact.org.reportsToId, contact.id);
      edges.push({
        id: `${contact.org.reportsToId}-${contact.id}`,
        source: contact.org.reportsToId,
        target: contact.id,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: '#9ca3af',
        },
        style: { 
          stroke: '#9ca3af', 
          strokeWidth: 2,
          strokeLinecap: 'round',
        },
        animated: false,
      });
    } else if (hasVirtualRoot) {
      // Connect root nodes to virtual root
      g.setEdge(VIRTUAL_ROOT_ID, contact.id);
    }
  });

  // Run dagre layout
  dagre.layout(g);

  // Convert dagre positions to React Flow nodes
  const nodes: Node<ContactNodeData>[] = contacts.map((contact) => {
    const nodeWithPosition = g.node(contact.id);
    return {
      id: contact.id,
      type: 'contact',
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: {
        contact,
        onNodeClick,
      },
    };
  });

  return { nodes, edges };
}

export interface OrgChartCanvasHandle {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface OrgChartCanvasInnerProps {
  contacts: StoredContact[];
  onNodeClick?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
}

const OrgChartCanvasInner = forwardRef<OrgChartCanvasHandle, OrgChartCanvasInnerProps>(
  function OrgChartCanvasInner({ contacts, onNodeClick, onSetManager, editMode }, ref) {
    const { fitView, zoomIn, zoomOut } = useReactFlow();

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      fitView: () => fitView({ padding: 0.2, duration: 300 }),
      zoomIn: () => zoomIn({ duration: 200 }),
      zoomOut: () => zoomOut({ duration: 200 }),
    }), [fitView, zoomIn, zoomOut]);

    // Build initial graph
    const initialGraph = useMemo(
      () => buildGraphWithLayout(contacts, onNodeClick),
      [contacts, onNodeClick]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

    // Update graph when contacts change
    useEffect(() => {
      const newGraph = buildGraphWithLayout(contacts, onNodeClick);
      setNodes(newGraph.nodes);
      setEdges(newGraph.edges);
    }, [contacts, onNodeClick, setNodes, setEdges]);

    // Handle connection (drag from source to target)
    const handleConnect = useCallback((connection: Connection) => {
      if (!editMode || !onSetManager) return;
      if (connection.source && connection.target) {
        onSetManager(connection.source, connection.target);
      }
    }, [editMode, onSetManager]);

    // Empty state
    if (contacts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Users className="w-12 h-12 mb-3 opacity-50" />
          <p className="font-medium">No contacts to display.</p>
          <p className="text-sm mt-1">Add contacts from the People tab.</p>
        </div>
      );
    }

    return (
      <div className="h-full w-full" data-testid="org-chart-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={editMode}
          nodesConnectable={editMode}
          onConnect={handleConnect}
          elementsSelectable={true}
          panOnScroll
          zoomOnPinch
          preventScrolling={false}
        >
          <Background color="#cbd5e1" gap={24} size={1} />
        </ReactFlow>
      </div>
    );
  }
);

// Main exported component with ReactFlowProvider wrapper
interface OrgChartCanvasProps {
  contacts: StoredContact[];
  onNodeClick?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
}

export const OrgChartCanvas = forwardRef<OrgChartCanvasHandle, OrgChartCanvasProps>(
  function OrgChartCanvas({ contacts, onNodeClick, onSetManager, editMode = false }, ref) {
    return (
      <ReactFlowProvider>
        <OrgChartCanvasInner 
          ref={ref}
          contacts={contacts} 
          onNodeClick={onNodeClick}
          onSetManager={onSetManager}
          editMode={editMode}
        />
      </ReactFlowProvider>
    );
  }
);
