/**
 * OrgChartCanvas - Interactive React Flow org chart with dagre layout
 * Features:
 * - Automatic tree layout using dagre
 * - Custom Apple-style contact nodes with avatar, name, title, department
 * - Edge rendering for reporting lines
 * - Pinch-zoom and pan on mobile
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
  InfluenceLevel,
} from "@/lib/contactsStorage";

// Department colors for node styling - Apple-inspired with subtle gradients
const DEPARTMENT_COLORS: Record<Department, { bg: string; border: string; text: string; accent: string }> = {
  EXEC: { bg: "bg-purple-50/90 dark:bg-purple-950/50", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", accent: "bg-purple-500" },
  LEGAL: { bg: "bg-indigo-50/90 dark:bg-indigo-950/50", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", accent: "bg-indigo-500" },
  PROJECT_DELIVERY: { bg: "bg-emerald-50/90 dark:bg-emerald-950/50", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", accent: "bg-emerald-500" },
  SALES: { bg: "bg-pink-50/90 dark:bg-pink-950/50", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300", accent: "bg-pink-500" },
  FINANCE: { bg: "bg-amber-50/90 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", accent: "bg-amber-500" },
  OPS: { bg: "bg-cyan-50/90 dark:bg-cyan-950/50", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300", accent: "bg-cyan-500" },
  UNKNOWN: { bg: "bg-gray-50/90 dark:bg-gray-900/50", border: "border-gray-200 dark:border-gray-700", text: "text-gray-600 dark:text-gray-400", accent: "bg-gray-400" },
};

const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: 'Exec',
  LEGAL: 'Legal',
  PROJECT_DELIVERY: 'Delivery',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OPS: 'Ops',
  UNKNOWN: 'Unknown',
};

const INFLUENCE_LABELS: Record<InfluenceLevel, string> = {
  HIGH: 'High',
  MEDIUM: 'Med',
  LOW: 'Low',
  UNKNOWN: '',
};

// Node dimensions for dagre layout
const NODE_WIDTH = 200;
const NODE_HEIGHT = 88;

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

// Custom Apple-style Contact Node Component
function ContactNode({ data, selected }: NodeProps<Node<ContactNodeData>>) {
  const { contact, onNodeClick } = data;
  const department = contact.org?.department || 'UNKNOWN';
  const influence = contact.org?.influence || 'UNKNOWN';
  const colors = DEPARTMENT_COLORS[department];

  const handleClick = useCallback(() => {
    if (onNodeClick) {
      onNodeClick(contact);
    }
  }, [contact, onNodeClick]);

  return (
    <div
      className={`
        relative rounded-2xl border shadow-sm cursor-pointer
        transition-all duration-200 ease-out
        ${colors.bg} ${colors.border}
        ${selected ? 'ring-2 ring-primary shadow-lg scale-[1.02]' : 'hover:shadow-md hover:scale-[1.01] active:scale-[0.98] active:shadow-sm'}
      `}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT - 8 }}
      onClick={handleClick}
      data-testid={`org-node-${contact.id}`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${colors.accent}`} />
      
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-800"
      />
      
      <div className="flex items-start gap-3 p-3 pl-4">
        {/* Avatar with initials */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${colors.accent}`}>
          {getInitials(contact.name || '')}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-sm truncate text-foreground" data-testid={`org-node-name-${contact.id}`}>
            {contact.name || 'Unknown'}
          </p>
          {contact.title && (
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {contact.title}
            </p>
          )}
          
          {/* Chips row */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Badge 
              variant="secondary" 
              className={`text-[10px] px-1.5 py-0 h-[18px] ${colors.text} bg-transparent border ${colors.border}`}
            >
              {DEPARTMENT_LABELS[department]}
            </Badge>
            {influence !== 'UNKNOWN' && (
              <Badge 
                variant="secondary" 
                className={`text-[10px] px-1.5 py-0 h-[18px] ${
                  influence === 'HIGH' ? 'text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700' :
                  influence === 'MEDIUM' ? 'text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700' :
                  'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                } bg-transparent border`}
              >
                {INFLUENCE_LABELS[influence]}
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-800"
      />
    </div>
  );
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
    nodesep: 60, 
    ranksep: 100,
    marginx: 40,
    marginy: 40,
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
          width: 12,
          height: 12,
          color: '#9ca3af',
        },
        style: { stroke: '#9ca3af', strokeWidth: 1.5 },
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
          <p>No contacts to display.</p>
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
          <Background color="#e5e7eb" gap={20} />
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
