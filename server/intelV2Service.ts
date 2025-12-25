import OpenAI from "openai";
import { CompanyIntelV2, IntelSource, SignalItem, HeadcountRange, StockData, CompetitorInfo, ApolloEnrichmentData } from "@shared/schema";
import { db } from "./db";
import { apolloCache } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

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
    // Use simple query without quotes for better results
    const query = encodeURIComponent(companyName);
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

async function fetchYahooFinanceStock(ticker: string): Promise<StockData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CardaBot/1.0)",
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
    if (price && previousClose) {
      changePercent = ((price - previousClose) / previousClose) * 100;
    }
    
    return {
      ticker: ticker.toUpperCase(),
      exchange: meta?.exchangeName || null,
      price: price || null,
      changePercent: changePercent ? Math.round(changePercent * 100) / 100 : null,
      currency: meta?.currency || "USD",
    };
  } catch (error) {
    console.log("Yahoo Finance fetch error:", error);
    return null;
  }
}

// Apollo.io Organization Enrichment API
async function fetchApolloEnrichment(domain: string): Promise<ApolloEnrichmentData | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    console.log("Apollo: No API key configured");
    return null;
  }
  
  try {
    // Check cache first (30-day expiry)
    const cached = await db.select()
      .from(apolloCache)
      .where(eq(apolloCache.domain, domain))
      .limit(1);
    
    if (cached.length > 0 && cached[0].cachedAt) {
      const cacheAge = Date.now() - new Date(cached[0].cachedAt).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (cacheAge < thirtyDays && cached[0].apolloData) {
        console.log(`Apollo: Cache hit for ${domain}`);
        return cached[0].apolloData;
      }
    }
    
    console.log(`Apollo: Fetching enrichment for ${domain}`);
    const response = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ domain }),
    });
    
    if (!response.ok) {
      console.log(`Apollo: API error ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const org = data.organization;
    
    if (!org) {
      console.log(`Apollo: No organization found for ${domain}`);
      return null;
    }
    
    const enrichmentData: ApolloEnrichmentData = {
      name: org.name || null,
      websiteUrl: org.website_url || null,
      linkedinUrl: org.linkedin_url || null,
      twitterUrl: org.twitter_url || null,
      facebookUrl: org.facebook_url || null,
      industry: org.industry || null,
      employeeCount: org.estimated_num_employees || null,
      employeeCountRange: null,
      foundedYear: org.founded_year || null,
      city: org.city || null,
      state: org.state || null,
      country: org.country || null,
      description: org.short_description || org.seo_description || null,
      logoUrl: org.logo_url || null,
      ceoName: null, // Apollo doesn't directly provide this
      annualRevenue: org.annual_revenue || null,
      annualRevenueFormatted: org.annual_revenue_printed || null,
      totalFunding: org.total_funding || null,
      totalFundingFormatted: org.total_funding_printed || null,
      latestFundingRoundType: org.latest_funding_round_type || null,
      latestFundingAmount: org.latest_funding_amount || null,
      technologies: org.technologies || null,
    };
    
    // Convert employee count to range
    if (enrichmentData.employeeCount) {
      const count = enrichmentData.employeeCount;
      if (count <= 10) enrichmentData.employeeCountRange = "1-10";
      else if (count <= 50) enrichmentData.employeeCountRange = "11-50";
      else if (count <= 200) enrichmentData.employeeCountRange = "51-200";
      else if (count <= 500) enrichmentData.employeeCountRange = "201-500";
      else if (count <= 1000) enrichmentData.employeeCountRange = "501-1k";
      else if (count <= 5000) enrichmentData.employeeCountRange = "1k-5k";
      else if (count <= 10000) enrichmentData.employeeCountRange = "5k-10k";
      else enrichmentData.employeeCountRange = "10k+";
    }
    
    // Cache the result
    await db.insert(apolloCache)
      .values({
        domain,
        apolloData: enrichmentData,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: apolloCache.domain,
        set: {
          apolloData: enrichmentData,
          cachedAt: new Date(),
        },
      });
    
    console.log(`Apollo: Successfully enriched ${domain}`);
    return enrichmentData;
  } catch (error) {
    console.error("Apollo enrichment error:", error);
    return null;
  }
}

// Check if key intel fields are missing (triggers Apollo fallback)
function needsApolloEnrichment(llmResult: LLMIntelResult, headcount: HeadcountRange | null): boolean {
  const missingFields = [];
  if (!headcount && !llmResult.headcount) missingFields.push("headcount");
  if (!llmResult.industry) missingFields.push("industry");
  if (!llmResult.founded) missingFields.push("founded");
  if (!llmResult.founderOrCeo) missingFields.push("CEO");
  
  // Need at least 2 missing fields to justify an API call
  const needsEnrichment = missingFields.length >= 2;
  if (needsEnrichment) {
    console.log(`Intel: Missing fields [${missingFields.join(", ")}] - will try Apollo fallback`);
  }
  return needsEnrichment;
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
  contactRole?: string,
  contactAddress?: string
): Promise<CompanyIntelV2> {
  console.log(`[IntelV2] Starting for company: "${companyName}", domain: "${domain}"`);
  
  const snippets: SourceSnippet[] = [];
  let wikipediaUrl: string | undefined;
  let wikiTicker: string | undefined;
  
  console.log(`[IntelV2] Fetching Wikipedia and Google News in parallel...`);
  const [wikiInfo, newsItems] = await Promise.all([
    fetchWikipediaSummary(companyName),
    fetchGoogleNewsRSS(companyName),
  ]);
  
  console.log(`[IntelV2] Wikipedia result: ${wikiInfo ? "found" : "not found"}`);
  console.log(`[IntelV2] News items fetched: ${newsItems.length}`);
  
  if (wikiInfo?.extract) {
    snippets.push({
      sourceTitle: "Wikipedia",
      url: wikiInfo.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(companyName)}`,
      textExcerpt: wikiInfo.extract,
    });
    wikipediaUrl = wikiInfo.pageUrl;
    wikiTicker = wikiInfo.ticker;
  }
  
  if (domain) {
    console.log(`[IntelV2] Fetching website content for domain: ${domain}`);
    const websiteSnippets = await fetchWebsiteContent(domain, ["/", "/about", "/about-us", "/company", "/products", "/services"]);
    console.log(`[IntelV2] Website snippets fetched: ${websiteSnippets.length}`);
    snippets.push(...websiteSnippets);
  }
  
  // Limit news to 4 items as requested
  const latestSignals: SignalItem[] = newsItems.slice(0, 4).map(item => ({
    date: parseNewsDate(item.pubDate),
    title: item.title,
    url: item.link,
    sourceName: item.source,
  }));
  console.log(`[IntelV2] Signals (news) created: ${latestSignals.length}`);
  
  if (snippets.length === 0 && newsItems.length === 0) {
    console.log(`[IntelV2] No data found, returning empty intel`);
    return createEmptyIntel(companyName, domain);
  }
  
  console.log(`[IntelV2] Calling LLM for intel extraction...`);
  const llmResult = await callLLMForIntel(companyName, domain, snippets);
  console.log(`[IntelV2] LLM result - headcount: ${llmResult.headcount}, industry: ${llmResult.industry}, founded: ${llmResult.founded}, CEO: ${llmResult.founderOrCeo}`);
  
  let headcount = llmResult.headcount || parseHeadcount(snippets.map(s => s.textExcerpt).join(" "));
  let industry = llmResult.industry;
  let founded = llmResult.founded;
  let founderOrCeo = llmResult.founderOrCeo;
  let hq = llmResult.hq;
  let linkedinUrl = llmResult.linkedinUrl;
  let twitterUrl = llmResult.twitterUrl;
  let facebookUrl = llmResult.facebookUrl;
  
  // Smart fallback: Only call Apollo if key fields are missing and we have a domain
  let apolloData: ApolloEnrichmentData | null = null;
  console.log(`[IntelV2] Checking Apollo fallback - domain: ${domain}, APOLLO_API_KEY set: ${!!process.env.APOLLO_API_KEY}`);
  if (domain && needsApolloEnrichment(llmResult, headcount)) {
    console.log(`[IntelV2] Apollo fallback triggered - calling Apollo API...`);
    apolloData = await fetchApolloEnrichment(domain);
    console.log(`[IntelV2] Apollo result: ${apolloData ? "data received" : "no data"}`);
  } else {
    console.log(`[IntelV2] Apollo fallback NOT triggered - ${!domain ? "no domain" : "enough fields from LLM"}`);
  }
  
  if (apolloData) {
    // Fill in missing fields from Apollo
    if (!headcount && apolloData.employeeCountRange) {
      headcount = apolloData.employeeCountRange as HeadcountRange;
      console.log(`Intel: Apollo provided headcount: ${headcount}`);
    }
    if (!industry && apolloData.industry) {
      industry = apolloData.industry;
      console.log(`Intel: Apollo provided industry: ${industry}`);
    }
    if (!founded && apolloData.foundedYear) {
      founded = apolloData.foundedYear.toString();
      console.log(`Intel: Apollo provided founded: ${founded}`);
    }
    // Apollo doesn't provide CEO directly, but we can get other useful data
    if (!linkedinUrl && apolloData.linkedinUrl) {
      linkedinUrl = apolloData.linkedinUrl;
    }
    if (!twitterUrl && apolloData.twitterUrl) {
      twitterUrl = apolloData.twitterUrl;
    }
    if (!facebookUrl && apolloData.facebookUrl) {
      facebookUrl = apolloData.facebookUrl;
    }
    if (!hq && (apolloData.city || apolloData.country)) {
      hq = {
        city: apolloData.city,
        country: apolloData.country,
        source: { title: "Apollo.io", url: `https://app.apollo.io/#/companies?organization_id=${domain}` },
      };
    }
  }
  
  // Use ticker from LLM or Wikipedia extraction
  const ticker = llmResult.ticker || wikiTicker;
  
  // Fetch stock data if ticker available
  let stockData: StockData | null = null;
  if (ticker) {
    stockData = await fetchYahooFinanceStock(ticker);
  }
  
  // Default LinkedIn URL if none found
  const finalLinkedinUrl = linkedinUrl || `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
  
  const allSources: IntelSource[] = [
    ...snippets.map(s => ({ title: s.sourceTitle, url: s.url })),
    ...newsItems.slice(0, 3).map(n => ({ title: n.source, url: n.link })),
  ];
  
  // Add Apollo as source if we used it
  if (apolloData) {
    allSources.push({ title: "Apollo.io", url: `https://app.apollo.io` });
  }
  
  const intel: CompanyIntelV2 = {
    companyName,
    website: domain,
    lastRefreshedAt: new Date().toISOString(),
    
    // Section 1: Company Profile
    summary: llmResult.summary || apolloData?.description || null,
    industry,
    founded,
    founderOrCeo,
    
    // Social links
    linkedinUrl: finalLinkedinUrl,
    twitterUrl,
    facebookUrl,
    instagramUrl: llmResult.instagramUrl,
    
    // Section 2: Quick Visual Cards
    headcount: headcount ? {
      range: headcount,
      source: apolloData ? { title: "Apollo.io", url: "https://app.apollo.io" } : { title: "Wikipedia", url: wikipediaUrl || snippets[0]?.url || "" },
    } : null,
    hq,
    stock: stockData,
    
    // Section 3: Recent News
    latestSignals,
    
    // Section 4: Competitors
    competitors: llmResult.competitors,
    
    sources: allSources,
  };
  
  return intel;
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
    hq: null, headcount: null, industry: null, summary: null, founded: null,
    founderOrCeo: null, ticker: null, linkedinUrl: null, twitterUrl: null,
    facebookUrl: null, instagramUrl: null, competitors: []
  };
  
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return emptyResult;
  }
  
  const snippetText = snippets.map((s, i) => 
    `[Source ${i + 1}: ${s.sourceTitle}]\nURL: ${s.url}\n${s.textExcerpt}`
  ).join("\n\n");
  
  const systemPrompt = `You produce ONLY valid JSON. Extract company details from provided snippets. Never fabricate data - only include what you find in the snippets.

Extract these fields:
- summary: 1-2 sentence company description (what they do)
- hq: headquarters city and country
- headcount: employee count bucket: "1-10", "11-50", "51-200", "201-500", "501-1k", "1k-5k", "5k-10k", "10k+"
- industry: brief industry (max 5 words, e.g. "Enterprise Software", "Energy Technology")
- founded: year founded if mentioned
- founderOrCeo: current CEO or founder name if mentioned
- ticker: stock ticker symbol if publicly traded (e.g. "AAPL", "WRT1V.HE")
- socialUrls: LinkedIn, Twitter/X, Facebook, Instagram URLs if found
- competitors: 2-4 key competitors in the same industry (company names with brief descriptions)`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || "unknown"}

