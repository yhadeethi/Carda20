// server/intelV2Service.ts
import OpenAI from "openai";
import {
  CompanyIntelV2,
  IntelSource,
  SignalItem,
  HeadcountRange,
  StockData,
  CompetitorInfo,
} from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface SourceSnippet {
  sourceTitle: string;
  url: string;
  textExcerpt: string;
}

function isValidDomain(domain: string): boolean {
  if (!domain) return false;

  const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();

  // block local/private
  if (
    /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(cleanDomain)
  ) {
    return false;
  }

  // raw IP
  if (/^\d+\.\d+\.\d+\.\d+$/.test(cleanDomain)) return false;

  if (!cleanDomain.includes(".") || cleanDomain.length < 4) return false;

  return /^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(cleanDomain);
}

function sanitizeCompanyQuery(companyName: string): string {
  // Keep it simple; avoid quotes; remove weird punctuation that can kill RSS search.
  return (companyName || "")
    .replace(/[“”"']/g, "")
    .replace(/[(){}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface WikipediaInfo {
  extract?: string | null;
  pageUrl?: string | null;
  ticker?: string | undefined;
}

async function fetchWikipediaSummary(companyName: string): Promise<WikipediaInfo | null> {
  try {
    const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(companyName)}`;
    const res = await fetch(directUrl);

    const parse = async (r: Response): Promise<WikipediaInfo | null> => {
      if (!r.ok) return null;
      const data = await r.json();

      let ticker: string | undefined;
      const extract: string | undefined = data.extract;
      const tickerMatch = extract?.match(/\b(NYSE|NASDAQ|TSX|LSE|ASX)[:\s]+([A-Z]{1,6})(?:\b|\.|,)/i);
      if (tickerMatch) ticker = tickerMatch[2];

      return {
        extract: data.extract || null,
        pageUrl: data.content_urls?.desktop?.page || null,
        ticker,
      };
    };

    const direct = await parse(res);
    if (direct) return direct;

    // fallback: append "company"
    const altQuery = `${companyName} company`;
    const altUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(altQuery)}`;
    const altRes = await fetch(altUrl);
    return await parse(altRes);
  } catch (e) {
    console.error("Wikipedia fetch error:", e);
    return null;
  }
}

async function fetchWebsiteContent(domain: string, paths: string[]): Promise<SourceSnippet[]> {
  const snippets: SourceSnippet[] = [];
  if (!isValidDomain(domain)) {
    console.log(`Intel V2: Skipping invalid domain: ${domain}`);
    return snippets;
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0];
  const baseUrl = `https://${cleanDomain}`;

  for (const path of paths.slice(0, 3)) {
    try {
      const url = `${baseUrl}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          // More “normal browser” UA helps a lot
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const html = await response.text();

      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 2200);

      if (textContent.length > 120) {
        snippets.push({
          sourceTitle: `${cleanDomain}${path}`,
          url,
          textExcerpt: textContent,
        });
      }
    } catch {
      continue;
    }
  }

  return snippets;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function extractBetween(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function decodeCdata(text: string): string {
  const cdata = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  return (cdata ? cdata[1] : text).trim();
}

function normalizeGoogleNewsLink(link: string): string {
  // Google News RSS often uses `news.google.com/rss/articles/...`
  // keep as-is; it opens fine; just trim.
  return (link || "").trim();
}

async function fetchGoogleNewsRSSByUrl(url: string, label: string): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Try to avoid 403/429
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[News] ${label} response not OK: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    if (!xml || xml.length < 200) {
      console.log(`[News] ${label} empty/short RSS`);
      return [];
    }

    const itemsRaw = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
    const items: NewsItem[] = [];

    for (const itemXml of itemsRaw) {
      const titleRaw = extractBetween(itemXml, "title")[0] || "";
      const linkRaw = extractBetween(itemXml, "link")[0] || "";
      const pubRaw = extractBetween(itemXml, "pubDate")[0] || "";
      const sourceRaw = extractBetween(itemXml, "source")[0] || "";

      const title = decodeCdata(titleRaw);
      const link = normalizeGoogleNewsLink(decodeCdata(linkRaw));
      const pubDate = decodeCdata(pubRaw);
      const source = decodeCdata(sourceRaw) || "Google News";

      if (!title || !link) continue;
      const t = title.toLowerCase();
      if (t.includes("view full coverage")) continue;

      items.push({ title, link, pubDate, source });
      if (items.length >= 12) break;
    }

    console.log(`[News] ${label} parsed items: ${items.length}`);
    return items;
  } catch (error) {
    console.log(`[News] ${label} fetch error:`, error);
    return [];
  }
}

async function fetchGoogleNewsRSS(companyName: string, domain?: string | null): Promise<NewsItem[]> {
  const qName = sanitizeCompanyQuery(companyName);
  const queries: { url: string; label: string }[] = [];

  // Strategy: try multiple regions + slightly different queries.
  // Google News RSS can be picky and/or rate-limited; this improves hit-rate.
  if (qName) {
    const q1 = encodeURIComponent(qName);
    const q2 = encodeURIComponent(`${qName} company`);
    queries.push({
      url: `https://news.google.com/rss/search?q=${q1}&hl=en-US&gl=US&ceid=US:en`,
      label: "US:name",
    });
    queries.push({
      url: `https://news.google.com/rss/search?q=${q2}&hl=en-US&gl=US&ceid=US:en`,
      label: "US:name+company",
    });
    // AU feed often works better for AU companies
    queries.push({
      url: `https://news.google.com/rss/search?q=${q1}&hl=en-AU&gl=AU&ceid=AU:en`,
      label: "AU:name",
    });
  }

  if (domain && isValidDomain(domain)) {
    const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0];
    const qd = encodeURIComponent(`"${cleanDomain}"`);
    queries.push({
      url: `https://news.google.com/rss/search?q=${qd}&hl=en-US&gl=US&ceid=US:en`,
      label: "US:domain",
    });
    queries.push({
      url: `https://news.google.com/rss/search?q=${qd}&hl=en-AU&gl=AU&ceid=AU:en`,
      label: "AU:domain",
    });
  }

  for (const attempt of queries) {
    console.log(`[News] Fetching Google News (${attempt.label}) for "${companyName}"`);
    const items = await fetchGoogleNewsRSSByUrl(attempt.url, attempt.label);
    if (items.length > 0) return items;
  }

  return [];
}

function parseNewsDate(pubDate: string): string {
  try {
    const date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) throw new Error("bad date");
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

async function fetchYahooFinanceStock(ticker: string): Promise<StockData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CardaBot/1.0)",
        "Accept": "application/json, text/plain, */*",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.previousClose || meta?.chartPreviousClose;

    let changePercent: number | null = null;
    if (typeof price === "number" && typeof previousClose === "number" && previousClose !== 0) {
      changePercent = ((price - previousClose) / previousClose) * 100;
    }

    return {
      ticker: ticker.toUpperCase(),
      exchange: meta?.exchangeName || null,
      price: typeof price === "number" ? price : null,
      changePercent: typeof changePercent === "number" ? Math.round(changePercent * 100) / 100 : null,
      currency: meta?.currency || "USD",
    };
  } catch (error) {
    console.log("Yahoo Finance fetch error:", error);
    return null;
  }
}

