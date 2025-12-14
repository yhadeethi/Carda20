/**
 * OrgChartCanvas - Interactive React Flow org chart with dagre layout
 * Features:
 * - Automatic tree layout using dagre
 * - Custom contact nodes with name, title, department pill
 * - Edge rendering for reporting lines
 * - Pinch-zoom and pan on mobile
 * - Center/Fit floating button
 */

import { useState, useCallback, useMemo, useEffect } from "react";
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
  Panel,
  Connection,
  addEdge,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Users } from "lucide-react";
import {
  StoredContact,
  Department,
} from "@/lib/contactsStorage";

// Department colors for node styling
const DEPARTMENT_COLORS: Record<Department, { bg: string; border: string; text: string }> = {
  EXEC: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-300 dark:border-purple-700", text: "text-purple-700 dark:text-purple-300" },
  LEGAL: { bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-300 dark:border-indigo-700", text: "text-indigo-700 dark:text-indigo-300" },
  PROJECT_DELIVERY: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300" },
  SALES: { bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-300 dark:border-pink-700", text: "text-pink-700 dark:text-pink-300" },
  FINANCE: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300" },
  OPS: { bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "border-cyan-300 dark:border-cyan-700", text: "text-cyan-700 dark:text-cyan-300" },
  UNKNOWN: { bg: "bg-gray-50 dark:bg-gray-800/50", border: "border-gray-300 dark:border-gray-600", text: "text-gray-600 dark:text-gray-400" },
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

// Node dimensions for dagre layout
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

interface ContactNodeData extends Record<string, unknown> {
  contact: StoredContact;
  onNodeClick?: (contact: StoredContact) => void;
}

// Custom Contact Node Component
function ContactNode({ data }: NodeProps<Node<ContactNodeData>>) {
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
      className={`px-3 py-2 rounded-lg border-2 shadow-sm cursor-pointer transition-shadow hover:shadow-md ${colors.bg} ${colors.border}`}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT - 16 }}
      onClick={handleClick}
      data-testid={`org-node-${contact.id}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2 !h-2"
      />
      <div className="flex flex-col gap-1">
        <span className="font-medium text-sm truncate text-foreground" data-testid={`org-node-name-${contact.id}`}>
          {contact.name || 'Unknown'}
        </span>
        {contact.title && (
          <span className="text-xs text-muted-foreground truncate">
            {contact.title}
          </span>
        )}
        <Badge 
          variant="secondary" 
          className={`text-[10px] px-1.5 py-0 h-4 w-fit ${colors.text}`}
        >
          {DEPARTMENT_LABELS[department]}
        </Badge>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2 !h-2"
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
    nodesep: 50, 
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to dagre
  contacts.forEach((contact) => {
    g.setNode(contact.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges for reporting relationships
  const edges: Edge[] = [];
  contacts.forEach((contact) => {
    if (contact.org?.reportsToId) {
      const managerId = contact.org.reportsToId;
      // Only add edge if manager exists in our contacts
      if (contacts.some((c) => c.id === managerId)) {
        g.setEdge(managerId, contact.id);
        edges.push({
          id: `${managerId}-${contact.id}`,
          source: managerId,
          target: contact.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: '#9ca3af',
          },
          style: { stroke: '#9ca3af', strokeWidth: 1.5 },
        });
      }
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

interface OrgChartCanvasInnerProps {
  contacts: StoredContact[];
  onNodeClick?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
}

function OrgChartCanvasInner({ contacts, onNodeClick, onSetManager, editMode }: OrgChartCanvasInnerProps) {
  const { fitView } = useReactFlow();

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

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  // Handle connection (drag from source to target)
  // User drags FROM subordinate TO manager to set reporting line
  const handleConnect = useCallback((connection: Connection) => {
    if (!editMode || !onSetManager) return;
    if (connection.source && connection.target) {
      // source = person who will report, target = their new manager
      onSetManager(connection.source, connection.target);
    }
  }, [editMode, onSetManager]);

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Users className="w-12 h-12 mb-3 opacity-50" />
        <p>No contacts to display.</p>
        <p className="text-sm mt-1">Add contacts from the People tab.</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full rounded-lg border bg-background/50" data-testid="org-chart-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={editMode}
        nodesConnectable={editMode}
        onConnect={handleConnect}
        elementsSelectable={true}
        panOnScroll
        zoomOnPinch
        preventScrolling={false}
      >
        <Background color="#e5e7eb" gap={16} />
        <Panel position="bottom-right" className="!m-2">
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 bg-background shadow-md"
            onClick={handleFitView}
            data-testid="button-fit-view"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// Main exported component with ReactFlowProvider wrapper
interface OrgChartCanvasProps {
  contacts: StoredContact[];
  onNodeClick?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
}

export function OrgChartCanvas({ contacts, onNodeClick, onSetManager, editMode = false }: OrgChartCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner 
        contacts={contacts} 
        onNodeClick={onNodeClick}
        onSetManager={onSetManager}
        editMode={editMode}
      />
    </ReactFlowProvider>
  );
}
