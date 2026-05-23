import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users } from "lucide-react";
import { VCFImportResult, ParsedVCFContact } from "@/lib/contacts/importVCF";
import { saveContact } from "@/lib/contactsStorage";

interface ImportVCFReviewSheetProps {
  open: boolean;
  result: VCFImportResult | null;
  onConfirm: (importedCount: number) => void;
  onCancel: () => void;
}

export function ImportVCFReviewSheet({ open, result, onConfirm, onCancel }: ImportVCFReviewSheetProps) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handleConfirm = async () => {
    if (!result || result.toImport.length === 0) return;
    setImporting(true);
    let count = 0;
    for (const c of result.toImport) {
      try {
        saveContact({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company || "",
          title: c.title || "",
          address: c.address || "",
          website: "",
          linkedinUrl: "",
          eventName: null,
        }, null);
        count++;
      } catch {}
    }
    setImportedCount(count);
    setImporting(false);
    setDone(true);
  };

  const handleClose = () => {
    if (done) onConfirm(importedCount);
    else onCancel();
    setTimeout(() => { setDone(false); setImporting(false); setImportedCount(0); }, 300);
  };

  const toImport = result?.toImport ?? [];
  const summaryLine = result
    ? `${result.passed} contact${result.passed !== 1 ? "s" : ""} ready to import · ${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} skipped`
    : "";

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o && !importing) handleClose(); }}>
      <SheetContent side="bottom" className="p-0 max-h-[85vh] flex flex-col">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <SheetHeader><SheetTitle>Import contacts</SheetTitle></SheetHeader>
          {result && !done && (
            <p className="text-sm text-muted-foreground mt-1">{summaryLine}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{importedCount} contact{importedCount !== 1 ? "s" : ""} imported</p>
                <p className="text-sm text-muted-foreground mt-1">They're now in your Carda network.</p>
              </div>
            </div>
          ) : toImport.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No new contacts to import</p>
              <p className="text-xs text-muted-foreground/70">All contacts are duplicates or missing required fields.</p>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {toImport.slice(0, 100).map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {c.name.split(" ").filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join("")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{[c.company, c.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
              {toImport.length > 100 && (
                <p className="text-xs text-muted-foreground/60 text-center py-2">+{toImport.length - 100} more</p>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pb-8 pt-3 shrink-0 border-t border-border/50 space-y-2">
          {done ? (
            <Button onClick={handleClose} variant="gradient" className="w-full rounded-xl">Done</Button>
          ) : toImport.length > 0 ? (
            <>
              <Button onClick={handleConfirm} disabled={importing} variant="gradient" className="w-full rounded-xl">
                {importing ? "Importing…" : `Import ${toImport.length} contact${toImport.length !== 1 ? "s" : ""}`}
              </Button>
              <Button onClick={handleClose} variant="ghost" disabled={importing} className="w-full rounded-xl text-muted-foreground">Cancel</Button>
            </>
          ) : (
            <Button onClick={handleClose} variant="outline" className="w-full rounded-xl">Close</Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
