/**
 * Batch Scan Mode
 * Quick capture multiple business cards for batch processing
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Camera, X, Play, Trash2, ImagePlus, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  QueuedScan,
  loadBatchSession,
  startBatchSession,
  addToQueue,
  removeFromQueue,
  getAllQueueItems,
  clearBatchSession,
  getSessionSummary,
} from "@/lib/batchScanStorage";
import { compressImageForOCR } from "@/lib/imageUtils";

interface BatchScanModeProps {
  eventName: string;
  onProcess: (items: QueuedScan[]) => void;
  onExit: () => void;
}

export function BatchScanMode({ eventName, onProcess, onExit }: BatchScanModeProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueuedScan[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    let session = loadBatchSession();
    if (!session || session.eventName !== eventName) {
      session = startBatchSession(eventName);
    }
    setItems(getAllQueueItems());
  }, [eventName]);

  const handleCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCapturing(true);

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageForOCR(file);
        const reader = new FileReader();
        
        await new Promise<void>((resolve, reject) => {
          reader.onload = async (event) => {
            const imageData = event.target?.result as string;
            const item = await addToQueue(imageData);
            if (item) {
              setItems(prev => [...prev, item]);
            }
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(compressed.file);
        });
      } catch (err) {
        console.error("[BatchScan] Failed to add image:", err);
        toast({
          title: "Failed to add image",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    }

    // Sync state from storage to ensure consistency
    setItems(getAllQueueItems());
    setIsCapturing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [toast]);

  const handleRemove = useCallback((itemId: string) => {
    removeFromQueue(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
    toast({ title: "Card removed" });
  }, [toast]);

  const handleClear = useCallback(() => {
    clearBatchSession();
    startBatchSession(eventName);
    setItems([]);
    setShowClearConfirm(false);
    toast({ title: "Queue cleared" });
  }, [eventName, toast]);

  const handleProcess = useCallback(() => {
    // Re-read from storage to ensure we have latest data
    const currentItems = getAllQueueItems();
    if (currentItems.length === 0) {
      toast({ title: "No cards to process", variant: "destructive" });
      return;
    }
    onProcess(currentItems);
  }, [onProcess, toast]);

  const summary = getSessionSummary();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-batch-capture"
      />

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all cards?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {items.length} captured cards from the queue. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="glass">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="gap-1 -ml-2"
              data-testid="button-exit-batch"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Batch Mode
            </Button>
            <Badge variant="secondary" className="text-xs">
              {eventName}
            </Badge>
          </div>

          <div className="text-center py-2">
            <h2 className="text-lg font-semibold">Batch Capture</h2>
            <p className="text-sm text-muted-foreground">
              Snap multiple cards, then process all at once
            </p>
          </div>

          <Button
            onClick={handleCapture}
            disabled={isCapturing}
            className="w-full h-16 text-lg"
            data-testid="button-batch-capture"
          >
            {isCapturing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Capture Card
              </>
            )}
          </Button>

          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {items.length} card{items.length !== 1 ? 's' : ''} captured
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid="button-clear-queue"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>

              <ScrollArea className="h-[200px]">
                <div className="grid grid-cols-4 gap-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="relative aspect-[3/4] rounded-md overflow-hidden border bg-muted group"
                      data-testid={`batch-item-${item.id}`}
                    >
                      <img
                        src={item.thumbnail}
                        alt="Captured card"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-${item.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {item.status !== 'pending' && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5">
                          {item.status}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                onClick={handleProcess}
                className="w-full"
                size="lg"
                data-testid="button-process-batch"
              >
                <Play className="mr-2 h-4 w-4" />
                Process {items.length} Card{items.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ImagePlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No cards captured yet</p>
              <p className="text-xs mt-1">Tap "Capture Card" to start scanning</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
