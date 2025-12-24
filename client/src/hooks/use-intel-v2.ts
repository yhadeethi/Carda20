import { useState, useCallback, useRef } from "react";
import { CompanyIntelV2 } from "@shared/schema";

const CACHE_KEY_PREFIX = "intel-v2-";
const CACHE_TTL_DAYS = 7;

interface CachedIntel {
  intel: CompanyIntelV2;
  cachedAt: number;
}

function getCacheKey(companyName: string, domain?: string | null): string {
  const key = (companyName || domain || "unknown").toLowerCase().replace(/\s+/g, "-");
  return `${CACHE_KEY_PREFIX}${key}`;
}

function getFromCache(cacheKey: string): CompanyIntelV2 | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const parsed: CachedIntel = JSON.parse(cached);
    const ageMs = Date.now() - parsed.cachedAt;
    const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    
    if (ageMs > maxAgeMs) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return parsed.intel;
  } catch {
    return null;
  }
}

function saveToCache(cacheKey: string, intel: CompanyIntelV2): void {
  try {
    const cached: CachedIntel = {
      intel,
      cachedAt: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch {
  }
}

export function useIntelV2() {
  const [intel, setIntel] = useState<CompanyIntelV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchKey = useRef<string | null>(null);

  const fetchIntel = useCallback(async (
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
    
    if (!forceRefresh && lastFetchKey.current === cacheKey && intel) {
      return;
    }
    
    if (!forceRefresh) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setIntel(cached);
        lastFetchKey.current = cacheKey;
        return;
      }
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
      
      if (!response.ok) {
        throw new Error("Failed to fetch intel");
      }

      const data: CompanyIntelV2 = await response.json();
      saveToCache(cacheKey, data);
      setIntel(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch intel");
    } finally {
      setIsLoading(false);
    }
  }, [intel]);

  const reset = useCallback(() => {
    setIntel(null);
    setError(null);
    setIsLoading(false);
    lastFetchKey.current = null;
  }, []);

  return {
    intel,
    isLoading,
    error,
    fetchIntel,
    reset,
  };
}
