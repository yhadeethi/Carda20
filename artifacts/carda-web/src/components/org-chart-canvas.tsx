/**
 * OrgChartCanvas v5.0 - Carda Design System Refresh
 *
 * Changes vs v4.0:
 * - Glassmorphism node cards (matches home/network aesthetic)
 * - 4-colour department palette: Leadership / Revenue / Ops / Other
 * - Left dept accent bar (3px) replaces top gradient strip
 * - Tap-to-front: selected node gets elevated zIndex
 * - Dot-grid canvas background via ReactFlow <Background>
 * - Soft grey edges, no arrowheads
 *
 * Preserved from v4.0 (unchanged):
 * - All props/interfaces
 * - dagre layout logic
 * - Focus/dim logic
 * - Virtual root logic
 * - ReactFlow config
 * - forwardRef / imperative handle
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
  Connection,
  Background,
  BackgroundVariant,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { ExternalLink, Crosshair } from "lucide-react";
import { StoredContact, Department } from "@/lib/contactsStorage";

// ─── Colour system ────────────────────────────────────────────────────────────
// 4 meaningful groups instead of 7 rainbow colours.

type ColourGroup = "exec" | "revenue" | "ops" | "other";

const DEPT_TO_GROUP: Record<Department, ColourGroup> = {
  EXEC: "exec",
  SALES: "revenue",
  PROJECT_DELIVERY: "ops",
  OPS: "ops",
  FINANCE: "other",
  LEGAL: "other",
  UNKNOWN: "other",
};

interface ColourConfig {
  bar: string;
  avatarA: string;
  avatarB: string;
  dot: string;
  labelText: string;
  label: string;
}

const COLOUR_CONFIG: Record<ColourGroup, ColourConfig> = {
  exec: {
    bar: "#5856D6",
    avatarA: "#5856D6",
    avatarB: "#AF52DE",
    dot: "#5856D6",
    labelText: "#5856D6",
    label: "Leadership",
  },
  revenue: {
    bar: "#FF3B30",
    avatarA: "#FF3B30",
    avatarB: "#FF9500",
    dot: "#FF3B30",
    labelText: "#FF3B30",
    label: "Revenue",
  },
  ops: {
    bar: "#34C759",
    avatarA: "#34C759",
    avatarB: "#5AC8FA",
    dot: "#34C759",
    labelText: "#34C759",
    label: "Operations",
  },
  other: {
    bar: "#8E8E93",
    avatarA: "#8E8E93",
    avatarB: "#636366",
    dot: "#8E8E93",
    labelText: "#8E8E93",
    label: "Other",
  },
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ─── Contact Node ─────────────────────────────────────────────────────────────

interface ContactNodeData extends Record<string, unknown> {
  contact: StoredContact;
  onNodeClick?: (contact: StoredContact) => void;
  onOpenContact?: (contact: StoredContact) => void;
  onFocusContact?: (contact: StoredContact) => void;
  isDimmed?: boolean;
  isFocused?: boolean;
  isEditable?: boolean;
}

function ContactNode({ data, selected }: NodeProps<Node<ContactNodeData>>) {
  const { contact, onNodeClick, onOpenContact, onFocusContact } = data;
  const isDimmed = Boolean(data.isDimmed);
  const isFocused = Boolean(data.isFocused);

  const department = (contact.org?.department ?? "UNKNOWN") as Department;
  const group = DEPT_TO_GROUP[department];
  const col = COLOUR_CONFIG[group];
  const showDeptLabel = department !== "UNKNOWN";

  const handleClick = useCallback(() => {
    onNodeClick?.(contact);
  }, [contact, onNodeClick]);

  const handleOpenContact = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenContact?.(contact);
    },
    [contact, onOpenContact]
  );

  const handleFocusContact = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFocusContact?.(contact);
    },
    [contact, onFocusContact]
  );

  // Box shadow varies by state
  const cardShadow = selected
    ? "0 0 0 2px #007AFF, 0 8px 28px rgba(0,122,255,0.18), inset 0 1px 0 rgba(255,255,255,0.9)"
    : isFocused
    ? `0 0 0 2px ${col.bar}, 0 8px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)`
    : "0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)";

  return (
    <div
      className={`
        group relative cursor-pointer overflow-visible
        transition-all duration-200 ease-out
        ${isDimmed ? "opacity-20" : "opacity-100"}
        ${selected ? "scale-[1.03]" : "hover:scale-[1.01]"}
      `}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      onClick={handleClick}
      data-testid={`org-node-${contact.id}`}
    >
      {/* ReactFlow connection handle — top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-transparent !border-0"
        style={{ top: -6, opacity: 0 }}
      />

      {/* Glassmorphism card */}
      <div
        className="relative h-full rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.84)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "0.5px solid rgba(255,255,255,0.95)",
          boxShadow: cardShadow,
        }}
      >
        {/* Left dept accent bar */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-sm"
          style={{ background: col.bar }}
        />

        {/* Content */}
        <div className="flex items-center gap-2.5 h-full pl-4 pr-2.5 py-2.5">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${col.avatarA}, ${col.avatarB})`,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {getInitials(contact.name || "")}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p
              className="truncate leading-tight"
              style={{ fontSize: 12, fontWeight: 600, color: "#1C1C1E" }}
            >
              {contact.name || "Unknown"}
            </p>
            {contact.title && (
              <p
                className="truncate leading-tight mt-0.5"
                style={{ fontSize: 10, color: "#6C6C70" }}
              >
                {contact.title}
              </p>
            )}
            {showDeptLabel && (
              <div className="flex items-center gap-1 mt-1">
                <div
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{ background: col.dot }}
                />
                <span
                  className="uppercase tracking-wide"
                  style={{ fontSize: 9, fontWeight: 600, color: col.labelText }}
                >
                  {col.label}
                </span>
              </div>
            )}
          </div>

          {/* Hover actions */}
          <div className="flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 shrink-0">
            <button
              type="button"
              className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
              style={{ background: "rgba(0,0,0,0.05)" }}
              onClick={handleFocusContact}
              aria-label="Focus on contact"
            >
              <Crosshair className="w-3 h-3" style={{ color: "#6C6C70" }} />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
              style={{ background: "rgba(0,0,0,0.05)" }}
              onClick={handleOpenContact}
              aria-label="Open contact"
            >
              <ExternalLink className="w-3 h-3" style={{ color: "#6C6C70" }} />
            </button>
          </div>
        </div>
      </div>

      {/* ReactFlow connection handle — bottom */}
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

// ─── Graph builder ────────────────────────────────────────────────────────────

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
    nodesep: 48,
    ranksep: 72,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const contactIds = new Set(contacts.map((c) => c.id));
  const rootNodes = contacts.filter(
    (c) => !c.org?.reportsToId || !contactIds.has(c.org.reportsToId)
  );

  // Build focus set: ancestors + descendants of focusId
  const focusSet = new Set<string>();
  if (focusId && contactIds.has(focusId)) {
    const byId = new Map(contacts.map((c) => [c.id, c] as const));

    // Walk ancestors
    let current = byId.get(focusId);
    while (current) {
      focusSet.add(current.id);
      const managerId = current.org?.reportsToId;
      if (!managerId) break;
      current = byId.get(managerId);
    }

    // Walk descendants
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

  contacts.forEach((c) => g.setNode(c.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));

  const edges: Edge[] = [];
  contacts.forEach((contact) => {
    if (contact.org?.reportsToId && contactIds.has(contact.org.reportsToId)) {
      g.setEdge(contact.org.reportsToId, contact.id);

      const hasFocus = focusSet.size > 0;
      const inFocusEdge =
        hasFocus &&
        focusSet.has(contact.org.reportsToId) &&
        focusSet.has(contact.id);

      edges.push({
        id: `${contact.org.reportsToId}-${contact.id}`,
        source: contact.org.reportsToId,
        target: contact.id,
        type: "smoothstep",
        // No arrowheads — cleaner hierarchy visual
        style: {
          stroke: inFocusEdge ? "#007AFF" : "rgba(0,0,0,0.1)",
          strokeWidth: inFocusEdge ? 2 : 1.5,
          opacity: !hasFocus ? 1 : inFocusEdge ? 1 : 0.15,
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
    const pos = g.node(contact.id);
    const isSelected = hasFocus && contact.id === focusId;
    return {
      id: contact.id,
      type: "contact",
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      // Tap-to-front: focused node renders above all others
      zIndex: isSelected ? 10 : 1,
      data: {
        contact,
        onNodeClick,
        onOpenContact,
        onFocusContact,
        isDimmed: hasFocus && !focusSet.has(contact.id),
        isFocused: isSelected,
        isEditable: Boolean(editMode),
      },
    };
  });

  return { nodes, edges };
}

// ─── Canvas inner ─────────────────────────────────────────────────────────────

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

const OrgChartCanvasInner = forwardRef<OrgChartCanvasHandle, OrgChartCanvasInnerProps>(
  function OrgChartCanvasInner(
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
      () =>
        buildGraphWithLayout(
          contacts,
          onNodeClick,
          onOpenContact,
          onFocusContact,
          focusId,
          editMode
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

    useEffect(() => {
      const newGraph = buildGraphWithLayout(
        contacts,
        onNodeClick,
        onOpenContact,
        onFocusContact,
        focusId,
        editMode
      );
      setNodes(newGraph.nodes);
      setEdges(newGraph.edges);
    }, [contacts, onNodeClick, onOpenContact, onFocusContact, focusId, editMode, setNodes, setEdges]);

    const handleConnect = useCallback(
      (connection: Connection) => {
        if (!editMode || !onSetManager) return;
        if (connection.source && connection.target)
          onSetManager(connection.source, connection.target);
      },
      [editMode, onSetManager]
    );

    if (contacts.length === 0) return null;

    return (
      <div className="h-full w-full relative" data-testid="org-chart-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          onConnect={handleConnect}
          elementsSelectable
          panOnScroll
          zoomOnPinch
          preventScrolling={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="rgba(0,0,0,0.07)"
            style={{ background: "#F5F5FA" }}
          />
        </ReactFlow>
      </div>
    );
  }
);

// ─── Public export ────────────────────────────────────────────────────────────

interface OrgChartCanvasProps {
  contacts: StoredContact[];
  onNodeClick?: (contact: StoredContact) => void;
  onOpenContact?: (contact: StoredContact) => void;
  onFocusContact?: (contact: StoredContact) => void;
  onSetManager?: (sourceId: string, targetId: string) => void;
  editMode?: boolean;
  focusId?: string | null;
}

export const OrgChartCanvas = forwardRef<OrgChartCanvasHandle, OrgChartCanvasProps>(
  function OrgChartCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <OrgChartCanvasInner ref={ref} {...props} />
      </ReactFlowProvider>
    );
  }
);
