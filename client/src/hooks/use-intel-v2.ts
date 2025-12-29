import { useState, useCallback, useRef, useEffect } from "react";
import { CompanyIntelV2 } from "@shared/schema";

// Cache version - increment this to invalidate all old cached intel data
// v2: Added sales signals support (Dec 2025)
const CACHE_VERSION = 2;
const CACHE_KEY_PREFIX = `intel-v2-v${CACHE_VERSION}-`;
const CACHE_TTL_DAYS = 7;

interface CachedIntel {
  intel: CompanyIntelV2;
  cachedAt: number;
  version?: number;
}

const memoryCache = new Map<string, CachedIntel>();

// Clean up old cache entries on module load
function cleanupOldCache() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("intel-v2-") && !key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[IntelCache] Cleaned up ${keysToRemove.length} old cache entries`);
    }
  } catch {
    // ignore errors
  }
}

// Run cleanup once on module load
cleanupOldCache();

function getCacheKey(companyName: string, domain?: string | null): string {
  const base = (companyName || domain || "unknown").toLowerCase().trim();
  const key = base.replace(/\s+/g, "-");
  return `${CACHE_KEY_PREFIX}${key}`;
}

function isExpired(cachedAt: number): boolean {
  const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - cachedAt > maxAgeMs;
}

function getFromCache(cacheKey: string): CompanyIntelV2 | null {
  // memory first
  const mem = memoryCache.get(cacheKey);
  if (mem && !isExpired(mem.cachedAt)) return mem.intel;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed: CachedIntel = JSON.parse(raw);

    if (!parsed?.intel || !parsed?.cachedAt) return null;
    if (isExpired(parsed.cachedAt)) {
      localStorage.removeItem(cacheKey);
      memoryCache.delete(cacheKey);
      return null;
    }

    memoryCache.set(cacheKey, parsed);
    return parsed.intel;
  } catch {
    return null;
  }
}

function saveToCache(cacheKey: string, intel: CompanyIntelV2): void {
  const payload: CachedIntel = { intel, cachedAt: Date.now() };
  memoryCache.set(cacheKey, payload);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // ignore storage quota issues
  }
}

export function useIntelV2() {
  const [intel, setIntel] = useState<CompanyIntelV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchKey = useRef<string | null>(null);

  const fetchIntel = useCallback(
    async (
      companyName: string | null,
      domain?: string | null,
      role?: string | null,
      address?: string | null,
      forceRefresh = false
    ) => {
      if (!companyName && !domain) {
        setError("Company name or domain required");
        return;
      }

      const cacheKey = getCacheKey(companyName || "", domain);

      if (!forceRefresh) {
        const cached = getFromCache(cacheKey);
        if (cached) {
          setIntel(cached);
          lastFetchKey.current = cacheKey;
          return;
        }

        // If we already fetched this exact key and have intel, don’t do it again.
        if (lastFetchKey.current === cacheKey && intel) return;
      } else {
        try {
          localStorage.removeItem(cacheKey);
        } catch {}
        memoryCache.delete(cacheKey);
      }

      setIsLoading(true);
      setError(null);
      lastFetchKey.current = cacheKey;

      try {
        const params = new URLSearchParams();
        if (companyName) params.append("companyName", companyName);
        if (domain) params.append("domain", domain);
        if (role) params.append("role", role);
        if (address) params.append("address", address);

        const response = await fetch(`/api/intel-v2?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch intel");

        const data: CompanyIntelV2 = await response.json();
        saveToCache(cacheKey, data);
        setIntel(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch intel");
      } finally {
        setIsLoading(false);
      }
    },
    [intel]
  );

  const boostIntel = useCallback(async (_domain: string) => {
    // you said boost is useless — keeping function for compatibility but disabling behavior.
    setIsBoosting(false);
    return false;
  }, []);

  const reset = useCallback(() => {
    // Don’t wipe local caches. Just clear UI state.
    setIntel(null);
    setError(null);
    setIsLoading(false);
    setIsBoosting(false);
    lastFetchKey.current = null;
  }, []);

  return {
    intel,
    isLoading,
    isBoosting,
    error,
    fetchIntel,
    boostIntel,
    reset,
  };
}
