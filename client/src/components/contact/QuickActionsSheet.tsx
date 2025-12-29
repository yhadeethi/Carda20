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
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs>
      <DrawerContent className="rounded-t-3xl" data-testid="quick-actions-sheet">
        <DrawerHeader className="flex items-center justify-between text-left">
          <DrawerTitle>Quick Actions</DrawerTitle>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost" type="button" className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="quick-actions-grid">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => {
                    try {
                      action.onClick();
                    } catch (err) {
                      console.error("[QuickActionsSheet] action failed:", action.id, err);
                    }
                  }, 120);
                }}
                className={[
                  "group relative overflow-hidden",
                  "flex flex-col items-center justify-center gap-2.5",
                  "p-4 rounded-2xl min-h-[104px]",
                  "border border-white/10",
                  "bg-white/8 dark:bg-white/5",
                  "backdrop-blur-2xl shadow-sm",
                  "transition-all active:scale-[0.985]",
                  "hover:bg-white/12 dark:hover:bg-white/8",
                ].join(" ")}
                data-testid={`action-tile-${action.id}`}
              >
                <div
                  className={[
                    "w-11 h-11 rounded-2xl",
                    "border border-white/12",
                    "bg-white/10 dark:bg-white/6",
                    "backdrop-blur-xl",
                    "flex items-center justify-center",
                    "text-foreground/90",
                    "transition-all group-hover:scale-[1.03]",
                  ].join(" ")}
                >
                  {action.icon}
                </div>

                <span className="text-sm font-semibold text-center leading-tight">
                  {action.label}
                </span>

                {action.status && (
                  <Badge
                    variant="secondary"
                    className={
                      action.status.includes("Synced")
                        ? "bg-foreground/10 text-foreground text-xs"
                        : "bg-foreground/5 text-muted-foreground text-xs"
                    }
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
