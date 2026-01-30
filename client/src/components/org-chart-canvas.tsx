/**
 * OrgChartCanvas v4.0 - Modern, clean org chart with proper edge connections
 * Changes vs v3.0:
 * - Fixed edge connections to properly connect to nodes
 * - Removed floating company logo card
 * - Modern squared avatar design instead of circles
 * - Cleaner, flatter contact chip design
 * - Improved animations and visual polish
 */

import { useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  ReactFlow,
  Node,
  Edge,
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
import { ExternalLink, Users, Crosshair } from "lucide-react";
import { StoredContact, Department } from "@/lib/contactsStorage";

// Department colors - modern, subtle palette
const DEPARTMENT_COLORS: Record<
  Department,
  { bg: string; border: string; text: string; gradient: string; dot: string }
> = {
  EXEC: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-purple-200/60 dark:border-purple-800/40",
    text: "text-purple-600 dark:text-purple-400",
    gradient: "from-purple-500 to-violet-600",
    dot: "bg-purple-500",
  },
  LEGAL: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-indigo-200/60 dark:border-indigo-800/40",
    text: "text-indigo-600 dark:text-indigo-400",
    gradient: "from-indigo-500 to-blue-600",
    dot: "bg-indigo-500",
  },
  PROJECT_DELIVERY: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
    text: "text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-500 to-teal-600",
    dot: "bg-emerald-500",
  },
  SALES: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-rose-200/60 dark:border-rose-800/40",
    text: "text-rose-600 dark:text-rose-400",
    gradient: "from-rose-500 to-pink-600",
    dot: "bg-rose-500",
  },
  FINANCE: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-amber-200/60 dark:border-amber-800/40",
    text: "text-amber-600 dark:text-amber-400",
    gradient: "from-amber-500 to-orange-600",
    dot: "bg-amber-500",
  },
  OPS: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-cyan-200/60 dark:border-cyan-800/40",
    text: "text-cyan-600 dark:text-cyan-400",
    gradient: "from-cyan-500 to-sky-600",
    dot: "bg-cyan-500",
  },
  UNKNOWN: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-slate-200/60 dark:border-slate-700/40",
    text: "text-slate-500 dark:text-slate-400",
    gradient: "from-slate-400 to-slate-500",
    dot: "bg-slate-400",
  },
};

const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: "Executive",
  LEGAL: "Legal",
  PROJECT_DELIVERY: "Delivery",
  SALES: "Sales",
  FINANCE: "Finance",
  OPS: "Operations",
  UNKNOWN: "Unknown",
};

const NODE_WIDTH = 260;
const NODE_HEIGHT = 72;

