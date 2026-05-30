import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  ScrollView,
} from "react-native-gesture-handler";
import Svg, { Line, Path, Rect, Circle, Text as SvgText } from "react-native-svg";
import type { Contact } from "@/lib/api";

const NODE_W = 168;
const NODE_H = 68;
const H_GAP = 24;
const V_GAP = 56;
const AVATAR_R = 18;
const DEPT_BAR_H = 4;
const PADDING = 24;

type Department =
  | "EXEC"
  | "SALES"
  | "OPS"
  | "FINANCE"
  | "LEGAL"
  | "PROJECT_DELIVERY"
  | "UNKNOWN";

const DEPT_COLOR: Record<string, string> = {
  EXEC: "#5856D6",
  SALES: "#FF3B30",
  OPS: "#34C759",
  FINANCE: "#F59E0B",
  LEGAL: "#6366F1",
  PROJECT_DELIVERY: "#00C7BE",
  UNKNOWN: "#8E8E93",
};

function getDeptColor(dept?: string | null): string {
  return DEPT_COLOR[(dept ?? "UNKNOWN").toUpperCase()] ?? DEPT_COLOR.UNKNOWN;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

interface LayoutPos {
  x: number;
  y: number;
}

function computeLayout(contacts: Contact[]): {
  positions: Map<number, LayoutPos>;
  width: number;
  height: number;
} {
  if (contacts.length === 0) return { positions: new Map(), width: 0, height: 0 };

  const contactIds = new Set(contacts.map((c) => c.id));
  const childrenMap = new Map<number | "root", number[]>();
  childrenMap.set("root", []);

  contacts.forEach((c) => {
    const parentId =
      c.orgReportsToId != null && contactIds.has(c.orgReportsToId)
        ? c.orgReportsToId
        : "root";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(c.id);
  });

  function subtreeWidth(id: number): number {
    const kids = childrenMap.get(id) ?? [];
    if (kids.length === 0) return NODE_W;
    const total = kids.reduce(
      (sum, k) => sum + subtreeWidth(k) + H_GAP,
      -H_GAP
    );
    return Math.max(NODE_W, total);
  }

  const positions = new Map<number, LayoutPos>();

  function assignPos(id: number, cx: number, y: number) {
    positions.set(id, { x: cx - NODE_W / 2, y });
    const kids = childrenMap.get(id) ?? [];
    const total = kids.reduce(
      (sum, k) => sum + subtreeWidth(k) + H_GAP,
      -H_GAP
    );
    let curX = cx - total / 2;
    kids.forEach((kid) => {
      const sw = subtreeWidth(kid);
      assignPos(kid, curX + sw / 2, y + NODE_H + V_GAP);
      curX += sw + H_GAP;
    });
  }

  const roots = childrenMap.get("root") ?? [];
  const totalRoots = roots.reduce(
    (sum, r) => sum + subtreeWidth(r) + H_GAP,
    -H_GAP
  );
  let rx = -totalRoots / 2;
  roots.forEach((r) => {
    const sw = subtreeWidth(r);
    assignPos(r, rx + sw / 2, 0);
    rx += sw + H_GAP;
  });

  let minX = Infinity,
    minY = Infinity;
  positions.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  });

  const normalized = new Map<number, LayoutPos>();
  let maxX = 0,
    maxY = 0;
  positions.forEach((p, id) => {
    const nx = p.x - minX + PADDING;
    const ny = p.y - minY + PADDING;
    normalized.set(id, { x: nx, y: ny });
    maxX = Math.max(maxX, nx + NODE_W);
    maxY = Math.max(maxY, ny + NODE_H);
  });

  return {
    positions: normalized,
    width: maxX + PADDING,
    height: maxY + PADDING,
  };
}

interface OrgChartTreeProps {
  contacts: Contact[];
  onNodePress?: (contact: Contact) => void;
}