Snippets:
${snippetText}

Return JSON:
{
  "summary": "brief description of what the company does",
  "hq": { "city": "...", "country": "..." },
  "headcount": "bucket string or null",
  "industry": "brief industry",
  "founded": "year or null",
  "founderOrCeo": "name or null",
  "ticker": "symbol or null",
  "linkedinUrl": "url or null",
  "twitterUrl": "url or null",
  "facebookUrl": "url or null",
  "instagramUrl": "url or null",
  "competitors": [{ "name": "Company A", "description": "brief description" }]
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
      return emptyResult;
    }
    
    const parsed = JSON.parse(content);
    
    let hq: CompanyIntelV2["hq"] = null;
    if (parsed.hq?.city || parsed.hq?.country) {
      hq = {
        city: parsed.hq.city || null,
        country: parsed.hq.country || null,
        source: {
          title: "Wikipedia",
          url: snippets[0]?.url || "",
        },
      };
    }
    
    const validHeadcounts: HeadcountRange[] = ["1-10", "11-50", "51-200", "201-500", "501-1k", "1k-5k", "5k-10k", "10k+"];
    const headcount: HeadcountRange | null = validHeadcounts.includes(parsed.headcount) ? parsed.headcount : null;
    const industry: string | null = parsed.industry || null;
    const summary: string | null = parsed.summary || null;
    const founded: string | null = parsed.founded || null;
    const founderOrCeo: string | null = parsed.founderOrCeo || null;
    const ticker: string | null = parsed.ticker || null;
    
    const linkedinUrl: string | null = parsed.linkedinUrl && typeof parsed.linkedinUrl === "string" && parsed.linkedinUrl.includes("linkedin.com") ? parsed.linkedinUrl : null;
    const twitterUrl: string | null = parsed.twitterUrl && typeof parsed.twitterUrl === "string" && (parsed.twitterUrl.includes("twitter.com") || parsed.twitterUrl.includes("x.com")) ? parsed.twitterUrl : null;
    const facebookUrl: string | null = parsed.facebookUrl && typeof parsed.facebookUrl === "string" && parsed.facebookUrl.includes("facebook.com") ? parsed.facebookUrl : null;
    const instagramUrl: string | null = parsed.instagramUrl && typeof parsed.instagramUrl === "string" && parsed.instagramUrl.includes("instagram.com") ? parsed.instagramUrl : null;
    
    const competitors: CompetitorInfo[] = Array.isArray(parsed.competitors) 
      ? parsed.competitors.filter((c: { name?: string }) => c?.name).map((c: { name: string; description?: string }) => ({
          name: c.name,
          description: c.description || undefined,
        }))
      : [];
    
    return { hq, headcount, industry, summary, founded, founderOrCeo, ticker, linkedinUrl, twitterUrl, facebookUrl, instagramUrl, competitors };
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
    linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`,
    twitterUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    latestSignals: [],
    competitors: [],
    sources: [],
    error: "Limited public information available for this company",
  };
}
