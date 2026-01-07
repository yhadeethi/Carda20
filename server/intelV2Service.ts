import OpenAI from "openai";
import sanitizeHtml from "sanitize-html";
import {
  CompanyIntelV2,
  IntelSource,
  HeadcountRange,
  StockData,
  CompetitorInfo,
} from "@shared/schema";
import { generateSalesSignals } from "./salesSignalsService";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface SourceSnippet {
  sourceTitle: string;
  url: string;
  textExcerpt: string;
}

/* =========================
   Helpers
   ========================= */

function normalizeDomain(domain?: string | null): string | null {
  const s = (domain || "").trim();
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

function isValidDomain(domain: string): boolean {
  if (!domain) return false;

  const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();

  // block private / local
  if (
    /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(cleanDomain)
  ) {
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(cleanDomain)) return false;
  if (!cleanDomain.includes(".") || cleanDomain.length < 4) return false;

  return /^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(cleanDomain);
}

async function fetchWithTimeout(
  url: string,
  init: any = {},
  timeoutMs = 4500
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeNullish(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return String(v);
  const s = v.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (
    lower === "null" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "unknown"
  )
    return null;
  return s;
}

function normalizeMaybeUrl(v: unknown, includes: string[]): string | null {
  const s = normalizeNullish(v);
  if (!s) return null;
  const ok = includes.some((x) => s.includes(x));
  return ok ? s : null;
}

/* =========================
   Wikipedia (robust)
   ========================= */

interface WikipediaInfo {
  extract?: string | null;
  pageUrl?: string | null;
  ticker?: string | undefined;
}

async function fetchWikipediaSummary(companyName: string): Promise<WikipediaInfo | null> {
  const name = (companyName || "").trim();
  if (!name) return null;

  try {
    // 1) Try direct summary by title
    const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      name
    )}`;
    let res = await fetchWithTimeout(directUrl, {}, 5000);

    // 2) If not found, use opensearch to get best title, then summary
    if (!res.ok) {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        name
      )}&limit=1&namespace=0&format=json&origin=*`;
      const searchRes = await fetchWithTimeout(searchUrl, {}, 5000);
      if (!searchRes.ok) return null;

      const searchData = await searchRes.json();
      const titles: string[] = Array.isArray(searchData?.[1]) ? searchData[1] : [];
      const bestTitle = titles[0];
      if (!bestTitle) return null;

      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        bestTitle
      )}`;
      res = await fetchWithTimeout(summaryUrl, {}, 5000);
      if (!res.ok) return null;
    }

    const data = await res.json();

    let ticker: string | undefined;
    const extractText = data?.extract || "";
    const tickerMatch = extractText.match(/\b(NYSE|NASDAQ|TSX|LSE|ASX)[:\s]+([A-Z]{1,6})\b/i);
    if (tickerMatch) ticker = tickerMatch[2];

    return {
      extract: data?.extract || null,
      pageUrl: data?.content_urls?.desktop?.page || null,
      ticker,
    };
  } catch (error) {
    console.error("Wikipedia fetch error:", error);
    return null;
  }
}

/* =========================
   Website snippets (with social URL hints)
   ========================= */

function extractSocialLinksFromHtml(html: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /https?:\/\/(?:www\.)?linkedin\.com\/company\/[^\s"'<>]+/gi,
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s"'<>]+/gi,
    /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s"'<>]+/gi,
    /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
    /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
  ];

  for (const re of patterns) {
    const matches = html.match(re) || [];
    for (const m of matches) {
      const cleaned = m.replace(/[),.]+$/g, "");
      if (cleaned.length > 10) found.add(cleaned);
    }
  }

  return Array.from(found).slice(0, 8);
}

async function fetchWebsiteContent(domain: string, paths: string[]): Promise<SourceSnippet[]> {
  const snippets: SourceSnippet[] = [];
  if (!isValidDomain(domain)) {
    console.log(`[IntelV2] Skipping invalid domain: ${domain}`);
    return snippets;
  }

  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  for (const path of paths.slice(0, 3)) {
    try {
      const url = `${baseUrl}${path}`;
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CardaIntelBot/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
        },
        5500
      );

      if (!res.ok) continue;

      const html = await res.text();
      const socialLinks = extractSocialLinksFromHtml(html);

      // Sanitize HTML and extract text content safely
      const sanitized = sanitizeHtml(html, {
        allowedTags: [], // Strip all HTML tags
        allowedAttributes: {},
        textFilter: function(text) {
          return text;
        }
      });

      const textContent = sanitized
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 2200);

      if (textContent.length > 140) {
        snippets.push({
          sourceTitle: `${domain}${path}`,
          url,
          textExcerpt:
            textContent +
            (socialLinks.length ? `\n\nSocial links found: ${socialLinks.join(" | ")}` : ""),
        });
      }
    } catch {
      continue;
    }
  }

  return snippets;
}

/* =========================
   Headcount parsing
   ========================= */

function parseHeadcount(text: string): HeadcountRange | null {
  const numMatch = text.match(/(\d[\d,]*)\s*(employees|staff|people|workers)/i);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/,/g, ""), 10);
    if (num <= 10) return "1-10";
    if (num <= 50) return "11-50";
    if (num <= 200) return "51-200";
    if (num <= 500) return "201-500";
    if (num <= 1000) return "501-1k";
    if (num <= 5000) return "1k-5k";
    if (num <= 10000) return "5k-10k";
    return "10k+";
  }
  return null;
}

/* =========================
   Stock (Yahoo best-effort)
   ========================= */

async function fetchYahooFinanceStock(ticker: string): Promise<StockData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1d&range=1d`;
    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; CardaBot/1.0)" } },
      4000
    );
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.previousClose || meta?.chartPreviousClose;

    let changePercent: number | null = null;
    if (price && previousClose) {
      changePercent = ((price - previousClose) / previousClose) * 100;
    }

    return {
      ticker: ticker.toUpperCase(),
      exchange: meta?.exchangeName || null,
      price: price || null,
      changePercent: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
      currency: meta?.currency || "USD",
    };
  } catch (error) {
    console.log("Yahoo Finance fetch error:", error);
    return null;
  }
}

