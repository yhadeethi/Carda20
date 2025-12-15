/**
 * FilterSheet - Bottom sheet for People filters
 * Replaces visible filter chips with a clean slide-up sheet
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
import { Department, InfluenceLevel } from "@/lib/contactsStorage";

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

const INFLUENCE_LABELS: Record<InfluenceLevel | 'ANY', string> = {
  ANY: 'Any',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  UNKNOWN: 'Unknown',
};

const INFLUENCE_ORDER: (InfluenceLevel | 'ANY')[] = ['ANY', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

interface FilterState {
  department: Department | 'ALL';
  influence: InfluenceLevel | 'ANY';
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
    setLocalFilters({ department: 'ALL', influence: 'ANY' });
  };

  const isDefault = localFilters.department === 'ALL' && localFilters.influence === 'ANY';

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

          {/* Influence Filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Influence Level</label>
            <div className="flex flex-wrap gap-2">
              {INFLUENCE_ORDER.map((level) => (
                <FilterChip
                  key={level}
                  selected={localFilters.influence === level}
                  onClick={() => setLocalFilters(f => ({ ...f, influence: level }))}
                  data-testid={`filter-chip-influence-${level.toLowerCase()}`}
                >
                  {INFLUENCE_LABELS[level]}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* Actions Section */}
          {(onAutoGroup || onEditOrg) && (
            <div className="space-y-3 pt-2 border-t">
              <label className="text-sm font-medium text-muted-foreground">Actions</label>
              <div className="flex gap-2 flex-wrap">
                {onAutoGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onAutoGroup();
                      onOpenChange(false);
                    }}
                    data-testid="button-auto-group-sheet"
                  >
                    Auto-group
                  </Button>
                )}
                {onEditOrg && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onEditOrg();
                      onOpenChange(false);
                    }}
                    data-testid="button-edit-org-sheet"
                  >
                    Edit Org
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleClear}
            disabled={isDefault}
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
          <Button
            className="flex-1"
            onClick={handleApply}
            data-testid="button-apply-filters"
          >
            Apply
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// Reusable filter chip component
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
      variant={selected ? 'default' : 'outline'}
      className="cursor-pointer h-8 px-3 gap-1"
      onClick={onClick}
      {...props}
    >
      {selected && <Check className="w-3 h-3" />}
      {children}
    </Badge>
  );
}

// Helper to get filter summary text
export function getFilterSummary(filters: FilterState): string {
  const parts: string[] = [];
  
  if (filters.department === 'ALL') {
    parts.push('All');
  } else {
    parts.push(DEPARTMENT_LABELS[filters.department]);
  }
  
  if (filters.influence !== 'ANY') {
    parts.push(`${INFLUENCE_LABELS[filters.influence]} influence`);
  }
  
  return parts.join(' · ');
}
