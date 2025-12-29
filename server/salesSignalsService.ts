// server/salesSignalsService.ts
import { fetch as undiciFetch } from "undici";

const fetchFn: typeof fetch = ((globalThis as any).fetch ?? undiciFetch) as any;

type SignalType =
  | "Hiring"
  | "Contracts & Projects"
  | "Product/Tech"
  | "Leadership"
  | "Partnerships"
  | "Regulatory/Finance"
  | "General";

export interface SalesSignal {
  type: SignalType;
  title: string;
  whyItMatters: string;
  sourceTitle?: string;
  sourceUrl?: string;
  publishedAt?: string;
  confidence: "High" | "Medium" | "Low";
  evidence: string[];
}

export interface ArticleCandidate {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
}

const ENABLE_GOOGLE_RSS_FALLBACK = process.env.ENABLE_GOOGLE_RSS === "true";

function normalizeDomain(domain?: string | null): string {
  if (!domain) return "";
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function stripDiacritics(s: string): string {
  try {
    // NFD split + remove combining marks
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

function normalizeText(s?: string | null): string {
  const raw = stripDiacritics((s || "").toLowerCase().trim());
  return raw
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHostFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function removeLegalSuffixes(name: string): string {
  return name
    .replace(
      /\b(ltd|limited|inc|inc\.|corp|corporation|plc|ag|sa|llc|gmbh|pty|pty\.|co|company|holdings)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function pickBrandPhrase(companyName: string): string {
  const cleaned = normalizeText(removeLegalSuffixes(companyName));
  const tokens = cleaned.split(" ").filter(Boolean);

  // drop generic tail words that make matching worse
  const drop = new Set([
    "solutions",
    "solution",
    "storage",
    "energy",
    "power",
    "conversion",
    "systems",
    "system",
    "division",
    "group",
    "services",
    "service",
    "australia",
    "global",
  ]);

  const strongTokens = tokens.filter((t) => !drop.has(t));
  // Use 1–2 strong tokens as “brand phrase”
  if (strongTokens.length >= 2) return `${strongTokens[0]} ${strongTokens[1]}`;
  if (strongTokens.length === 1) return strongTokens[0];
  // fallback to first two tokens anyway
  return tokens.slice(0, 2).join(" ").trim();
}

function toGdeltDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { method: "GET", signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function safeJson(res: Response): Promise<any | null> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * GDELT DOC 2.1 (ArtList)
 * Note: Query syntax is NOT Google. Avoid `site:`.
 * We also include start/end datetime to avoid ancient junk.
 */
async function fetchGdeltArticles(query: string, max = 35): Promise<ArticleCandidate[]> {
  const now = new Date();
  const start = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45d window

  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    `?query=${encodeURIComponent(query)}` +
    `&mode=ArtList&format=json&maxrecords=${Math.min(max, 50)}` +
    `&sort=HybridRel` +
    `&startdatetime=${toGdeltDatetime(start)}` +
    `&enddatetime=${toGdeltDatetime(now)}`;

  const r = await fetchWithTimeout(url, 6500);
  if (!r.ok) return [];

  const j = await safeJson(r);
  const articles = j?.articles;
  if (!Array.isArray(articles)) return [];

  return articles
    .map((a: any) => ({
      title: String(a?.title || "").trim(),
      url: String(a?.url || "").trim(),
      source: String(a?.domain || a?.sourceCountry || a?.source || "").trim(),
      publishedAt: String(a?.seendate || a?.datetime || a?.date || "").trim(),
      snippet: String(a?.snippet || a?.excerpt || "").trim(),
    }))
    .filter((x: ArticleCandidate) => x.title && x.url);
}

function between(s: string, a: string, b: string): string {
  const i = s.indexOf(a);
  if (i < 0) return "";
  const j = s.indexOf(b, i + a.length);
  if (j < 0) return "";
  return s.slice(i + a.length, j).trim();
}

function stripCdata(s: string): string {
  return s.replace("<![CDATA[", "").replace("]]>", "").trim();
}

function stripTagAttrs(s: string): string {
  const gt = s.indexOf(">");
  if (gt >= 0) return s.slice(gt + 1);
  return s;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchGoogleNewsRss(query: string, max = 12): Promise<ArticleCandidate[]> {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=en-AU&gl=AU&ceid=AU:en";

  const r = await fetchWithTimeout(url, 4500);
  if (!r.ok) return [];
  const xml = await r.text().catch(() => "");
  if (!xml) return [];

  const items = xml.split("<item>").slice(1);
  const out: ArticleCandidate[] = [];

  for (const raw of items) {
    const title = between(raw, "<title>", "</title>");
    const link = between(raw, "<link>", "</link>");
    const pubDate = between(raw, "<pubDate>", "</pubDate>");
    const source = between(raw, "<source", "</source>");

    if (!title || !link) continue;

    out.push({
      title: decodeEntities(stripCdata(title)),
      url: decodeEntities(stripCdata(link)),
      source: decodeEntities(stripCdata(stripTagAttrs(source))),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
      snippet: "",
    });

    if (out.length >= max) break;
  }

  return out;
}

function classifySignalType(title: string, snippet?: string): SignalType {
  const t = normalizeText(title + " " + (snippet || ""));

  if (/(hiring|recruit|career|job|vacan)/.test(t)) return "Hiring";
  if (/(contract|awarded|selected|wins?|tender|procurement|project|ppa|agreement)/.test(t))
    return "Contracts & Projects";
  if (/(launch|released|introduc|technology|product|platform|ai|battery|software)/.test(t))
    return "Product/Tech";
  if (/(ceo|cfo|cto|appointed|resigns?|steps down|leadership|board)/.test(t))
    return "Leadership";
  if (/(partner|partnership|collaborat|mou|joins forces)/.test(t)) return "Partnerships";
  if (/(funding|acquisition|merger|ipo|financ|regulated|approval|licen)/.test(t))
    return "Regulatory/Finance";

  return "General";
}

function buildWhyItMatters(type: SignalType): string {
  switch (type) {
    case "Hiring":
      return "Hiring usually means growth or new initiatives — a perfect opener for outreach.";
    case "Contracts & Projects":
      return "New wins or tenders signal budget + urgency. You can sell into momentum.";
    case "Product/Tech":
      return "New launches expose priorities and gaps — tailor your pitch to what they just shipped.";
    case "Leadership":
      return "Leadership changes create reshuffles and new buying patterns — strike early.";
    case "Partnerships":
      return "Partners reveal their ecosystem and procurement direction — map influence fast.";
    case "Regulatory/Finance":
      return "Financial/regulatory events create deadlines and constraints you can solve against.";
    default:
      return "A signal worth checking — use it as a context hook if it’s relevant.";
  }
}

function scoreArticle(
  a: ArticleCandidate,
  companyName: string,
  domain: string,
  locationHint?: string
): { score: number; evidence: string[]; hasAnchor: boolean } {
  const evidence: string[] = [];
  let score = 0;

  const host = safeHostFromUrl(a.url);
  const dom = normalizeDomain(domain);
  const title = normalizeText(a.title);
  const snip = normalizeText(a.snippet || "");

  const brand = normalizeText(pickBrandPhrase(companyName));
  const companyClean = normalizeText(removeLegalSuffixes(companyName));
  const brandTokens = brand.split(" ").filter(Boolean);
  const companyTokens = companyClean.split(" ").filter(Boolean);

  const textAll = `${title} ${snip}`;

  // Anchor checks (must have at least one)
  const hostMatches = dom && (host === dom || host.endsWith("." + dom));
  const brandPhraseMatch = brand && title.includes(brand);
  const tokenHits = companyTokens.filter((t) => t.length >= 4 && textAll.includes(t)).length;

  const hasAnchor = Boolean(hostMatches || brandPhraseMatch || tokenHits >= 2);

  // Domain anchor (press releases / company blog)
  if (hostMatches) {
    score += 48;
    evidence.push(`Source host matches domain (${dom})`);
  }

  // Brand phrase / tokens
  if (brandPhraseMatch) {
    score += 32;
    evidence.push(`Title contains brand phrase (“${brand}”)`);
  } else {
    // partial token scoring
    const hits = brandTokens.filter((t) => t.length >= 4 && textAll.includes(t)).length;
    if (hits >= 2) {
      score += 24;
      evidence.push(`Mentions key brand tokens (${hits} hits)`);
    } else if (hits === 1) {
      score += 14;
      evidence.push("Mentions brand token");
    }
  }

  // Location hint boost
  const loc = normalizeText(locationHint || "");
  if (loc && (title.includes(loc) || snip.includes(loc))) {
    score += 8;
    evidence.push(`Matches location hint (${locationHint})`);
  }

  // Signal keyword boost
  const type = classifySignalType(a.title, a.snippet);
  if (type !== "General") {
    score += 6;
    evidence.push(`Looks like ${type}`);
  }

  // Penalize generic market junk
  const genericBad = ["stocks", "market", "share price", "index", "earnings calendar"];
  if (genericBad.some((k) => title.includes(k)) && !brandPhraseMatch) {
    score -= 18;
    evidence.push("Generic market headline without clear company anchor");
  }

  return { score, evidence, hasAnchor };
}

function dedupeByUrl(items: ArticleCandidate[]): ArticleCandidate[] {
  const seen = new Set<string>();
  const out: ArticleCandidate[] = [];
  for (const it of items) {
    const k = (it.url || "").toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export async function generateSalesSignals(args: {
  companyName: string;
  domain?: string | null;
  locationHint?: string | null;
  maxSignals?: number;
}): Promise<{ signals: SalesSignal[]; debug: { queryUsed: string[]; candidates: number } }> {
  const companyName = (args.companyName || "").trim();
  const domain = normalizeDomain(args.domain);
  const locationHint = args.locationHint || undefined;
  const maxSignals = args.maxSignals ?? 6;

  const cleaned = removeLegalSuffixes(companyName);
  const brand = pickBrandPhrase(companyName);

  // Query phase A: broad company coverage (no fake `site:`)
  const qA = `("${cleaned}" OR "${brand}" OR "${normalizeText(cleaned)}")`;

  // Query phase B: press releases / company domain coverage (if domain exists)
  // GDELT supports domain: filter in many cases; even if not perfect, it's harmless.
  const qB = domain ? `domain:${domain}` : "";

  const queries = [qA, qB].filter(Boolean);

  // Fetch candidates from GDELT (both queries), then merge/dedupe
  const batches = await Promise.all(
    queries.map((q) => fetchGdeltArticles(q, 40).catch(() => []))
  );

  let candidates = dedupeByUrl(batches.flat());

  // Optional fallback: Google RSS (if GDELT gives nothing)
  if (candidates.length === 0 && ENABLE_GOOGLE_RSS_FALLBACK) {
    const rss = await fetchGoogleNewsRss(`${cleaned} ${domain || ""}`.trim(), 12).catch(() => []);
    candidates = dedupeByUrl(rss);
  }

  // Score + filter
  const scored = candidates
    .map((a) => {
      const { score, evidence, hasAnchor } = scoreArticle(a, companyName, domain, locationHint);
      return { a, score, evidence, hasAnchor };
    })
    .sort((x, y) => y.score - x.score);

  // Hard filter: must have some anchor, and must cross threshold
  // If we have a domain, keep it a bit stricter; otherwise accept good name matches.
  const threshold = domain ? 50 : 45;

  const filtered = scored.filter((x) => x.hasAnchor && x.score >= threshold);

  const top = filtered.slice(0, maxSignals);

  const signals: SalesSignal[] = top.map(({ a, score, evidence }) => {
    const type = classifySignalType(a.title, a.snippet);

    const confidence: SalesSignal["confidence"] =
      score >= 82 ? "High" : score >= 62 ? "Medium" : "Low";

    return {
      type,
      title: a.title,
      whyItMatters: buildWhyItMatters(type),
      sourceTitle: safeHostFromUrl(a.url) || a.source || "Source",
      sourceUrl: a.url,
      publishedAt: a.publishedAt,
      confidence,
      evidence,
    };
  });

  return {
    signals,
    debug: {
      queryUsed: queries,
      candidates: candidates.length,
    },
  };
}
