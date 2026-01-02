/**
 * HierarchyList - iOS 26-style collapsible org hierarchy
 * Features:
 * - Collapsible tree with smooth animations
 * - Avatar, name, title, department pill per row
 * - Bottom sheet for editing reporting lines
 *
 * IMPORTANT:
 * This version writes org changes via V2 storage (updateContactV2),
 * which also mirrors to V1 (compat) so the rest of the UI stays consistent.
 */

import { useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ExternalLink, Users } from "lucide-react";
import { StoredContact, Department, DEFAULT_ORG } from "@/lib/contactsStorage";
import { updateContactV2 } from "@/lib/contacts/storage";
import { useToast } from "@/hooks/use-toast";

interface HierarchyListProps {
  contacts: StoredContact[];
  onContactUpdate: () => void;
  onSelectContact: (contact: StoredContact) => void;
}

const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: "Exec",
  LEGAL: "Legal",
  PROJECT_DELIVERY: "Delivery",
  SALES: "Sales",
  FINANCE: "Finance",
  OPS: "Ops",
  UNKNOWN: "",
};

const DEPARTMENT_COLORS: Record<Department, string> = {
  EXEC: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  LEGAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PROJECT_DELIVERY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  SALES: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  FINANCE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  OPS: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  UNKNOWN: "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
};

interface TreeNode {
  contact: StoredContact;
  children: TreeNode[];
  depth: number;
}

function buildHierarchy(contacts: StoredContact[]): TreeNode[] {
  const contactMap = new Map<string, StoredContact>();
  contacts.forEach((c) => contactMap.set(c.id, c));

  const childrenMap = new Map<string, StoredContact[]>();
  const rootContacts: StoredContact[] = [];

  contacts.forEach((contact) => {
    const managerId = contact.org?.reportsToId;
    if (managerId && contactMap.has(managerId)) {
      const existing = childrenMap.get(managerId) || [];
      existing.push(contact);
      childrenMap.set(managerId, existing);
    } else {
      rootContacts.push(contact);
    }
  });

  const buildNode = (contact: StoredContact, depth: number): TreeNode => {
    const directReports = childrenMap.get(contact.id) || [];
    return {
      contact,
      children: directReports.map((c) => buildNode(c, depth + 1)),
      depth,
    };
  };

  return rootContacts.map((c) => buildNode(c, 0));
}

interface HierarchyRowProps {
  node: TreeNode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTap: () => void;
  hasChildren: boolean;
}