function parseHeadcount(text: string): HeadcountRange | null {
  const numMatch = text.match(/(\d[\d,]*)\s*(employees|staff|people|workers)/i);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/,/g, ""), 10);
    if (Number.isNaN(num)) return null;
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

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return emptyResult;
  }

  const snippetText = snippets
    .map(
      (s, i) =>
        `[Source ${i + 1}: ${s.sourceTitle}]\nURL: ${s.url}\n${s.textExcerpt}`
    )
    .join("\n\n");

  const systemPrompt =
    `You produce ONLY valid JSON. Extract company details from provided snippets. ` +
    `Never fabricate data. If not found, use null.\n\n` +
    `Extract:\n` +
    `- summary: 1-2 sentences describing what the company does\n` +
    `- hq: headquarters city and country (if present)\n` +
    `- headcount: employee bucket: "1-10","11-50","51-200","201-500","501-1k","1k-5k","5k-10k","10k+"\n` +
    `- industry: max 5 words\n` +
    `- founded: year (string) if present\n` +
    `- founderOrCeo: name if present\n` +
    `- ticker: stock ticker symbol if present\n` +
    `- linkedinUrl/twitterUrl/facebookUrl/instagramUrl: only if in snippets\n` +
    `- competitors: 2-4 competitors (name + brief description)\n`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || "unknown"}

Snippets:
${snippetText}

Return JSON with this exact shape:
{
  "summary": "string or null",
  "hq": { "city": "string or null", "country": "string or null" },
  "headcount": "bucket string or null",
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

    // HQ
    let hq: CompanyIntelV2["hq"] = null;
    if (parsed.hq?.city || parsed.hq?.country) {
      hq = {
        city: parsed.hq.city || null,
        country: parsed.hq.country || null,
        source: {
          title: snippets[0]?.sourceTitle || "Source",
          url: snippets[0]?.url || "",
        },
      };
    }

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
    const headcount: HeadcountRange | null = validHeadcounts.includes(parsed.headcount)
      ? parsed.headcount
      : null;

    const industry: string | null = parsed.industry || null;
    const summary: string | null = parsed.summary || null;
    const founded: string | null = parsed.founded || null;
    const founderOrCeo: string | null = parsed.founderOrCeo || null;
    const ticker: string | null = parsed.ticker || null;

    const linkedinUrl: string | null =
      typeof parsed.linkedinUrl === "string" && parsed.linkedinUrl.includes("linkedin.com")
        ? parsed.linkedinUrl
        : null;
    const twitterUrl: string | null =
      typeof parsed.twitterUrl === "string" &&
      (parsed.twitterUrl.includes("twitter.com") || parsed.twitterUrl.includes("x.com"))
        ? parsed.twitterUrl
        : null;
    const facebookUrl: string | null =
      typeof parsed.facebookUrl === "string" && parsed.facebookUrl.includes("facebook.com")
        ? parsed.facebookUrl
        : null;
    const instagramUrl: string | null =
      typeof parsed.instagramUrl === "string" && parsed.instagramUrl.includes("instagram.com")
        ? parsed.instagramUrl
        : null;

    const competitors: CompetitorInfo[] = Array.isArray(parsed.competitors)
      ? parsed.competitors
          .filter((c: any) => c?.name)
          .slice(0, 4)
          .map((c: any) => ({
            name: String(c.name),
            description: c.description ? String(c.description) : undefined,
          }))
      : [];

    return {
      hq,
      headcount,
      industry,
      summary,
      founded,
      founderOrCeo,
      ticker,
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
    latestSignals: [],
    competitors: [],
    sources: [],
    isBoosted: false, // keep schema compatibility; UI can ignore/remove
    error: "Limited public information available for this company",
  };
}