export function OrgChartTree({ contacts, onNodePress }: OrgChartTreeProps) {
  const screen = Dimensions.get("window");
  const { positions, width, height } = useMemo(
    () => computeLayout(contacts),
    [contacts]
  );

  const byId = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts]
  );

  const contactIds = useMemo(
    () => new Set(contacts.map((c) => c.id)),
    [contacts]
  );

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(3, Math.max(0.25, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .minDistance(1)
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (contacts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No contacts to chart</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: screen.width, height: "100%" }]}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width, height }, animStyle]}>
          <Svg width={width} height={height}>
            {contacts.map((c) => {
              if (
                c.orgReportsToId == null ||
                !contactIds.has(c.orgReportsToId)
              )
                return null;
              const child = positions.get(c.id);
              const parent = positions.get(c.orgReportsToId);
              if (!child || !parent) return null;

              const sx = parent.x + NODE_W / 2;
              const sy = parent.y + NODE_H;
              const tx = child.x + NODE_W / 2;
              const ty = child.y;
              const my = (sy + ty) / 2;

              return (
                <Path
                  key={`edge-${c.id}`}
                  d={`M ${sx} ${sy} C ${sx} ${my} ${tx} ${my} ${tx} ${ty}`}
                  stroke="rgba(0,0,0,0.15)"
                  strokeWidth={1.5}
                  fill="none"
                />
              );
            })}

            {contacts.map((c) => {
              const pos = positions.get(c.id);
              if (!pos) return null;
              const deptColor = getDeptColor(c.orgDepartment);
              const displayName = c.fullName || c.email || "Unknown";
              const initials = getInitials(displayName);
              const { x, y } = pos;
              const cx = x + NODE_W / 2;
              const avatarCX = x + AVATAR_R + 10;
              const avatarCY = y + NODE_H / 2;

              return (
                <React.Fragment key={`node-${c.id}`}>
                  <Rect
                    x={x}
                    y={y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={12}
                    ry={12}
                    fill="white"
                    stroke="rgba(0,0,0,0.08)"
                    strokeWidth={1}
                  />
                  <Rect
                    x={x}
                    y={y}
                    width={NODE_W}
                    height={DEPT_BAR_H}
                    rx={12}
                    ry={12}
                    fill={deptColor}
                  />
                  <Rect
                    x={x}
                    y={y + DEPT_BAR_H - 2}
                    width={NODE_W}
                    height={4}
                    fill={deptColor}
                  />
                  <Circle cx={avatarCX} cy={avatarCY} r={AVATAR_R} fill={deptColor} />
                  <SvgText
                    x={avatarCX}
                    y={avatarCY + 5}
                    fontSize={11}
                    fontWeight="700"
                    fill="white"
                    textAnchor="middle"
                  >
                    {initials}
                  </SvgText>
                  <SvgText
                    x={avatarCX + AVATAR_R + 6}
                    y={y + DEPT_BAR_H + 16}
                    fontSize={11}
                    fontWeight="600"
                    fill="#1C1C1E"
                  >
                    {truncate(displayName, 16)}
                  </SvgText>
                  {c.jobTitle ? (
                    <SvgText
                      x={avatarCX + AVATAR_R + 6}
                      y={y + DEPT_BAR_H + 31}
                      fontSize={9.5}
                      fill="#6C6C70"
                    >
                      {truncate(c.jobTitle, 18)}
                    </SvgText>
                  ) : null}
                  {onNodePress && (
                    <Rect
                      x={x}
                      y={y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={12}
                      ry={12}
                      fill="transparent"
                      onPress={() => onNodePress(c)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>
      </GestureDetector>

      <View style={styles.hint}>
        <Text style={styles.hintText}>Pinch to zoom · drag to pan · tap node to open</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: { fontSize: 14, color: "#8E8E93" },
  hint: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  hintText: { fontSize: 10, color: "#8E8E93", opacity: 0.7 },
});
