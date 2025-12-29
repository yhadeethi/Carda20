// server/salesSignalsService.ts
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
  publishedAt?: string; // ISO-ish string
  confidence: "High" | "Medium" | "Low";
  evidence: string[]; // short bullet reasons (transparent scoring)
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
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function safeHostFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// --- Candidate retrieval (GDELT + optional Google RSS fallback) ---

const ENABLE_GOOGLE_RSS_FALLBACK = process.env.ENABLE_GOOGLE_RSS === "true";

async function fetchGdeltArticles(query: string, max = 25): Promise<ArticleCandidate[]> {
  // GDELT DOC 2.1 endpoint (ArtList)
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    `?query=${encodeURIComponent(query)}` +
    `&mode=ArtList&format=json&maxrecords=${Math.min(max, 50)}` +
    `&sort=HybridRel`;

  const r = await fetch(url, { method: "GET" });
  if (!r.ok) return [];

  const j: any = await r.json().catch(() => null);
  const articles = j?.articles;
  if (!Array.isArray(articles)) return [];

  return articles
    .map((a: any) => ({
      title: a?.title || "",
      url: a?.url || "",
      source: a?.sourceCountry || a?.sourceCollection || a?.source || "",
      publishedAt: a?.seendate || a?.date || "",
      snippet: a?.snippet || a?.excerpt || "",
    }))
    .filter((x: ArticleCandidate) => x.title && x.url);
}

async function fetchGoogleNewsRss(query: string, max = 10): Promise<ArticleCandidate[]> {
  // Lightweight RSS parse. If Google blocks sometimes, we fail soft.
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=en-AU&gl=AU&ceid=AU:en";

  const r = await fetch(url, { method: "GET" });
  if (!r.ok) return [];
  const xml = await r.text().catch(() => "");
  if (!xml) return [];

  // ultra-simple RSS parsing: split items
  const items = xml.split("<item>").slice(1);
  const out: ArticleCandidate[] = [];

  for (const raw of items) {
    const title = between(raw, "<title>", "</title>");
    const link = between(raw, "<link>", "</link>");
    const pubDate = between(raw, "<pubDate>", "</pubDate>");
    const source = between(raw, "<source", "</source>"); // contains attributes + value

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
  // <source url="...">ABC</source> -> ABC</source>
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

// --- Strict relevance scoring (this is what makes it “not random”) ---

function scoreArticle(
  a: ArticleCandidate,
  companyName: string,
  domain: string,
  locationHint?: string
): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  let score = 0;

  const name = normalizeText(companyName);
  const t = normalizeText(a.title);
  const sn = normalizeText(a.snippet || "");
  const host = safeHostFromUrl(a.url);
  const dom = normalizeDomain(domain);

  // Domain anchor is king
  if (dom && (host === dom || host.endsWith("." + dom))) {
    score += 40;
    evidence.push(`Source host matches domain (${dom})`);
  }

  // Exact name mention
  if (name && t.includes(name)) {
    score += 30;
    evidence.push("Title contains exact company name");
  } else if (name && sn.includes(name)) {
    score += 18;
    evidence.push("Snippet contains company name");
  }

  // Location hint (AU / city / state)
  const loc = normalizeText(locationHint || "");
  if (loc && (t.includes(loc) || sn.includes(loc))) {
    score += 10;
    evidence.push(`Matches location hint (${locationHint})`);
  }

  // Penalize ultra-generic titles (Hitachi problem)
  const genericBad = ["stocks", "market", "share price", "index", "earnings calendar"];
  if (genericBad.some((k) => t.includes(k)) && !t.includes(name)) {
    score -= 20;
    evidence.push("Generic market headline without clear company anchor");
  }

  return { score, evidence };
}

// --- Convert articles -> actionable Sales Signals ---

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

  // Build a better query than "companyName" alone
  const query = [
    `"${companyName}"`,
    domain ? `site:${domain}` : "",
    locationHint ? `"${locationHint}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Candidates (GDELT first)
  let candidates = await fetchGdeltArticles(query, 30);

  // Optional fallback (if GDELT yields nothing, and enabled)
  if (candidates.length === 0 && ENABLE_GOOGLE_RSS_FALLBACK) {
    const rss = await fetchGoogleNewsRss(`${companyName} ${domain || ""}`.trim(), 12);
    candidates = rss;
  }

  // Score + strict filter
  const scored = candidates
    .map((a) => {
      const { score, evidence } = scoreArticle(a, companyName, domain, locationHint);
      return { a, score, evidence };
    })
    .sort((x, y) => y.score - x.score);

  // Hard threshold = “no random junk”
  const filtered = scored.filter((x) => x.score >= (domain ? 55 : 65));

  const top = filtered.slice(0, maxSignals);

  // Convert to signals
  const signals: SalesSignal[] = top.map(({ a, score, evidence }) => {
    const type = classifySignalType(a.title, a.snippet);
    const confidence: SalesSignal["confidence"] =
      score >= 80 ? "High" : score >= 65 ? "Medium" : "Low";

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
      queryUsed: query,
      candidates: candidates.length,
    },
  };
}
