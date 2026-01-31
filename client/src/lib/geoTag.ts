export type GeoCoords = { lat: number; lng: number };

/**
 * Super-lightweight geo tagging.
 * We intentionally avoid reverse-geocoding (fragile + network dependent).
 * Instead we do a bounding-box check for Sydney and fall back to "Nearby".
 */

// Rough Greater Sydney bounding box.
// (Covers the metro area. Not perfect, but good enough for an auto-tag.)
const SYDNEY_BOUNDS = {
  latMin: -34.25,
  latMax: -33.3,
  lngMin: 150.5,
  lngMax: 151.5,
};

export function isInSydney(coords: GeoCoords): boolean {
  return (
    coords.lat >= SYDNEY_BOUNDS.latMin &&
    coords.lat <= SYDNEY_BOUNDS.latMax &&
    coords.lng >= SYDNEY_BOUNDS.lngMin &&
    coords.lng <= SYDNEY_BOUNDS.lngMax
  );
}

export function coordsToTag(coords: GeoCoords): string {
  if (isInSydney(coords)) return "Sydney";
  return "Nearby";
}

export async function getLocationTag(): Promise<{ tag: string; coords: GeoCoords } | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GeoCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        resolve({ tag: coordsToTag(coords), coords });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 60_000,
      }
    );
  });
}