interface ContactNodeData extends Record<string, unknown> {
  contact: StoredContact;
  onNodeClick?: (contact: StoredContact) => void;
  onOpenContact?: (contact: StoredContact) => void;
  onFocusContact?: (contact: StoredContact) => void;
  isDimmed?: boolean;
  isFocused?: boolean;
  isEditable?: boolean;
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Custom Contact Node - Modern flat design with proper handle connections
function ContactNode({ data, selected }: NodeProps<Node<ContactNodeData>>) {
  const { contact, onNodeClick, onOpenContact, onFocusContact } = data;
  const isDimmed = Boolean(data.isDimmed);
  const isFocused = Boolean(data.isFocused);
  const department = contact.org?.department || "UNKNOWN";
  const colors = DEPARTMENT_COLORS[department];

  const handleClick = useCallback(() => {
    onNodeClick?.(contact);
  }, [contact, onNodeClick]);

  const handleOpenContact = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onOpenContact?.(contact);
    },
    [contact, onOpenContact]
  );

  const handleFocusContact = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onFocusContact?.(contact);
    },
    [contact, onFocusContact]
  );

  return (
    <div
      className={`
        group relative cursor-pointer overflow-visible
        transition-all duration-200 ease-out
        ${isDimmed ? "opacity-25" : "opacity-100"}
        ${selected ? "scale-[1.02]" : "hover:scale-[1.01]"}
      `}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      onClick={handleClick}
      data-testid={`org-node-${contact.id}`}
    >
      {/* Connection Handle - Top (invisible but functional) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-transparent !border-0"
        style={{ top: -6, opacity: 0 }}
      />

      {/* Main card */}
      <div
        className={`
          h-full rounded-xl border ${colors.bg} ${colors.border}
          transition-all duration-200
          ${isFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
          ${selected ? "shadow-lg border-primary/40" : "shadow-sm hover:shadow-md"}
        `}
      >
        {/* Department indicator bar */}
        <div className={`absolute top-0 left-4 right-4 h-0.5 rounded-b bg-gradient-to-r ${colors.gradient}`} />

        {/* Content */}
        <div className="flex items-center gap-3 h-full px-3 py-2.5">
          {/* Modern squared avatar */}
          <div
            className={`
              w-11 h-11 rounded-lg flex items-center justify-center
              text-sm font-semibold text-white shrink-0
              bg-gradient-to-br ${colors.gradient}
              shadow-sm transition-transform duration-200 group-hover:scale-105
            `}
          >
            {getInitials(contact.name || "")}
          </div>

          {/* Name, title, and department */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-foreground leading-tight">
              {contact.name || "Unknown"}
            </p>
            {contact.title && (
              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {contact.title}
              </p>
            )}
            {department !== "UNKNOWN" && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                <span className={`text-[10px] font-medium ${colors.text}`}>
                  {DEPARTMENT_LABELS[department]}
                </span>
              </div>
            )}
          </div>

          {/* Hover action buttons */}
          <div className="flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-colors"
              onClick={handleFocusContact}
              aria-label="Focus on contact"
            >
              <Crosshair className="w-3 h-3" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-colors"
              onClick={handleOpenContact}
              aria-label="Open contact"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Connection Handle - Bottom (invisible but functional) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-transparent !border-0"
        style={{ bottom: -6, opacity: 0 }}
      />
    </div>
  );
}

const nodeTypes = { contact: ContactNode };