const HierarchyRow = memo(function HierarchyRow({
  node,
  isExpanded,
  onToggleExpand,
  onTap,
  hasChildren,
}: HierarchyRowProps) {
  const { contact, depth } = node;
  const department = contact.org?.department || "UNKNOWN";
  const initials =
    contact.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <motion.div
      className="flex items-center gap-3 py-3 px-3 rounded-xl active:scale-[0.98] active:opacity-80 transition-all duration-150 cursor-pointer hover:bg-muted/50"
      style={{ paddingLeft: `${12 + depth * 24}px` }}
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      data-testid={`hierarchy-row-${contact.id}`}
    >
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted/80 transition-colors"
          data-testid={`expand-toggle-${contact.id}`}
        >
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </button>
      ) : (
        <div className="w-6" />
      )}

      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/70 to-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0 shadow-sm">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] truncate">{contact.name}</div>
        {contact.title && <div className="text-xs text-muted-foreground truncate">{contact.title}</div>}
      </div>

      {department !== "UNKNOWN" && DEPARTMENT_LABELS[department] && (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 shrink-0 ${DEPARTMENT_COLORS[department]}`}>
          {DEPARTMENT_LABELS[department]}
        </Badge>
      )}
    </motion.div>
  );
});

function HierarchyTree({
  nodes,
  expandedIds,
  onToggleExpand,
  onTapContact,
}: {
  nodes: TreeNode[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onTapContact: (contact: StoredContact) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.contact.id);
        const hasChildren = node.children.length > 0;

        return (
          <div key={node.contact.id}>
            <HierarchyRow
              node={node}
              isExpanded={isExpanded}
              onToggleExpand={() => onToggleExpand(node.contact.id)}
              onTap={() => onTapContact(node.contact)}
              hasChildren={hasChildren}
            />
            <AnimatePresence>
              {isExpanded && hasChildren && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <HierarchyTree
                    nodes={node.children}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    onTapContact={onTapContact}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
}

export function HierarchyList({ contacts, onContactUpdate, onSelectContact }: HierarchyListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<StoredContact | null>(null);
  const { toast } = useToast();

  const hierarchy = useMemo(() => buildHierarchy(contacts), [contacts]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTapContact = useCallback((contact: StoredContact) => {
    setEditingContact(contact);
  }, []);

  const handleSetReportsTo = useCallback(
    (managerId: string | null) => {
      if (!editingContact) return;

      if (managerId === editingContact.id) {
        toast({ title: "Cannot report to self", variant: "destructive" });
        return;
      }

      // Cycle check
      if (managerId) {
        const visited = new Set<string>();
        let current = managerId;
        while (current) {
          if (visited.has(current)) break;
          if (current === editingContact.id) {
            toast({ title: "This would create a cycle", variant: "destructive" });
            return;
          }
          visited.add(current);
          const manager = contacts.find((c) => c.id === current);
          current = manager?.org?.reportsToId || "";
        }
      }

      const nextOrg = {
        ...(editingContact.org || DEFAULT_ORG),
        reportsToId: managerId,
      };

      updateContactV2(editingContact.id, { org: nextOrg });
      onContactUpdate();
      setEditingContact(null);
      toast({ title: "Reporting line updated" });
    },
    [editingContact, contacts, onContactUpdate, toast]
  );

  const directReports = useMemo(() => {
    if (!editingContact) return [];
    return contacts.filter((c) => c.org?.reportsToId === editingContact.id);
  }, [editingContact, contacts]);

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <Users className="w-12 h-12 mb-3 opacity-50" />
        <p className="font-medium">No people yet</p>
        <p className="text-sm mt-1">Scan a business card to add contacts</p>
      </div>
    );
  }

  const hasAnyReportingLines = contacts.some((c) => c.org?.reportsToId);

  return (
    <div className="h-full flex flex-col">
      {!hasAnyReportingLines && (
        <div className="px-4 py-3 bg-muted/40 rounded-xl mb-3 text-center">
          <p className="text-sm text-muted-foreground">No reporting lines yet. Tap a person to set who they report to.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        <HierarchyTree nodes={hierarchy} expandedIds={expandedIds} onToggleExpand={toggleExpand} onTapContact={handleTapContact} />
      </div>

      <Drawer open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/70 to-primary flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0 shadow-lg shadow-primary/20">
                {editingContact?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-xl font-bold truncate">{editingContact?.name || "Contact"}</DrawerTitle>
                {editingContact?.title && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{editingContact.title}</p>
                )}
              </div>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reports To</label>
              <Select
                value={editingContact?.org?.reportsToId || "_none"}
                onValueChange={(value) => handleSetReportsTo(value === "_none" ? null : value)}
              >
                <SelectTrigger className="h-12" data-testid="select-reports-to">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {contacts
                    .filter((c) => c.id !== editingContact?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.title ? `· ${c.title}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {directReports.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Direct Reports ({directReports.length})
                </label>
                <div className="space-y-1.5 bg-muted/30 rounded-xl p-2">
                  {directReports.map((dr) => (
                    <div key={dr.id} className="flex items-center gap-2 py-2 px-2.5 rounded-lg bg-background/50">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                        {dr.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm truncate">{dr.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DrawerFooter className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                if (editingContact) {
                  onSelectContact(editingContact);
                  setEditingContact(null);
                }
              }}
              data-testid="button-open-contact"
            >
              <ExternalLink className="w-4 h-4" />
              Open Contact
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