/* =========================
   LLM extraction
   ========================= */

interface LLMIntelResult {
  hq: CompanyIntelV2["hq"];
  headcount: HeadcountRange | null;
  industry: string | null;
  summary: string | null;
  founded: string | null;
  founderOrCeo: string | null;
  ticker: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  competitors: CompetitorInfo[];
}

async function callLLMForIntel(
  companyName: string,
  domain: string | null,
  snippets: SourceSnippet[]
): Promise<LLMIntelResult> {
  const emptyResult: LLMIntelResult = {
    hq: null,
    headcount: null,
    industry: null,
    summary: null,
    founded: null,
    founderOrCeo: null,
    ticker: null,
    linkedinUrl: null,
    twitterUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    competitors: [],
  };

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return emptyResult;

  const snippetText = snippets
    .map((s, i) => `[Source ${i + 1}: ${s.sourceTitle}]\nURL: ${s.url}\n${s.textExcerpt}`)
    .join("\n\n");

  const systemPrompt = `You output ONLY valid JSON.
Use the snippets to extract factual fields when possible.
If a field is not in snippets, return null (do NOT guess).

For competitors:
- You MAY suggest likely competitors based on the company's industry and what it does.
- Do NOT invent specific claims; keep descriptions short and generic (e.g., "grid equipment", "power electronics").
- Prefer well-known direct competitors.

Return JSON with:
summary, hq{city,country}, headcount bucket, industry, founded, founderOrCeo, ticker,
linkedinUrl, twitterUrl, facebookUrl, instagramUrl,
competitors (2-4).`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || "unknown"}

Snippets:
${snippetText}

Return JSON:
{
  "summary": "string or null",
  "hq": { "city": "string or null", "country": "string or null" },
  "headcount": "1-10|11-50|51-200|201-500|501-1k|1k-5k|5k-10k|10k+|null",
  "industry": "string or null",
  "founded": "string or null",
  "founderOrCeo": "string or null",
  "ticker": "string or null",
  "linkedinUrl": "string or null",
  "twitterUrl": "string or null",
  "facebookUrl": "string or null",
  "instagramUrl": "string or null",
  "competitors": [{ "name": "string", "description": "string optional" }]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return emptyResult;

    const parsed = JSON.parse(content);

    const hqCity = normalizeNullish(parsed?.hq?.city);
    const hqCountry = normalizeNullish(parsed?.hq?.country);
    const hq: CompanyIntelV2["hq"] =
      hqCity || hqCountry
        ? {
            city: hqCity,
            country: hqCountry,
            source: { title: snippets[0]?.sourceTitle || "Source", url: snippets[0]?.url || "" },
          }
        : null;

    const validHeadcounts: HeadcountRange[] = [
      "1-10",
      "11-50",
      "51-200",
      "201-500",
      "501-1k",
      "1k-5k",
      "5k-10k",
      "10k+",
    ];
    const headcountRaw = normalizeNullish(parsed?.headcount);
    const headcount: HeadcountRange | null =
      headcountRaw && validHeadcounts.includes(headcountRaw as HeadcountRange)
        ? (headcountRaw as HeadcountRange)
        : null;

    const linkedinUrl = normalizeMaybeUrl(parsed?.linkedinUrl, ["linkedin.com"]);
    const twitterUrl = normalizeMaybeUrl(parsed?.twitterUrl, ["twitter.com", "x.com"]);
    const facebookUrl = normalizeMaybeUrl(parsed?.facebookUrl, ["facebook.com"]);
    const instagramUrl = normalizeMaybeUrl(parsed?.instagramUrl, ["instagram.com"]);

    const competitors: CompetitorInfo[] = Array.isArray(parsed?.competitors)
      ? parsed.competitors
          .filter((c: any) => c?.name)
          .slice(0, 4)
          .map((c: any) => ({
            name: String(c.name).trim(),
            description: c.description ? String(c.description).trim() : undefined,
          }))
          .filter((c: CompetitorInfo) => !!c.name)
      : [];

    return {
      hq,
      headcount,
      industry: normalizeNullish(parsed?.industry),
      summary: normalizeNullish(parsed?.summary),
      founded: normalizeNullish(parsed?.founded),
      founderOrCeo: normalizeNullish(parsed?.founderOrCeo),
      ticker: normalizeNullish(parsed?.ticker),
      linkedinUrl,
      twitterUrl,
      facebookUrl,
      instagramUrl,
      competitors,
    };
  } catch (error) {
    console.error("LLM call error:", error);
    return emptyResult;
  }
}

