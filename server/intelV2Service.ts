import OpenAI from "openai";
import { CompanyIntelV2, IntelSource, VerifiedBullet, SignalItem, HeadcountRange, OfferingsMatrix, CompetitorItem, SentimentData } from "@shared/schema";

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
  
  if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(cleanDomain)) {
    return false;
  }
  
  if (/^\d+\.\d+\.\d+\.\d+$/.test(cleanDomain)) {
    return false;
  }
  
  if (!cleanDomain.includes(".") || cleanDomain.length < 4) {
    return false;
  }
  
  return /^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(cleanDomain);
}

interface WikipediaInfo {
  extract?: string;
  pageUrl?: string;
  infobox?: Record<string, string>;
  ticker?: string;
}

async function fetchWikipediaSummary(companyName: string): Promise<WikipediaInfo | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(companyName)}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      const searchQuery = encodeURIComponent(companyName + " company");
      const altUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${searchQuery}`;
      const altResponse = await fetch(altUrl);
      if (!altResponse.ok) return null;
      const altData = await altResponse.json();
      return {
        extract: altData.extract || null,
        pageUrl: altData.content_urls?.desktop?.page || null,
      };
    }
    
    const data = await response.json();
    
    let ticker: string | undefined;
    const tickerMatch = data.extract?.match(/\b(NYSE|NASDAQ|TSX|LSE|ASX)[:\s]+([A-Z]{1,5})\b/i);
    if (tickerMatch) {
      ticker = tickerMatch[2];
    }
    
    return {
      extract: data.extract || null,
      pageUrl: data.content_urls?.desktop?.page || null,
      ticker,
    };
  } catch (error) {
    console.error("Wikipedia fetch error:", error);
    return null;
  }
}

async function fetchWebsiteContent(domain: string, paths: string[]): Promise<SourceSnippet[]> {
  const snippets: SourceSnippet[] = [];
  
  if (!isValidDomain(domain)) {
    console.log(`Intel V2: Skipping invalid domain: ${domain}`);
    return snippets;
  }
  
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  
  for (const path of paths.slice(0, 3)) {
    try {
      const url = `${baseUrl}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; IntelBot/1.0)",
        },
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const html = await response.text();
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 2000);
      
      if (textContent.length > 100) {
        snippets.push({
          sourceTitle: `${domain}${path}`,
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

async function fetchGoogleNewsRSS(companyName: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`"${companyName}" company`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
      },
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return [];
    
    const xml = await response.text();
    const items: NewsItem[] = [];
    
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const itemMatch of itemMatches) {
      const match = [itemMatch, itemMatch.replace(/<\/?item>/g, "")];
      const itemContent = match[1];
      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
      const sourceMatch = itemContent.match(/<source[^>]*>(.*?)<\/source>/);
      
      if (titleMatch && linkMatch) {
        const title = (titleMatch[1] || titleMatch[2] || "").trim();
        const link = linkMatch[1].trim();
        const pubDate = pubDateMatch?.[1] || "";
        const source = sourceMatch?.[1] || "Google News";
        
        if (title && link && !title.toLowerCase().includes("view full coverage")) {
          items.push({ title, link, pubDate, source });
        }
      }
      
      if (items.length >= 10) break;
    }
    
    return items;
  } catch (error) {
    console.log("Google News RSS fetch error:", error);
    return [];
  }
}