export async function generateIntelV2(
  companyName: string,
  domain: string | null,
  contactRole?: string,
  contactAddress?: string
): Promise<CompanyIntelV2> {
  const safeName = sanitizeCompanyQuery(companyName);
  console.log(`[IntelV2] Starting for "${safeName}", domain="${domain || "null"}"`);

  const snippets: SourceSnippet[] = [];
  let wikipediaUrl: string | undefined;
  let wikiTicker: string | undefined;

  // Fetch Wikipedia + News (with improved multi-try RSS)
  const [wikiInfo, newsItems] = await Promise.all([
    safeName ? fetchWikipediaSummary(safeName) : Promise.resolve(null),
    fetchGoogleNewsRSS(safeName || companyName, domain),
  ]);

  console.log(`[IntelV2] Wikipedia: ${wikiInfo ? "found" : "none"}, News items: ${newsItems.length}`);

  if (wikiInfo?.extract) {
    snippets.push({
      sourceTitle: "Wikipedia",
      url: wikiInfo.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(safeName || companyName)}`,
      textExcerpt: wikiInfo.extract,
    });
    wikipediaUrl = wikiInfo.pageUrl || undefined;
    wikiTicker = wikiInfo.ticker;
  }

  if (domain) {
    const websiteSnippets = await fetchWebsiteContent(domain, [
      "/",
      "/about",
      "/about-us",
      "/company",
      "/products",
      "/services",
      "/careers",
      "/news",
    ]);
    snippets.push(...websiteSnippets);
  }

  // Convert news -> signals (cap 4)
  const latestSignals: SignalItem[] = newsItems.slice(0, 4).map((item) => ({
    date: parseNewsDate(item.pubDate),
    title: item.title,
    url: item.link,
    sourceName: item.source,
  }));

  if (snippets.length === 0 && latestSignals.length === 0) {
    console.log(`[IntelV2] No snippets/news -> empty intel`);
    return createEmptyIntel(companyName, domain);
  }

  // LLM extraction for summary/industry/etc.
  const llmResult = await callLLMForIntel(companyName, domain, snippets);

  // Derive headcount if LLM missed it
  const headcount = llmResult.headcount || parseHeadcount(snippets.map((s) => s.textExcerpt).join(" "));

  // Use ticker from LLM or Wikipedia extraction
  const ticker = llmResult.ticker || wikiTicker;

  // Stock data if ticker exists
  let stockData: StockData | null = null;
  if (ticker) stockData = await fetchYahooFinanceStock(ticker);

  // Default LinkedIn fallback if none found
  const finalLinkedinUrl =
    llmResult.linkedinUrl ||
    `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;

  const allSources: IntelSource[] = [
    ...snippets.map((s) => ({ title: s.sourceTitle, url: s.url })),
    ...newsItems.slice(0, 3).map((n) => ({ title: n.source, url: n.link })),
  ];

  const intel: CompanyIntelV2 = {
    companyName,
    website: domain,
    lastRefreshedAt: new Date().toISOString(),

    // Profile
    summary: llmResult.summary || null,
    industry: llmResult.industry || null,
    founded: llmResult.founded || null,
    founderOrCeo: llmResult.founderOrCeo || null,

    // Socials
    linkedinUrl: finalLinkedinUrl,
    twitterUrl: llmResult.twitterUrl || null,
    facebookUrl: llmResult.facebookUrl || null,
    instagramUrl: llmResult.instagramUrl || null,

    // Quick cards
    headcount: headcount
      ? {
          range: headcount,
          source: { title: "Wikipedia", url: wikipediaUrl || snippets[0]?.url || "" },
        }
      : null,
    hq: llmResult.hq,
    stock: stockData,

    // News
    latestSignals,

    // Competitors
    competitors: llmResult.competitors || [],

    // Boost removed (kept for schema compatibility; UI should not show it)
    isBoosted: false,

    sources: allSources,
  };

  // Optional: if you pass role/address, you can later enrich prompts without breaking API.
  void contactRole;
  void contactAddress;

  return intel;
}