function buildGraphWithLayout(
  contacts: StoredContact[],
  onNodeClick?: (contact: StoredContact) => void,
  onOpenContact?: (contact: StoredContact) => void,
  onFocusContact?: (contact: StoredContact) => void,
  focusId?: string | null,
  editMode?: boolean
): { nodes: Node<ContactNodeData>[]; edges: Edge[] } {
  if (contacts.length === 0) return { nodes: [], edges: [] };

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const contactIds = new Set(contacts.map((c) => c.id));
  const rootNodes = contacts.filter((c) => !c.org?.reportsToId || !contactIds.has(c.org.reportsToId));

  const focusSet: Set<string> = new Set();
  if (focusId && contactIds.has(focusId)) {
    const byId = new Map(contacts.map((c) => [c.id, c] as const));

    // ancestors
    let current = byId.get(focusId);
    while (current) {
      focusSet.add(current.id);
      const managerId = current.org?.reportsToId;
      if (!managerId) break;
      const manager = byId.get(managerId);
      if (!manager) break;
      current = manager;
    }

    // descendants
    const childrenByManager = new Map<string, string[]>();
    contacts.forEach((c) => {
      const m = c.org?.reportsToId;
      if (!m) return;
      if (!childrenByManager.has(m)) childrenByManager.set(m, []);
      childrenByManager.get(m)!.push(c.id);
    });

    const stack = [...(childrenByManager.get(focusId) || [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (focusSet.has(id)) continue;
      focusSet.add(id);
      const kids = childrenByManager.get(id);
      if (kids) stack.push(...kids);
    }
  }

  const hasVirtualRoot = rootNodes.length > 1;
  const VIRTUAL_ROOT_ID = "__virtual_root__";
  if (hasVirtualRoot) g.setNode(VIRTUAL_ROOT_ID, { width: 1, height: 1 });

  contacts.forEach((contact) => g.setNode(contact.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));

  const edges: Edge[] = [];
  contacts.forEach((contact) => {
    if (contact.org?.reportsToId && contactIds.has(contact.org.reportsToId)) {
      g.setEdge(contact.org.reportsToId, contact.id);

      const hasFocus = focusSet.size > 0;
      const inFocusEdge = hasFocus && focusSet.has(contact.org.reportsToId) && focusSet.has(contact.id);

      edges.push({
        id: `${contact.org.reportsToId}-${contact.id}`,
        source: contact.org.reportsToId,
        target: contact.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: inFocusEdge ? "#8b5cf6" : "#94a3b8" },
        style: {
          stroke: inFocusEdge ? "#8b5cf6" : "#cbd5e1",
          strokeWidth: inFocusEdge ? 2.5 : 1.5,
          strokeLinecap: "round",
          opacity: !hasFocus ? 0.8 : inFocusEdge ? 1 : 0.3,
        },
        animated: false,
      });
    } else if (hasVirtualRoot) {
      g.setEdge(VIRTUAL_ROOT_ID, contact.id);
    }
  });

  dagre.layout(g);

  const hasFocus = focusSet.size > 0;

  const nodes: Node<ContactNodeData>[] = contacts.map((contact) => {
    const nodeWithPosition = g.node(contact.id);
    return {
      id: contact.id,
      type: "contact",
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: {
        contact,
        onNodeClick,
        onOpenContact,
        onFocusContact,
        isDimmed: hasFocus && !focusSet.has(contact.id),
        isFocused: hasFocus && contact.id === focusId,
        isEditable: Boolean(editMode),
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
  onOpenContact?: (contact: StoredContact) => void;
  onFocusContact?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
  focusId?: string | null;
}

const OrgChartCanvasInner = forwardRef<OrgChartCanvasHandle, OrgChartCanvasInnerProps>(function OrgChartCanvasInner(
  { contacts, onNodeClick, onOpenContact, onFocusContact, onSetManager, editMode, focusId },
  ref
) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => fitView({ padding: 0.2, duration: 300 }),
      zoomIn: () => zoomIn({ duration: 200 }),
      zoomOut: () => zoomOut({ duration: 200 }),
    }),
    [fitView, zoomIn, zoomOut]
  );

  const initialGraph = useMemo(
    () => buildGraphWithLayout(contacts, onNodeClick, onOpenContact, onFocusContact, focusId, editMode),
    [contacts, onNodeClick, onOpenContact, onFocusContact, focusId, editMode]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

  useEffect(() => {
    const newGraph = buildGraphWithLayout(contacts, onNodeClick, onOpenContact, onFocusContact, focusId, editMode);
    setNodes(newGraph.nodes);
    setEdges(newGraph.edges);
  }, [contacts, onNodeClick, onOpenContact, onFocusContact, focusId, editMode, setNodes, setEdges]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!editMode || !onSetManager) return;
      if (connection.source && connection.target) onSetManager(connection.source, connection.target);
    },
    [editMode, onSetManager]
  );

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
    <div className="h-full w-full relative" data-testid="org-chart-canvas">
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
        nodesDraggable={false}
        nodesConnectable={false}        // ✅ Disabled drag-to-connect
        onConnect={handleConnect}
        elementsSelectable
        panOnScroll
        zoomOnPinch
        preventScrolling={false}
      />
    </div>
  );
});

interface OrgChartCanvasProps {
  contacts: StoredContact[];
  onNodeClick?: (contact: StoredContact) => void;
  onOpenContact?: (contact: StoredContact) => void;
  onFocusContact?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
  focusId?: string | null;
}

export const OrgChartCanvas = forwardRef<OrgChartCanvasHandle, OrgChartCanvasProps>(function OrgChartCanvas(
  { contacts, onNodeClick, onOpenContact, onFocusContact, onSetManager, editMode = false, focusId },
  ref
) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner
        ref={ref}
        contacts={contacts}
        onNodeClick={onNodeClick}
        onOpenContact={onOpenContact}
        onFocusContact={onFocusContact}
        onSetManager={onSetManager}
        editMode={editMode}
        focusId={focusId}
      />
    </ReactFlowProvider>
  );
});
