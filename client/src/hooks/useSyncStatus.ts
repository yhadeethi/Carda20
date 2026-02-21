import { useState, useEffect, useCallback } from "react";
import { getFailedCount, subscribeSyncQueue, retryFailedItems } from "@/lib/syncQueue";

export function useSyncStatus() {
  const [failedCount, setFailedCount] = useState(() => getFailedCount());

  useEffect(() => {
    const unsubscribe = subscribeSyncQueue(() => {
      setFailedCount(getFailedCount());
    });
    return unsubscribe;
  }, []);

  const retry = useCallback(() => {
    retryFailedItems();
  }, []);

  return { failedCount, retry };
}
