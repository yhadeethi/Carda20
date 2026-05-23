/**
 * importVCF.ts
 * Parses .vcf (vCard 3.0 / 4.0) files into Carda contacts.
 * Validates: name + at least one email + at least one phone required.
 * Deduplicates against existing contacts by email (case-insensitive).
 * Strips PHOTO fields to avoid base64 bloat.
 */

export interface ParsedVCFContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  address: string;
}

export interface VCFImportResult {
  total: number;         // total vCards found in file
  passed: number;        // contacts that passed validation
  duplicates: number;    // contacts skipped because email already exists
  toImport: ParsedVCFContact[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function unescapeVCard(str: string): string {
  return str
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractValue(line: string): string {
  // Strip property name and params: "FN;CHARSET=UTF-8:John Doe" → "John Doe"
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return "";
  const paramsPart = line.substring(0, colonIdx).toUpperCase();
  let value = line.substring(colonIdx + 1);

  if (paramsPart.includes("ENCODING=QUOTED-PRINTABLE")) {
    value = decodeQuotedPrintable(value);
  }

  return unescapeVCard(value);
}

function parseName(fnLine: string, nLine: string): string {
  // Prefer FN (formatted name) over N
  const fn = fnLine ? extractValue(fnLine).trim() : "";
  if (fn) return fn;

  // N field: "Last;First;Middle;Prefix;Suffix"
  if (nLine) {
    const raw = extractValue(nLine);
    const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
    // Reorder: First Middle Last
    if (parts.length >= 2) return `${parts[1]} ${parts[0]}`.trim();
    if (parts.length === 1) return parts[0];
  }

  return "";
}

function parseEmail(lines: string[]): string {
  // Pick first email found
  for (const line of lines) {
    const val = extractValue(line).trim().toLowerCase();
    if (val && val.includes("@")) return val;
  }
  return "";
}

function parsePhone(lines: string[]): string {
  // Prefer CELL/MOBILE, fall back to first available
  const sorted = [...lines].sort((a) => {
    const u = a.toUpperCase();
    return u.includes("CELL") || u.includes("MOBILE") ? -1 : 1;
  });
  for (const line of sorted) {
    const val = extractValue(line).trim().replace(/\s+/g, "");
    if (val) return val;
  }
  return "";
}

function parseAddress(lines: string[]): string {
  // ADR field: "POBox;Extended;Street;City;State;PostalCode;Country"
  for (const line of lines) {
    const raw = extractValue(line);
    const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  return "";
}

// ── Split raw VCF into individual vCard blocks ─────────────────────────────

function splitVCards(raw: string): string[] {
  const cards: string[] = [];
  const regex = /BEGIN:VCARD[\s\S]*?END:VCARD/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    cards.push(match[0]);
  }
  return cards;
}

// ── Unfold multi-line values (RFC 6350 line folding) ──────────────────────

function unfoldLines(card: string): string {
  return card.replace(/\r?\n[ \t]/g, "");
}

// ── Parse a single vCard block ─────────────────────────────────────────────

function parseVCard(card: string): Partial<ParsedVCFContact> | null {
  const unfolded = unfoldLines(card);
  const lines = unfolded.split(/\r?\n/).filter((l) => l.trim());

  let fnLine = "";
  let nLine = "";
  const emailLines: string[] = [];
  const telLines: string[] = [];
  const adrLines: string[] = [];
  let orgLine = "";
  let titleLine = "";

  for (const line of lines) {
    const upper = line.toUpperCase();

    // Skip PHOTO entirely — can be megabytes of base64
    if (upper.startsWith("PHOTO")) continue;

    if (upper.startsWith("FN")) { fnLine = line; continue; }
    if (upper.startsWith("N:") || upper.startsWith("N;")) { nLine = line; continue; }
    if (upper.startsWith("EMAIL")) { emailLines.push(line); continue; }
    if (upper.startsWith("TEL")) { telLines.push(line); continue; }
    if (upper.startsWith("ADR")) { adrLines.push(line); continue; }
    if (upper.startsWith("ORG")) { orgLine = line; continue; }
    if (upper.startsWith("TITLE")) { titleLine = line; continue; }
  }

  const name = parseName(fnLine, nLine);
  const email = parseEmail(emailLines);
  const phone = parsePhone(telLines);

  return {
    name,
    email,
    phone,
    company: orgLine ? extractValue(orgLine).split(";")[0].trim() : "",
    title: titleLine ? extractValue(titleLine) : "",
    address: parseAddress(adrLines),
  };
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Parse a raw .vcf string and return validated, deduplicated contacts.
 * @param rawVCF - string contents of the uploaded .vcf file
 * @param existingEmails - set of lowercase emails already in Carda
 */
export function parseVCFFile(
  rawVCF: string,
  existingEmails: Set<string>
): VCFImportResult {
  const cards = splitVCards(rawVCF);
  const total = cards.length;

  const passed: ParsedVCFContact[] = [];
  let duplicates = 0;

  for (const card of cards) {
    const parsed = parseVCard(card);
    if (!parsed) continue;

    // Validation: must have name, email, and phone
    if (!parsed.name || !parsed.email || !parsed.phone) continue;

    // Deduplication: skip if email already exists in Carda
    const emailKey = parsed.email.toLowerCase();
    if (existingEmails.has(emailKey)) {
      duplicates++;
      continue;
    }

    passed.push(parsed as ParsedVCFContact);

    // Add to seen set so duplicates within the VCF itself are also caught
    existingEmails.add(emailKey);
  }

  return {
    total,
    passed: passed.length,
    duplicates,
    toImport: passed,
  };
}
