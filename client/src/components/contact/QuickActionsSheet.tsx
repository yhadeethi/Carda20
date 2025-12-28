import { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface QuickAction {
  id: string;
  label: string;
  icon: ReactNode;
  status?: string;
  onClick: () => void;
}

interface QuickActionsSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actions: QuickAction[];
}

export function QuickActionsSheet({ open, onOpenChange, actions }: QuickActionsSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background/60 backdrop-blur-2xl border border-white/10 rounded-t-2xl">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle>Quick Actions</DrawerTitle>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost">
              <X className="w-4 h-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="px-4 pb-8">
          <div
            className="grid grid-cols-2 md:grid-cols-3 gap-3"
            data-testid="quick-actions-grid"
          >
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  action.onClick();
                  onOpenChange(false);
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-muted/30 hover-elevate active-elevate-2 transition-all min-h-[100px]"
                data-testid={`action-tile-${action.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {action.icon}
                </div>
                <span className="text-sm font-medium text-center">{action.label}</span>
                {action.status && (
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      action.status.includes("Synced")
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {action.status}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
