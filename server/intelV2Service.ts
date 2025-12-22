import OpenAI from "openai";
import { CompanyIntelV2, IntelSource, VerifiedBullet, SignalItem, HeadcountRange } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface SourceSnippet {
  sourceTitle: string;
  url: string;
  textExcerpt: string;
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
  
  const wikiInfo = await fetchWikipediaSummary(companyName);
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
    const websiteSnippets = await fetchWebsiteContent(domain, ["/", "/about", "/about-us", "/company"]);
    snippets.push(...websiteSnippets);
  }
  
  let stockData: { series: Array<{ date: string; close: number }>; lastPrice?: number; changePercent?: number } | null = null;
  if (ticker) {
    stockData = await fetchStockData(ticker);
  }
  
  if (snippets.length === 0) {
    return createEmptyIntel(companyName, domain);
  }
  
  const llmResult = await callLLMForIntel(companyName, domain, contactRole, snippets);
  
  const headcount = parseHeadcount(snippets.map(s => s.textExcerpt).join(" "));
  
  const intel: CompanyIntelV2 = {
    companyName,
    website: domain,
    lastRefreshedAt: new Date().toISOString(),
    headcount: headcount && wikipediaUrl ? {
      range: headcount,
      source: { title: "Wikipedia", url: wikipediaUrl },
    } : null,
    stock: stockData && ticker ? {
      ticker,
      series: stockData.series,
      lastPrice: stockData.lastPrice,
      changePercent: stockData.changePercent,
      source: { title: "Stooq", url: `https://stooq.com/q/?s=${ticker.toLowerCase()}.us` },
    } : null,
    hq: llmResult.hq,
    verifiedFacts: llmResult.verifiedFacts,
    productsAndServices: llmResult.productsAndServices,
    latestSignals: llmResult.latestSignals,
    coaching: llmResult.coaching,
  };
  
  return intel;
}

async function callLLMForIntel(
  companyName: string,
  domain: string | null,
  contactRole: string | undefined,
  snippets: SourceSnippet[]
): Promise<{
  hq: CompanyIntelV2["hq"];
  verifiedFacts: VerifiedBullet[];
  productsAndServices: VerifiedBullet[];
  latestSignals: SignalItem[];
  coaching: CompanyIntelV2["coaching"];
}> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return { hq: null, verifiedFacts: [], productsAndServices: [], latestSignals: [], coaching: undefined };
  }
  
  const snippetText = snippets.map((s, i) => 
    `[Source ${i + 1}: ${s.sourceTitle}]\nURL: ${s.url}\n${s.textExcerpt}`
  ).join("\n\n");
  
  const systemPrompt = `You produce ONLY valid JSON that matches the CompanyIntelV2 format. Use ONLY the provided snippets as evidence. If a claim cannot be supported by a snippet + URL, do not include it. Keep it short.

Rules:
- verifiedFacts: max 8 bullets, each MUST have a source URL from the snippets
- productsAndServices: max 6 bullets, each MUST have a source URL
- latestSignals: max 5 items, each with date (YYYY-MM-DD), title, url, sourceName. Only include if within last 18 months.
- hq: only include if city/country can be verified from snippets
- coaching: these are INFERRED and do not need sources. Keep them short (max 4 talking points, 4 questions, 3 watch outs)`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || "unknown"}
Contact role: ${contactRole || "unknown"}

Snippets:
${snippetText}

Return JSON with this structure:
{
  "hq": { "city": "...", "country": "...", "sourceUrl": "..." } or null,
  "verifiedFacts": [{ "text": "...", "sourceUrl": "..." }],
  "productsAndServices": [{ "text": "...", "sourceUrl": "..." }],
  "latestSignals": [{ "date": "YYYY-MM-DD", "title": "...", "url": "...", "sourceName": "..." }],
  "coaching": { "talkingPoints": [...], "questions": [...], "watchOuts": [...] }
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
      return { hq: null, verifiedFacts: [], productsAndServices: [], latestSignals: [], coaching: undefined };
    }
    
    const parsed = JSON.parse(content);
    
    const verifiedFacts: VerifiedBullet[] = (parsed.verifiedFacts || [])
      .filter((f: { text?: string; sourceUrl?: string }) => f.text && f.sourceUrl)
      .slice(0, 8)
      .map((f: { text: string; sourceUrl: string }) => ({
        text: f.text,
        source: { title: new URL(f.sourceUrl).hostname, url: f.sourceUrl },
      }));
    
    const productsAndServices: VerifiedBullet[] = (parsed.productsAndServices || [])
      .filter((p: { text?: string; sourceUrl?: string }) => p.text && p.sourceUrl)
      .slice(0, 6)
      .map((p: { text: string; sourceUrl: string }) => ({
        text: p.text,
        source: { title: new URL(p.sourceUrl).hostname, url: p.sourceUrl },
      }));
    
    const latestSignals: SignalItem[] = (parsed.latestSignals || [])
      .filter((s: { date?: string; title?: string; url?: string }) => s.date && s.title && s.url)
      .slice(0, 5)
      .map((s: { date: string; title: string; url: string; sourceName?: string }) => ({
        date: s.date,
        title: s.title,
        url: s.url,
        sourceName: s.sourceName || new URL(s.url).hostname,
      }));
    
    let hq: CompanyIntelV2["hq"] = null;
    if (parsed.hq?.city || parsed.hq?.country) {
      hq = {
        city: parsed.hq.city || null,
        country: parsed.hq.country || null,
        source: {
          title: parsed.hq.sourceUrl ? new URL(parsed.hq.sourceUrl).hostname : "Wikipedia",
          url: parsed.hq.sourceUrl || snippets[0]?.url || "",
        },
      };
    }
    
    const coaching = parsed.coaching ? {
      talkingPoints: (parsed.coaching.talkingPoints || []).slice(0, 4),
      questions: (parsed.coaching.questions || []).slice(0, 4),
      watchOuts: (parsed.coaching.watchOuts || []).slice(0, 3),
    } : undefined;
    
    return { hq, verifiedFacts, productsAndServices, latestSignals, coaching };
  } catch (error) {
    console.error("LLM call error:", error);
    return { hq: null, verifiedFacts: [], productsAndServices: [], latestSignals: [], coaching: undefined };
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
    verifiedFacts: [],
    productsAndServices: [],
    latestSignals: [],
    coaching: {
      talkingPoints: [
        "Research the company before your meeting",
        "Ask about their current priorities and challenges",
        "Look for mutual connections or shared interests",
      ],
      questions: [
        "What are your biggest priorities right now?",
        "What challenges are you trying to solve?",
        "How do you measure success in your role?",
      ],
      watchOuts: [
        "Limited public information available",
      ],
    },
    error: "Limited public information available for this company",
  };
}
