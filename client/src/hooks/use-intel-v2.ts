import { useState, useCallback, useRef } from "react";
import { CompanyIntelV2 } from "@shared/schema";

const CACHE_KEY_PREFIX = "intel-v2-";
const CACHE_TTL_DAYS = 7;

// News is the most time-sensitive. If cache is older than this, we refresh in background.
const NEWS_REVALIDATE_HOURS = 6;
// If cached intel has fewer news items than this, treat it as stale for news.
const MIN_NEWS_ITEMS = 1;

interface CachedIntel {
  intel: CompanyIntelV2;
  cachedAt: number;
}

function getCacheKey(companyName: string, domain?: string | null): string {
  const key = (companyName || domain || "unknown").toLowerCase().replace(/\s+/g, "-");
  return `${CACHE_KEY_PREFIX}${key}`;
}

function readCache(cacheKey: string): CachedIntel | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) {
      console.log(`[IntelV2 Client] Cache miss for key: ${cacheKey}`);
      return null;
    }
    const parsed: CachedIntel = JSON.parse(raw);
    if (!parsed?.intel || !parsed?.cachedAt) return null;

    const ageMs = Date.now() - parsed.cachedAt;
    const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) {
      console.log(
        `[IntelV2 Client] Cache expired for key: ${cacheKey} (age: ${Math.round(
          ageMs / 1000 / 60
        )} minutes)`
      );
      localStorage.removeItem(cacheKey);
      return null;
    }

    const ageMinutes = Math.round(ageMs / 1000 / 60);
    console.log(
      `[IntelV2 Client] Cache HIT for key: ${cacheKey} (age: ${ageMinutes} minutes, news items: ${
        parsed.intel.latestSignals?.length || 0
      })`
    );
    return parsed;
  } catch {
    return null;
  }
}

function saveToCache(cacheKey: string, intel: CompanyIntelV2): void {
  try {
    const cached: CachedIntel = { intel, cachedAt: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    console.log(
      `[IntelV2 Client] Saved to cache: ${cacheKey} (news items: ${intel.latestSignals?.length || 0})`
    );
  } catch {
    // ignore
  }
}

function shouldRevalidateNews(cached: CachedIntel): boolean {
  const ageMs = Date.now() - cached.cachedAt;
  const revalidateMs = NEWS_REVALIDATE_HOURS * 60 * 60 * 1000;
  const newsCount = cached.intel.latestSignals?.length ?? 0;

  // If no news (or too little), refresh.
  if (newsCount < MIN_NEWS_ITEMS) return true;

  // If news is old, refresh.
  if (ageMs > revalidateMs) return true;

  return false;
}

export function useIntelV2() {
  const [intel, setIntel] = useState<CompanyIntelV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchKey = useRef<string | null>(null);
  const inFlightKey = useRef<string | null>(null);

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

      const doFetch = async (opts?: { background?: boolean; noStore?: boolean }) => {
        const background = opts?.background ?? false;
        const noStore = opts?.noStore ?? false;

        // prevent duplicate concurrent fetches for same key
        if (inFlightKey.current === cacheKey) return;
        inFlightKey.current = cacheKey;

        if (!background) {
          setIsLoading(true);
        }
        setError(null);
        lastFetchKey.current = cacheKey;

        try {
          const params = new URLSearchParams();
          if (companyName) params.append("companyName", companyName);
          if (domain) params.append("domain", domain);
          if (role) params.append("role", role);
          if (address) params.append("address", address);

          console.log(
            `[IntelV2 Client] Fetching ${background ? "(background) " : ""}from API for: ${
              companyName || domain
            }`
          );

          const response = await fetch(`/api/intel-v2?${params.toString()}`, {
            cache: noStore ? "no-store" : "default",
          });

          if (!response.ok) {
            throw new Error("Failed to fetch intel");
          }

          const data: CompanyIntelV2 = await response.json();
          saveToCache(cacheKey, data);
          setIntel(data);

          const newsCount = data.latestSignals?.length ?? 0;
          console.log(`[IntelV2 Client] API returned (news items: ${newsCount})`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch intel";
          setError(msg);
        } finally {
          inFlightKey.current = null;
          if (!background) setIsLoading(false);
        }
      };

      if (forceRefresh) {
        try {
          localStorage.removeItem(cacheKey);
          console.log(`[IntelV2 Client] Force refresh - cleared cache for: ${cacheKey}`);
        } catch {}
        lastFetchKey.current = null;
        // Full fresh fetch, avoid caches
        await doFetch({ background: false, noStore: true });
        return;
      }

      // If we already fetched this key in-memory and we have intel, don’t block.
      // BUT: if current intel has no news, we still revalidate in background.
      if (lastFetchKey.current === cacheKey && intel) {
        const inMemNews = intel.latestSignals?.length ?? 0;
        if (inMemNews < MIN_NEWS_ITEMS) {
          void doFetch({ background: true });
        }
        return;
      }

      const cached = readCache(cacheKey);
      if (cached) {
        setIntel(cached.intel);
        lastFetchKey.current = cacheKey;

        // Revalidate news in background if needed
        if (shouldRevalidateNews(cached)) {
          void doFetch({ background: true });
        }
        return;
      }

      // No cache -> normal fetch
      await doFetch({ background: false });
    },
    [intel]
  );

  const boostIntel = useCallback(
    async (domain: string) => {
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
          let msg = "Failed to boost intel";
          try {
            const errorData = await response.json();
            msg = errorData?.error || msg;
          } catch {}
          throw new Error(msg);
        }

        const boostedData: CompanyIntelV2 = await response.json();

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
    },
    [intel]
  );

  const reset = useCallback(() => {
    setIntel(null);
    setError(null);
    setIsLoading(false);
    setIsBoosting(false);
    lastFetchKey.current = null;
    inFlightKey.current = null;
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