/* =========================
   Empty Intel
   ========================= */

function createEmptyIntel(companyName: string, domain: string | null): CompanyIntelV2 {
  return {
    companyName,
    website: domain,
    lastRefreshedAt: new Date().toISOString(),
    summary: null,
    industry: null,
    founded: null,
    founderOrCeo: null,
    headcount: null,
    hq: null,
    stock: null,
    linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(
      companyName
    )}`,
    twitterUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    // keep for schema compat, but we won't use it anymore
    latestSignals: [],
    competitors: [],
    sources: [],
    isBoosted: false,
    error: "Limited public information available for this company",
  };
}

/* =========================
   Main Intel V2
   ========================= */

export async function generateIntelV2(
  companyName: string,
  domain: string | null,
  contactRole?: string,
  contactAddress?: string
): Promise<CompanyIntelV2> {
  const domainClean = normalizeDomain(domain);

  console.log(
    `[IntelV2] Starting for company: "${companyName}", domain: "${domainClean || "null"}"`
  );

  const snippets: SourceSnippet[] = [];
  let wikipediaUrl: string | undefined;
  let wikiTicker: string | undefined;

  // Wiki + Signals in parallel (signals can succeed even if snippets fail)
  const [wikiInfo, salesSignalsResult] = await Promise.all([
    fetchWikipediaSummary(companyName),
    generateSalesSignals({
      companyName,
      domain: domainClean,
      locationHint: contactAddress || null,
      maxSignals: 6,
    }).catch((e) => {
      console.log("[IntelV2] salesSignals error:", e);
      return { signals: [], debug: { queryUsed: "", candidates: 0 } };
    }),
  ]);

  const signals = salesSignalsResult?.signals || [];

  console.log(
    `[IntelV2] Wikipedia: ${wikiInfo?.extract ? "found" : "none"}, Signals: ${signals.length}`
  );

  if (wikiInfo?.extract) {
    snippets.push({
      sourceTitle: "Wikipedia",
      url:
        wikiInfo.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(companyName)}`,
      textExcerpt: wikiInfo.extract,
    });
    wikipediaUrl = wikiInfo.pageUrl || undefined;
    wikiTicker = wikiInfo.ticker;
  }

  if (domainClean) {
    const websiteSnippets = await fetchWebsiteContent(domainClean, [
      "/",
      "/about",
      "/about-us",
      "/company",
      "/products",
      "/services",
    ]);
    snippets.push(...websiteSnippets);
  }

  if (snippets.length === 0 && signals.length === 0) {
    console.log(`[IntelV2] No snippets/signals found, returning empty intel`);
    const empty = createEmptyIntel(companyName, domainClean || null);
    // attach signals for UI (even empty)
    (empty as any).signals = [];
    return empty;
  }

  const llmResult = await callLLMForIntel(companyName, domainClean || null, snippets);

  const headcountFromText = parseHeadcount(snippets.map((s) => s.textExcerpt).join(" "));
  const headcount = llmResult.headcount || headcountFromText;

  const ticker = llmResult.ticker || wikiTicker;

  let stockData: StockData | null = null;
  if (ticker) stockData = await fetchYahooFinanceStock(ticker);

  const finalLinkedinUrl =
    llmResult.linkedinUrl ||
    `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(
      companyName
    )}`;

  const allSources: IntelSource[] = [
    ...snippets.map((s) => ({ title: s.sourceTitle, url: s.url })),
  ];

  // keep params for future relevance tuning
  void contactRole;

  const intel: CompanyIntelV2 = {
    companyName,
    website: domainClean || domain,
    lastRefreshedAt: new Date().toISOString(),

    summary: llmResult.summary || null,
    industry: llmResult.industry || null,
    founded: llmResult.founded || null,
    founderOrCeo: llmResult.founderOrCeo || null,

    linkedinUrl: finalLinkedinUrl,
    twitterUrl: llmResult.twitterUrl || null,
    facebookUrl: llmResult.facebookUrl || null,
    instagramUrl: llmResult.instagramUrl || null,

    headcount: headcount
      ? {
          range: headcount,
          source: { title: "Wikipedia", url: wikipediaUrl || snippets[0]?.url || "" },
        }
      : null,

    hq: llmResult.hq || null,
    stock: stockData,

    // keep schema field but stop using it
    latestSignals: [],

    competitors: llmResult.competitors || [],

    isBoosted: false,
    sources: allSources,
  };

  // Attach sales signals for the UI (schema extension)
  (intel as any).signals = signals;

  // Optional: include debug for troubleshooting (comment out if you don't want it)
  // (intel as any).signalsDebug = salesSignalsResult?.debug;

  return intel;
}
