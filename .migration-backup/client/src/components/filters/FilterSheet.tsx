/**
 * FilterSheet - Bottom sheet for People filters
 * Clean department-only filtering
 */

import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Department } from "@/lib/contactsStorage";

// Department display names
const DEPARTMENT_LABELS: Record<Department, string> = {
  EXEC: 'Exec',
  LEGAL: 'Legal',
  PROJECT_DELIVERY: 'Project Delivery',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OPS: 'Ops',
  UNKNOWN: 'Unknown',
};

const DEPARTMENT_ORDER: Department[] = ['EXEC', 'LEGAL', 'PROJECT_DELIVERY', 'SALES', 'FINANCE', 'OPS', 'UNKNOWN'];

interface FilterState {
  department: Department | 'ALL';
}

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onAutoGroup?: () => void;
  onEditOrg?: () => void;
}

export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  onAutoGroup,
  onEditOrg,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  // Sync local state when sheet opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalFilters({ department: 'ALL' });
  };

  const isDefault = localFilters.department === 'ALL';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filter People</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6">
          {/* Department Filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Department</label>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                selected={localFilters.department === 'ALL'}
                onClick={() => setLocalFilters(f => ({ ...f, department: 'ALL' }))}
                data-testid="filter-chip-all"
              >
                All
              </FilterChip>
              {DEPARTMENT_ORDER.map((dept) => (
                <FilterChip
                  key={dept}
                  selected={localFilters.department === dept}
                  onClick={() => setLocalFilters(f => ({ ...f, department: dept }))}
                  data-testid={`filter-chip-${dept.toLowerCase()}`}
                >
                  {DEPARTMENT_LABELS[dept]}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          {(onAutoGroup || onEditOrg) && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Quick Actions</label>
              <div className="flex flex-wrap gap-2">
                {onAutoGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onAutoGroup();
                      onOpenChange(false);
                    }}
                    data-testid="button-auto-group"
                  >
                    Auto-group by title
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2">
          {!isDefault && (
            <Button variant="ghost" onClick={handleClear} className="flex-1">
              Clear
            </Button>
          )}
          <DrawerClose asChild>
            <Button onClick={handleApply} className="flex-1" data-testid="button-apply-filters">
              Apply
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// Filter chip component
function FilterChip({
  selected,
  onClick,
  children,
  ...props
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  'data-testid'?: string;
}) {
  return (
    <Badge
      variant={selected ? "default" : "outline"}
      className={`cursor-pointer transition-all ${
        selected ? 'gap-1' : 'hover:bg-muted'
      }`}
      onClick={onClick}
      {...props}
    >
      {selected && <Check className="w-3 h-3" />}
      {children}
    </Badge>
  );
}

// Helper to generate filter summary text
export function getFilterSummary(filters: FilterState): string {
  const parts: string[] = [];
  
  if (filters.department !== 'ALL') {
    parts.push(DEPARTMENT_LABELS[filters.department]);
  }
  
  if (parts.length === 0) {
    return 'All';
  }
  
  return parts.join(', ');
}
