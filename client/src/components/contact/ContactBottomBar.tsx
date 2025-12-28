import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Download, Check, Zap, RefreshCw, Eye } from "lucide-react";

interface ContactBottomBarProps {
  isSaved: boolean;
  onSave: () => void;
  onQuickActions: () => void;
  onUpdate?: () => void;
  onViewInContacts?: () => void;
}

export function ContactBottomBar({
  isSaved,
  onSave,
  onQuickActions,
  onUpdate,
  onViewInContacts,
}: ContactBottomBarProps) {
  const [showSavedMenu, setShowSavedMenu] = useState(false);

  const handlePrimaryClick = () => {
    if (isSaved) {
      setShowSavedMenu(true);
    } else {
      onSave();
    }
  };

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        data-testid="contact-bottom-bar"
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Primary Save Button */}
          <Button
            onClick={handlePrimaryClick}
            className="flex-1 gap-2"
            variant={isSaved ? "secondary" : "default"}
            data-testid="button-save-contact"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Save to Phone
              </>
            )}
          </Button>

          {/* Quick Actions Pill */}
          <Button
            onClick={onQuickActions}
            variant="outline"
            className="gap-2 bg-background/60 backdrop-blur-xl border-white/10"
            data-testid="button-quick-actions"
          >
            <Zap className="w-4 h-4" />
            Quick Actions
          </Button>
        </div>
      </div>

      {/* Saved Menu Drawer */}
      <Drawer open={showSavedMenu} onOpenChange={setShowSavedMenu}>
        <DrawerContent className="bg-background/60 backdrop-blur-2xl border-white/10">
          <DrawerHeader>
            <DrawerTitle>Contact Options</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowSavedMenu(false);
                onUpdate?.();
              }}
              data-testid="button-update-contact"
            >
              <RefreshCw className="w-4 h-4" />
              Update contact
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowSavedMenu(false);
                onViewInContacts?.();
              }}
              data-testid="button-view-in-contacts"
            >
              <Eye className="w-4 h-4" />
              View in contacts
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full mt-2">
                Cancel
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
