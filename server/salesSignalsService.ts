// server/salesSignalsService.ts
import { fetch as undiciFetch } from "undici";

const fetchFn: any = (globalThis as any).fetch ?? undiciFetch;

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

function normalizeDomain(domain?: string | null): string {
  if (!domain) return "";
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function normalizeText(s?: string | null): string {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function safeHostFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function cleanCompanyName(name: string): string {
  return (name || "")
    .replace(/\b(ltd|limited|inc|inc\.|corp|corporation|plc|ag|sa|llc|gmbh|pty|pty\.|co|company|holdings)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
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

// --- Candidate retrieval ---
const ENABLE_GOOGLE_RSS_FALLBACK = process.env.ENABLE_GOOGLE_RSS === "true";

async function fetchGdeltArticles(query: string, max = 25): Promise<ArticleCandidate[]> {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    `?query=${encodeURIComponent(query)}` +
    `&mode=ArtList&format=json&maxrecords=${Math.min(max, 50)}` +
    `&sort=HybridRel` +
    `&startdatetime=${toGdeltDatetime(start)}` +
    `&enddatetime=${toGdeltDatetime(now)}`;

  const r = await fetchFn(url, { method: "GET" });
  if (!r.ok) return [];

  const j: any = await r.json().catch(() => null);
  const articles = j?.articles;
  if (!Array.isArray(articles)) return [];

  return articles
    .map((a: any) => ({
      title: a?.title || "",
      url: a?.url || "",
      source: a?.domain || a?.sourceCountry || a?.sourceCollection || a?.source || "",
      publishedAt: a?.seendate || a?.date || "",
      snippet: a?.snippet || a?.excerpt || "",
    }))
    .filter((x: ArticleCandidate) => x.title && x.url);
}

async function fetchGoogleNewsRss(query: string, max = 10): Promise<ArticleCandidate[]> {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=en-AU&gl=AU&ceid=AU:en";

  const r = await fetchFn(url, { method: "GET" });
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
      source: decodeEntities(stripCdata(stripTagAttrs(source))) || "Google News",
      publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
      snippet: "",
    });

    if (out.length >= max) break;
  }

  return out;
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

// --- scoring ---
function scoreArticle(
  a: ArticleCandidate,
  companyName: string,
  domain: string,
  locationHint?: string
): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  let score = 0;

  const name = normalizeText(companyName);
  const cleaned = normalizeText(cleanCompanyName(companyName));
  const t = normalizeText(a.title);
  const sn = normalizeText(a.snippet || "");
  const host = safeHostFromUrl(a.url);
  const dom = normalizeDomain(domain);

  if (dom && (host === dom || host.endsWith("." + dom))) {
    score += 40;
    evidence.push(`Source host matches domain (${dom})`);
  }

  if (dom && (t.includes(dom) || sn.includes(dom))) {
    score += 18;
    evidence.push("Mentions company domain in text");
  }

  if (name && t.includes(name)) {
    score += 30;
    evidence.push("Title contains exact company name");
  } else if (cleaned && t.includes(cleaned)) {
    score += 22;
    evidence.push("Title contains cleaned company name");
  } else if (name && sn.includes(name)) {
    score += 16;
    evidence.push("Snippet contains company name");
  } else if (cleaned && sn.includes(cleaned)) {
    score += 12;
    evidence.push("Snippet contains cleaned company name");
  }

  const loc = normalizeText(locationHint || "");
  if (loc && (t.includes(loc) || sn.includes(loc))) {
    score += 8;
    evidence.push(`Matches location hint (${locationHint})`);
  }

  const genericBad = ["stocks", "market", "share price", "index", "earnings calendar"];
  const anchored = score >= 30;
  if (genericBad.some((k) => t.includes(k)) && !anchored) {
    score -= 18;
    evidence.push("Generic market headline without clear company anchor");
  }

  return { score, evidence };
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
      return "Hiring usually means growth or new initiatives — a clean opener for outreach.";
    case "Contracts & Projects":
      return "New wins or tenders signal budget + urgency. Sell into momentum.";
    case "Product/Tech":
      return "Launches expose priorities — tailor your pitch to what they just shipped.";
    case "Leadership":
      return "Leadership changes reshape buying patterns — strike early.";
    case "Partnerships":
      return "Partners reveal ecosystem direction — map influence fast.";
    case "Regulatory/Finance":
      return "Financial/regulatory events create deadlines and constraints you can solve against.";
    default:
      return "Potentially relevant context — use it as a hook if it matches your angle.";
  }
}

export async function generateSalesSignals(args: {
  companyName: string;
  domain?: string | null;
  locationHint?: string | null;
  maxSignals?: number;
}): Promise<{ signals: SalesSignal[]; debug: { queryUsed: string; candidates: number } }> {
  const companyName = args.companyName?.trim() || "";
  const domain = normalizeDomain(args.domain);
  const locationHint = args.locationHint || undefined;
  const maxSignals = args.maxSignals ?? 6;

  const cleaned = cleanCompanyName(companyName);

  // IMPORTANT: No "site:" here — GDELT isn't Google.
  const queries = [
    [`"${companyName}"`, domain].filter(Boolean).join(" OR "),
    [`"${cleaned || companyName}"`, domain].filter(Boolean).join(" OR "),
    `"${cleaned || companyName}"`,
    domain,
  ].filter((q) => q && q.trim().length >= 3);

  let candidates: ArticleCandidate[] = [];
  let usedQuery = "";

  for (const q of queries) {
    usedQuery = q;
    candidates = await fetchGdeltArticles(q, 35);
    if (candidates.length) break;
  }

  if (candidates.length === 0 && ENABLE_GOOGLE_RSS_FALLBACK) {
    usedQuery = `${companyName} ${domain || ""}`.trim();
    candidates = await fetchGoogleNewsRss(usedQuery, 12);
  }

  const scored = candidates
    .map((a) => {
      const { score, evidence } = scoreArticle(a, companyName, domain, locationHint);
      return { a, score, evidence };
    })
    .sort((x, y) => y.score - x.score);

  const threshold = domain ? 45 : 55;
  const filtered = scored.filter((x) => x.score >= threshold);
  const top = filtered.slice(0, maxSignals);

  const signals: SalesSignal[] = top.map(({ a, score, evidence }) => {
    const type = classifySignalType(a.title, a.snippet);
    const confidence: SalesSignal["confidence"] =
      score >= 75 ? "High" : score >= 60 ? "Medium" : "Low";

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
    debug: { queryUsed: usedQuery, candidates: candidates.length },
  };
}
