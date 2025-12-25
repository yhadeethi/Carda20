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
    if (!cached) {
      console.log(`[IntelV2 Client] Cache miss for key: ${cacheKey}`);
      return null;
    }
    
    const parsed: CachedIntel = JSON.parse(cached);
    const ageMs = Date.now() - parsed.cachedAt;
    const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    
    if (ageMs > maxAgeMs) {
      console.log(`[IntelV2 Client] Cache expired for key: ${cacheKey} (age: ${Math.round(ageMs / 1000 / 60)} minutes)`);
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    const ageMinutes = Math.round(ageMs / 1000 / 60);
    console.log(`[IntelV2 Client] Cache HIT for key: ${cacheKey} (age: ${ageMinutes} minutes, news items: ${parsed.intel.latestSignals?.length || 0})`);
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
    console.log(`[IntelV2 Client] Saved to cache: ${cacheKey} (news items: ${intel.latestSignals?.length || 0})`);
  } catch {
  }
}

export function useIntelV2() {
  const [intel, setIntel] = useState<CompanyIntelV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
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

      console.log(`[IntelV2 Client] Fetching fresh data from API for: ${companyName || domain}`);
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

  const boostIntel = useCallback(async (domain: string) => {
    if (!intel || !domain) {
      setError("Intel and domain required for boost");
      return false;
    }

    setIsBoosting(true);
    setError(null);

    try {
      console.log(`[IntelV2 Client] Boosting intel for domain: ${domain}`);
      const response = await fetch("/api/intel-v2/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, existingIntel: intel }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to boost intel");
      }

      const boostedData: CompanyIntelV2 = await response.json();
      
      // Update cache with boosted data
      const cacheKey = getCacheKey(intel.companyName, domain);
      saveToCache(cacheKey, boostedData);
      
      setIntel(boostedData);
      console.log(`[IntelV2 Client] Boost successful for ${domain}`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to boost intel");
      return false;
    } finally {
      setIsBoosting(false);
    }
  }, [intel]);

  const reset = useCallback(() => {
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
