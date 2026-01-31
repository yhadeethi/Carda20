export interface ParsedIcsEvent {
  id: string;
  title: string;
  startAt: string | null;
  location: string | null;
}

/**
 * Minimal .ics parser (VEVENT only).
 * Designed for client-side import without OAuth.
 * We keep it intentionally forgiving: if DTSTART is missing/unparseable, startAt becomes null.
 */
export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const lines = icsText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // unfold folded lines (RFC5545): lines starting with space or tab
    .replace(/\n[ \t]/g, "");

  const events: ParsedIcsEvent[] = [];
  const vevents = lines.split("BEGIN:VEVENT").slice(1);

  for (const chunk of vevents) {
    const block = chunk.split("END:VEVENT")[0] || "";
    const get = (key: string): string | null => {
      const re = new RegExp(`^${key}(?:;[^:]*)?:([\\s\\S]*)$`, "mi");
      const m = block.match(re);
      if (!m) return null;
      return (m[1] || "").trim();
    };

    const uid = get("UID") || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const title = get("SUMMARY") || "Untitled event";
    const location = get("LOCATION");
    const dt = get("DTSTART");
    const startAt = dt ? tryParseIcsDate(dt) : null;

    events.push({
      id: uid,
      title,
      startAt,
      location: location || null,
    });
  }

  return events
    .filter((e) => e.title.trim().length > 0)
    .slice(0, 200); // safety
}

function tryParseIcsDate(raw: string): string | null {
  // Common formats:
  //  - 20260131T090000Z
  //  - 20260131T090000
  //  - 20260131
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) {
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6));
    const d = Number(s.slice(6, 8));
    const dt = new Date(Date.UTC(y, m - 1, d));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  const isUtc = !!m[7];

  const dt = isUtc ? new Date(Date.UTC(y, mo - 1, d, hh, mm, ss)) : new Date(y, mo - 1, d, hh, mm, ss);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}