function parseNewsDate(pubDate: string): string {
  try {
    const date = new Date(pubDate);
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

async function fetchStockData(ticker: string): Promise<{ series: Array<{ date: string; close: number }>; lastPrice?: number; changePercent?: number } | null> {
  try {
    const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&d1=${getDateString(-45)}&d2=${getDateString(0)}&i=d`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const csv = await response.text();
    const lines = csv.trim().split("\n").slice(1);
    
    const series: Array<{ date: string; close: number }> = [];
    
    for (const line of lines.slice(-30)) {
      const [date, , , , close] = line.split(",");
      if (date && close && !isNaN(parseFloat(close))) {
        series.push({ date, close: parseFloat(close) });
      }
    }
    
    if (series.length < 2) return null;
    
    const lastPrice = series[series.length - 1].close;
    const firstPrice = series[0].close;
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    return { series, lastPrice, changePercent };
  } catch (error) {
    console.error("Stock data fetch error:", error);
    return null;
  }
}

function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function parseHeadcount(text: string): HeadcountRange | null {
  const numMatch = text.match(/(\d[\d,]*)\s*(employees|staff|people|workers)/i);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/,/g, ""));
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

export async function generateIntelV2(
  companyName: string,
  domain: string | null,
  contactRole?: string
): Promise<CompanyIntelV2> {
  const snippets: SourceSnippet[] = [];
  let ticker: string | undefined;
  let wikipediaUrl: string | undefined;
  
  const [wikiInfo, newsItems] = await Promise.all([
    fetchWikipediaSummary(companyName),
    fetchGoogleNewsRSS(companyName),
  ]);
  
  if (wikiInfo?.extract) {
    snippets.push({
      sourceTitle: "Wikipedia",
      url: wikiInfo.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(companyName)}`,
      textExcerpt: wikiInfo.extract,
    });
    ticker = wikiInfo.ticker;
    wikipediaUrl = wikiInfo.pageUrl;
  }
  
  if (domain) {
    const websiteSnippets = await fetchWebsiteContent(domain, ["/", "/about", "/about-us", "/company", "/products", "/services"]);
    snippets.push(...websiteSnippets);
  }
  
  let stockData: { series: Array<{ date: string; close: number }>; lastPrice?: number; changePercent?: number } | null = null;
  if (ticker) {
    stockData = await fetchStockData(ticker);
  }
  
  const latestSignals: SignalItem[] = newsItems.slice(0, 6).map(item => ({
    date: parseNewsDate(item.pubDate),
    title: item.title,
    url: item.link,
    sourceName: item.source,
  }));
  
  const sentiment = classifyHeadlineSentiment(newsItems.map(n => n.title));
  
  if (snippets.length === 0 && newsItems.length === 0) {
    return createEmptyIntel(companyName, domain);
  }
  
  const llmResult = await callLLMForIntel(companyName, domain, contactRole, snippets, newsItems);
  
  const headcount = llmResult.headcount || parseHeadcount(snippets.map(s => s.textExcerpt).join(" "));
  
  const linkedinUrl = llmResult.linkedinUrl || `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
  
  const allSources: IntelSource[] = [
    ...snippets.map(s => ({ title: s.sourceTitle, url: s.url })),
    ...newsItems.slice(0, 3).map(n => ({ title: n.source, url: n.link })),
  ];
  
  const intel: CompanyIntelV2 = {
    companyName,
    website: domain,
    lastRefreshedAt: new Date().toISOString(),
    headcount: headcount && (wikipediaUrl || snippets[0]?.url) ? {
      range: headcount,
      source: { title: "Wikipedia", url: wikipediaUrl || snippets[0]?.url || "" },
    } : null,
    stock: stockData && ticker ? {
      ticker,
      series: stockData.series,
      lastPrice: stockData.lastPrice,
      changePercent: stockData.changePercent,
      source: { title: "Stooq", url: `https://stooq.com/q/?s=${ticker.toLowerCase()}.us` },
    } : null,
    hq: llmResult.hq,
    linkedinUrl,
    verifiedFacts: llmResult.verifiedFacts,
    offerings: llmResult.offerings,
    sources: allSources,
    latestSignals,
    sentiment,
    competitors: llmResult.competitors,
  };
  
  return intel;
}

function classifyHeadlineSentiment(headlines: string[]): SentimentData {
  const positiveWords = /growth|profit|surge|soar|gain|boost|success|innovation|partnership|launch|record|expand|upgrade|milestone|award/i;
  const negativeWords = /loss|decline|drop|fall|layoff|lawsuit|scandal|fail|crisis|cut|concern|warning|delay|recall|downturn/i;
  
  let positive = 0, neutral = 0, negative = 0;
  
  for (const headline of headlines.slice(0, 10)) {
    if (positiveWords.test(headline)) positive++;
    else if (negativeWords.test(headline)) negative++;
    else neutral++;
  }
  
  return { positive, neutral, negative };
}

