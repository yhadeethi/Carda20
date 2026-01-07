/**
 * OrgChartCanvas v2.1 - Interactive React Flow org chart with dagre layout
 * Changes vs v2:
 * - Nodes are NOT draggable (layout is dagre-driven; dragging feels like a bug)
 * - Grid background removed (clean sheet look)
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
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Users, Crosshair } from "lucide-react";
import { StoredContact, Department } from "@/lib/contactsStorage";

// Department colors for node styling - Apple-inspired with vibrant accents
const DEPARTMENT_COLORS: Record<
  Department,
  { bg: string; border: string; text: string; accent: string; accentLight: string }
> = {
  EXEC: {
    bg: "bg-purple-50/95 dark:bg-purple-950/60",
    border: "border-purple-200/80 dark:border-purple-700/60",
    text: "text-purple-700 dark:text-purple-300",
    accent: "bg-purple-500",
    accentLight: "bg-purple-100 dark:bg-purple-900/50",
  },
  LEGAL: {
    bg: "bg-indigo-50/95 dark:bg-indigo-950/60",
    border: "border-indigo-200/80 dark:border-indigo-700/60",
    text: "text-indigo-700 dark:text-indigo-300",
    accent: "bg-indigo-500",
    accentLight: "bg-indigo-100 dark:bg-indigo-900/50",
  },
  PROJECT_DELIVERY: {
    bg: "bg-emerald-50/95 dark:bg-emerald-950/60",
    border: "border-emerald-200/80 dark:border-emerald-700/60",
    text: "text-emerald-700 dark:text-emerald-300",
    accent: "bg-emerald-500",
    accentLight: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  SALES: {
    bg: "bg-pink-50/95 dark:bg-pink-950/60",
    border: "border-pink-200/80 dark:border-pink-700/60",
    text: "text-pink-700 dark:text-pink-300",
    accent: "bg-pink-500",
    accentLight: "bg-pink-100 dark:bg-pink-900/50",
  },
  FINANCE: {
    bg: "bg-amber-50/95 dark:bg-amber-950/60",
    border: "border-amber-200/80 dark:border-amber-700/60",
    text: "text-amber-700 dark:text-amber-300",
    accent: "bg-amber-500",
    accentLight: "bg-amber-100 dark:bg-amber-900/50",
  },
  OPS: {
    bg: "bg-cyan-50/95 dark:bg-cyan-950/60",
    border: "border-cyan-200/80 dark:border-cyan-700/60",
    text: "text-cyan-700 dark:text-cyan-300",
    accent: "bg-cyan-500",
    accentLight: "bg-cyan-100 dark:bg-cyan-900/50",
  },
  UNKNOWN: {
    bg: "bg-gray-50/95 dark:bg-gray-900/60",
    border: "border-gray-200/80 dark:border-gray-700/60",
    text: "text-gray-600 dark:text-gray-400",
    accent: "bg-gray-400",
    accentLight: "bg-gray-100 dark:bg-gray-800/50",
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

const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;

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

function getGradientColor(department: Department, shade: "light" | "dark"): string {
  const gradients: Record<Department, { light: string; dark: string }> = {
    EXEC: { light: "#a855f7", dark: "#7c3aed" },
    LEGAL: { light: "#818cf8", dark: "#6366f1" },
    PROJECT_DELIVERY: { light: "#34d399", dark: "#10b981" },
    SALES: { light: "#f472b6", dark: "#ec4899" },
    FINANCE: { light: "#fbbf24", dark: "#f59e0b" },
    OPS: { light: "#22d3ee", dark: "#06b6d4" },
    UNKNOWN: { light: "#9ca3af", dark: "#6b7280" },
  };
  return gradients[department][shade];
}

// Custom Contact Node
function ContactNode({ data, selected }: NodeProps<Node<ContactNodeData>>) {
  const { contact, onNodeClick, onOpenContact, onFocusContact } = data;
  const isDimmed = Boolean(data.isDimmed);
  const isFocused = Boolean(data.isFocused);
  const isEditable = Boolean(data.isEditable);
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
        group relative rounded-2xl border-2 cursor-pointer overflow-hidden
        transition-all duration-200 ease-out backdrop-blur-sm
        ${colors.bg} ${colors.border}
        ${isDimmed ? "opacity-25 saturate-50" : "opacity-100"}
        ${
          selected
            ? "ring-2 ring-primary ring-offset-2 shadow-xl scale-[1.02]"
            : "shadow-lg shadow-black/8 dark:shadow-black/20 hover:shadow-xl hover:shadow-black/12 hover:scale-[1.02] active:scale-[0.98] active:shadow-md"
        }
      `}
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT - 8,
        backdropFilter: "blur(8px) saturate(180%)",
        WebkitBackdropFilter: "blur(8px) saturate(180%)"
      }}
      onClick={handleClick}
      data-testid={`org-node-${contact.id}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 dark:via-white/20 to-transparent" />
      <div className={`absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full ${colors.accent} shadow-sm`} />

      {isFocused && <div className="absolute inset-0 ring-2 ring-primary/60 ring-inset pointer-events-none rounded-2xl" />}
      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
        <button
          type="button"
          className="rounded-full bg-background/95 text-foreground shadow-md border border-border p-1.5 hover:bg-background hover:scale-110 transition-all duration-200 backdrop-blur-xl"
          onClick={handleFocusContact}
          aria-label="Focus on contact"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded-full bg-background/95 text-foreground shadow-md border border-border p-1.5 hover:bg-background hover:scale-110 transition-all duration-200 backdrop-blur-xl"
          onClick={handleOpenContact}
          aria-label="Open contact"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 !border-2 !border-white dark:!border-gray-800 !shadow-sm ${
          isEditable
            ? "!bg-primary/90 dark:!bg-primary/70 animate-pulse"
            : "!bg-gray-300 dark:!bg-gray-600"
        }`}
      />

      <div className="flex items-start gap-3 p-3.5 pl-5">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md ${colors.accent}`}
          style={{
            background: `linear-gradient(135deg, ${getGradientColor(department, "light")} 0%, ${getGradientColor(
              department,
              "dark"
            )} 100%)`,
          }}
        >
          {getInitials(contact.name || "")}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="font-semibold text-sm truncate text-foreground leading-tight" style={{ fontWeight: 600 }}>
            {contact.name || "Unknown"}
          </p>
          {contact.title && <p className="text-xs text-muted-foreground truncate leading-tight">{contact.title}</p>}

          <div className="flex items-center gap-1.5 pt-0.5">
            <Badge
              variant="secondary"
              className={`text-[10px] px-2.5 py-0.5 h-[20px] font-medium rounded-full ${colors.text} ${colors.accentLight} border-0`}
            >
              {DEPARTMENT_LABELS[department]}
            </Badge>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 !border-2 !border-white dark:!border-gray-800 !shadow-sm ${
          isEditable
            ? "!bg-primary/90 dark:!bg-primary/70 animate-pulse"
            : "!bg-gray-300 dark:!bg-gray-600"
        }`}
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
    nodesep: 70,
    ranksep: 110,
    marginx: 50,
    marginy: 50,
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
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#a78bfa" },
        style: {
          stroke: "url(#edge-gradient)",
          strokeWidth: inFocusEdge ? 3.2 : 2.5,
          strokeLinecap: "round",
          opacity: !hasFocus ? 1 : inFocusEdge ? 1 : 0.18,
        },
        animated: inFocusEdge,
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
        nodesDraggable={false}          // ✅ key fix
        nodesConnectable={!!editMode}   // keep connect-on-drag
        onConnect={handleConnect}
        elementsSelectable
        panOnScroll
        zoomOnPinch
        preventScrolling={false}
      >
        {/* Gradient definition for edges */}
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
      </ReactFlow>
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