async function callLLMForIntel(
  companyName: string,
  domain: string | null,
  contactRole: string | undefined,
  snippets: SourceSnippet[],
  newsItems: NewsItem[]
): Promise<{
  hq: CompanyIntelV2["hq"];
  verifiedFacts: VerifiedBullet[];
  offerings: OfferingsMatrix | null;
  competitors: CompetitorItem[];
  headcount: HeadcountRange | null;
  linkedinUrl: string | null;
}> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return { hq: null, verifiedFacts: [], offerings: null, competitors: [], headcount: null, linkedinUrl: null };
  }
  
  const snippetText = snippets.map((s, i) => 
    `[Source ${i + 1}: ${s.sourceTitle}]\nURL: ${s.url}\n${s.textExcerpt}`
  ).join("\n\n");
  
  const newsText = newsItems.slice(0, 5).map((n, i) => 
    `[News ${i + 1}] ${n.title} (${n.source})`
  ).join("\n");
  
  const systemPrompt = `You produce ONLY valid JSON. Extract facts from provided snippets. Every verifiedFact MUST cite a source URL from the snippets. Never fabricate data.

Rules:
- verifiedFacts: max 8 bullets, each MUST have sourceUrl from snippets. Focus on: what they do, founded date, HQ, funding, key achievements.
- offerings: extract products (max 6), services (max 6), and buyers/target customers (max 4) if mentioned
- competitors: max 6 competitor names with brief description. Mark verified:true only if found in snippets, otherwise verified:false
- headcount: extract employee count range from snippets. Use buckets: "1-10", "11-50", "51-200", "201-500", "501-1k", "1k-5k", "5k-10k", "10k+"
- linkedinUrl: only if you find an actual LinkedIn URL in snippets (e.g. linkedin.com/company/...). Otherwise null.
- hq: city and country if verifiable from snippets`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || "unknown"}
Contact role: ${contactRole || "unknown"}

Snippets:
${snippetText}

Recent Headlines:
${newsText || "None available"}

Return JSON:
{
  "hq": { "city": "...", "country": "...", "sourceUrl": "..." } or null,
  "headcount": "bucket string" or null,
  "linkedinUrl": "..." or null,
  "verifiedFacts": [{ "text": "...", "sourceUrl": "..." }],
  "offerings": { "products": [...], "services": [...], "buyers": [...] } or null,
  "competitors": [{ "name": "...", "description": "...", "verified": true/false }]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { hq: null, verifiedFacts: [], offerings: null, competitors: [], headcount: null, linkedinUrl: null };
    }
    
    const parsed = JSON.parse(content);
    
    const verifiedFacts: VerifiedBullet[] = (parsed.verifiedFacts || [])
      .filter((f: { text?: string; sourceUrl?: string }) => f.text && f.sourceUrl)
      .slice(0, 8)
      .map((f: { text: string; sourceUrl: string }) => {
        try {
          return {
            text: f.text,
            source: { title: new URL(f.sourceUrl).hostname, url: f.sourceUrl },
          };
        } catch {
          return { text: f.text, source: { title: "Source", url: f.sourceUrl } };
        }
      });
    
    let offerings: OfferingsMatrix | null = null;
    if (parsed.offerings) {
      offerings = {
        products: (parsed.offerings.products || []).slice(0, 6),
        services: (parsed.offerings.services || []).slice(0, 6),
        buyers: (parsed.offerings.buyers || []).slice(0, 4),
      };
      if (!offerings.products.length && !offerings.services.length) {
        offerings = null;
      }
    }
    
    const competitors: CompetitorItem[] = (parsed.competitors || [])
      .filter((c: { name?: string }) => c.name)
      .slice(0, 6)
      .map((c: { name: string; description?: string; verified?: boolean }) => ({
        name: c.name,
        description: c.description,
        verified: c.verified === true,
      }));
    
    let hq: CompanyIntelV2["hq"] = null;
    if (parsed.hq?.city || parsed.hq?.country) {
      hq = {
        city: parsed.hq.city || null,
        country: parsed.hq.country || null,
        source: {
          title: parsed.hq.sourceUrl ? (() => { try { return new URL(parsed.hq.sourceUrl).hostname; } catch { return "Source"; }})() : "Wikipedia",
          url: parsed.hq.sourceUrl || snippets[0]?.url || "",
        },
      };
    }
    
    const validHeadcounts: HeadcountRange[] = ["1-10", "11-50", "51-200", "201-500", "501-1k", "1k-5k", "5k-10k", "10k+"];
    const headcount: HeadcountRange | null = validHeadcounts.includes(parsed.headcount) ? parsed.headcount : null;
    
    const linkedinUrl: string | null = parsed.linkedinUrl && parsed.linkedinUrl.includes("linkedin.com") ? parsed.linkedinUrl : null;
    
    return { hq, verifiedFacts, offerings, competitors, headcount, linkedinUrl };
  } catch (error) {
    console.error("LLM call error:", error);
    return { hq: null, verifiedFacts: [], offerings: null, competitors: [], headcount: null, linkedinUrl: null };
  }
}

function createEmptyIntel(companyName: string, domain: string | null): CompanyIntelV2 {
  return {
    companyName,
    website: domain,
    lastRefreshedAt: new Date().toISOString(),
    headcount: null,
    stock: null,
    hq: null,
    linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`,
    verifiedFacts: [],
    offerings: null,
    sources: [],
    latestSignals: [],
    sentiment: null,
    competitors: [],
    error: "Limited public information available for this company",
  };
}
