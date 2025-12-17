import OpenAI from "openai";
import { CompanyIntelData, User } from "@shared/schema";
import { storage } from "./storage";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access 
// without requiring your own OpenAI API key. Charges are billed to your credits.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const INTEL_CACHE_HOURS = 24;

export interface IntelContext {
  userIndustry?: string;
  userCountry?: string;
  userCity?: string;
  userFocusTopics?: string;
}

function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  
  let domain = input.toLowerCase().trim();
  
  if (domain.includes("@")) {
    const parts = domain.split("@");
    domain = parts[parts.length - 1];
  }
  
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");
  domain = domain.split("/")[0];
  domain = domain.split("?")[0];
  
  if (domain.includes(".")) {
    return domain;
  }
  
  return null;
}

function companyNameToDomain(companyName: string): string | null {
  if (!companyName) return null;
  
  const cleaned = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+(inc|corp|corporation|llc|ltd|limited|co|company)$/i, "")
    .trim()
    .replace(/\s+/g, "");
  
  if (cleaned.length > 0) {
    return `${cleaned}.com`;
  }
  
  return null;
}

export interface ContactContext {
  contactName?: string;
  contactTitle?: string;
}

export async function getOrCreateCompanyIntel(
  companyName: string | null,
  companyDomain: string | null,
  userContext: IntelContext,
  contactContext?: ContactContext
): Promise<CompanyIntelData | null> {
  if (!companyName && !companyDomain) {
    return null;
  }

  let domain = extractDomain(companyDomain);
  if (!domain && companyName) {
    domain = companyNameToDomain(companyName);
  }

  if (domain) {
    let company = await storage.getCompanyByDomain(domain);
    
    if (company) {
      const existingIntel = await storage.getCompanyIntelByCompanyId(company.id);
      
      if (existingIntel && existingIntel.createdAt) {
        const cacheAge = Date.now() - new Date(existingIntel.createdAt).getTime();
        const cacheMaxAge = INTEL_CACHE_HOURS * 60 * 60 * 1000;
        
        if (cacheAge < cacheMaxAge && existingIntel.intelJson) {
          const cachedIntel = existingIntel.intelJson as CompanyIntelData;
          
          // Check if this is legacy intel (missing new sales brief fields or enhanced intel)
          const isLegacyFormat = !cachedIntel.companySnapshot || 
                                 !cachedIntel.whyTheyMatterToYou || 
                                 !cachedIntel.roleInsights;
          
          // Check if missing any enhanced intel field (funding, techStack, or competitors)
          const isMissingEnhancedIntel = !cachedIntel.funding || 
                                          !cachedIntel.techStack || 
                                          !cachedIntel.competitors;
          
          if (!isLegacyFormat && !isMissingEnhancedIntel) {
            return cachedIntel;
          }
          // Legacy format or missing enhanced intel - regenerate with new structure
          console.log(`Intel: Regenerating intel for ${domain} with enhanced format (funding/tech/competitors)`);
        }
      }
    } else {
      company = await storage.createCompany({
        domain,
        name: companyName,
      });
    }

    const freshIntel = await generateCompanyIntel(
      companyName || company.name || domain,
      domain,
      userContext,
      contactContext
    );

    if (freshIntel) {
      await storage.createCompanyIntel({
        companyId: company.id,
        intelJson: freshIntel,
      });

      await storage.updateCompany(company.id, {
        lastEnrichedAt: new Date(),
        name: companyName || company.name,
      });

      return freshIntel;
    }
  }

  const freshIntel = await generateCompanyIntel(
    companyName || "Unknown Company",
    null,
    userContext,
    contactContext
  );

  return freshIntel;
}

/**
 * Generate fallback intel when API fails
 */
function generateFallbackIntel(
  companyName: string,
  domain: string | null,
  contactContext?: ContactContext,
  errorReason?: string
): CompanyIntelData {
  const contactTitle = contactContext?.contactTitle || "this professional";
  
  return {
    companySnapshot: `${companyName} is a company${domain ? ` (${domain})` : ""}. Additional details could not be retrieved at this time.`,
    whyTheyMatterToYou: [
      "Research their industry positioning before the meeting",
      "Look for mutual connections or shared interests",
      "Check their website and recent announcements"
    ],
    roleInsights: [
      `Ask about their specific responsibilities as ${contactTitle}`,
      "Understand their key priorities and challenges",
      "Learn about their team structure and reporting lines"
    ],
    highImpactQuestions: [
      `What are your biggest priorities at ${companyName} right now?`,
      "What challenges are you trying to solve this quarter?",
      "How do you measure success in your role?",
      "What would make your life easier?"
    ],
    risksOrSensitivities: [],
    keyDevelopments: [],
    generatedAt: new Date().toISOString(),
    error: errorReason
  };
}

async function generateCompanyIntel(
  companyName: string,
  domain: string | null,
  userContext: IntelContext,
  contactContext?: ContactContext
): Promise<CompanyIntelData> {
  // Check API configuration
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.error("Intel Error: AI_INTEGRATIONS_OPENAI_API_KEY not configured");
    return generateFallbackIntel(companyName, domain, contactContext, "API key not configured");
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    console.error("Intel Error: AI_INTEGRATIONS_OPENAI_BASE_URL not configured");
    return generateFallbackIntel(companyName, domain, contactContext, "API base URL not configured");
  }

  try {
    const userContextStr = buildUserContextPrompt(userContext);
    const contactName = contactContext?.contactName || "the contact";
    const contactTitle = contactContext?.contactTitle || "professional";
    
    const prompt = `You are a senior sales intelligence analyst preparing a focused briefing for a B2B sales professional.

**Target Company:** ${companyName}${domain ? ` (${domain})` : ""}
**Contact Name:** ${contactName}
**Contact Title:** ${contactTitle}

${userContextStr}

Generate a comprehensive sales brief in JSON format. Be specific, punchy, and actionable. Avoid generic corporate-speak. Everything should be role- and industry-specific.

Return a JSON object with this EXACT structure:
{
  "companySnapshot": "2-3 sentences describing what this company actually does and who they serve. Be specific about their market position.",
  
  "whyTheyMatterToYou": [
    "Specific reason this company is relevant to someone selling B2B solutions (use the domain/industry)",
    "Another angle tied to scale, geography, or strategy",
    "Optional third angle if relevant"
  ],
  
  "roleInsights": [
    "What someone with the title '${contactTitle}' at this type of company typically cares about (KPIs, problems, responsibilities)",
    "Be concrete and role-specific, not generic corporate-speak",
    "Include technical/operational focus if the role is engineering/operations"
  ],
  
  "highImpactQuestions": [
    "Short, sharp question the user could literally ask in a first meeting",
    "Another question that surfaces business pain or priorities",
    "Another question tying to risk, roadmap, or timelines",
    "Keep each question 1-2 lines max"
  ],
  
  "risksOrSensitivities": [
    "Potential landmines or sensitive topics (regulation, recent setbacks, major competitor relationships) if any are known",
    "Only include if you have specific knowledge; otherwise leave this array empty or very short"
  ],
  
  "keyDevelopments": [
    {
      "headline": "Important past event or strategic move (may not be recent)",
      "approxDate": "Month Year (or just Year if approximate)",
      "summary": "1-2 lines on why this matters for a salesperson",
      "note": "Based on historical information up to the model's knowledge cutoff"
    }
  ],
  
  "funding": {
    "totalRaised": "Total funding raised if known (e.g., '$150M total') or null if unknown/bootstrapped",
    "fundingStage": "Current stage: 'Bootstrapped', 'Seed', 'Series A', 'Series B', 'Series C+', 'Pre-IPO', 'Public', etc.",
    "ipoStatus": "'Private', 'Public (NYSE: XYZ)', or similar",
    "latestRound": {
      "type": "Series B (example)",
      "amount": "$50M (example)",
      "date": "March 2024 (example)",
      "leadInvestors": ["Lead investor name if known"]
    },
    "investors": ["Notable investors if known - Sequoia, a16z, etc."]
  },
  
  "techStack": {
    "categories": [
      {
        "category": "Frontend/Web",
        "technologies": ["React", "Next.js", "TypeScript", etc. - include what you know or can infer]
      },
      {
        "category": "Backend/Infrastructure", 
        "technologies": ["AWS", "Python", "PostgreSQL", etc.]
      },
      {
        "category": "Analytics/Marketing",
        "technologies": ["Google Analytics", "Salesforce", "HubSpot", etc.]
      }
    ],
    "highlights": [
      "Key insight about their tech choices relevant to sales (e.g., 'Heavy AWS investment suggests cloud-first strategy')",
      "Another tech-related insight if relevant"
    ]
  },
  
  "competitors": {
    "directCompetitors": [
      {
        "name": "Competitor name",
        "description": "What they do in 1 line",
        "differentiator": "How ${companyName} differs from them"
      }
    ],
    "indirectCompetitors": [
      {
        "name": "Adjacent player name",
        "description": "What they do"
      }
    ],
    "marketPosition": "1-2 sentences on where ${companyName} stands competitively - leader, challenger, niche player, etc."
  },
  
  "generatedAt": "${new Date().toISOString()}"
}

Guidelines:
- Use short, punchy bullets - not long paragraphs
- Make everything role- and industry-specific based on the title + company domain
- highImpactQuestions should be questions you could literally read out in a meeting
- keyDevelopments is NOT live news - just key historical developments you know about. Limit to 3-4 most important items
- If you have little reliable info about the company, keep keyDevelopments short or empty rather than guessing
- risksOrSensitivities should only include specific known issues, not generic warnings
- For funding: If unknown, set fields to null or use "Unknown" - don't guess amounts. Bootstrapped companies should have fundingStage: "Bootstrapped"
- For techStack: Include technologies you're confident about. Categories can be: Frontend/Web, Backend/Infrastructure, Analytics/Marketing, DevOps/Cloud, Data/ML, Communication/Collaboration
- For competitors: Include 2-4 direct competitors and 1-2 indirect if relevant. Focus on competitors the salesperson should know about`;

    console.log(`Intel: Generating intel for ${companyName}${domain ? ` (${domain})` : ""}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for more reliable responses
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 4096, // Increased for enhanced intel with funding/tech/competitors
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("Intel Error: No content in OpenAI response");
      return generateFallbackIntel(companyName, domain, contactContext, "No response from AI service");
    }

    console.log(`Intel: Successfully generated intel for ${companyName}`);
    
    const intel = JSON.parse(content) as CompanyIntelData;
    intel.generatedAt = new Date().toISOString();
    
    return intel;
  } catch (error: unknown) {
    // Detailed error logging
    const err = error as { status?: number; message?: string; code?: string; response?: { status?: number; data?: unknown } };
    
    console.error("Intel Error: Failed to generate company intel");
    console.error("  Company:", companyName);
    console.error("  Domain:", domain);
    
    if (err.status) {
      console.error("  HTTP Status:", err.status);
    }
    if (err.response?.status) {
      console.error("  Response Status:", err.response.status);
    }
    if (err.code) {
      console.error("  Error Code:", err.code);
    }
    if (err.message) {
      console.error("  Error Message:", err.message);
    }
    
    // Determine user-friendly error reason
    let errorReason = "AI service temporarily unavailable";
    
    if (err.status === 401 || err.response?.status === 401) {
      errorReason = "API authentication failed";
    } else if (err.status === 429 || err.response?.status === 429) {
      errorReason = "Rate limit exceeded - please try again later";
    } else if (err.status === 500 || err.response?.status === 500) {
      errorReason = "AI service error - please try again";
    } else if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
      errorReason = "Could not connect to AI service";
    }
    
    return generateFallbackIntel(companyName, domain, contactContext, errorReason);
  }
}

function buildUserContextPrompt(context: IntelContext): string {
  const parts: string[] = [];
  
  if (context.userIndustry) {
    parts.push(`The user works in the ${context.userIndustry} industry`);
  }
  
  if (context.userCountry || context.userCity) {
    const location = [context.userCity, context.userCountry].filter(Boolean).join(", ");
    parts.push(`The user is based in ${location}`);
  }
  
  if (context.userFocusTopics) {
    parts.push(`The user's focus areas include: ${context.userFocusTopics}`);
  }
  
  if (parts.length === 0) {
    return "Generate general business talking points suitable for any professional context.";
  }
  
  return `User context for personalization:\n${parts.join("\n")}\n\nTailor the talking points to be relevant to the user's industry, location, and interests.`;
}

export async function parseContactFromText(text: string): Promise<{
  fullName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  companyDomain?: string;
}> {
  try {
    const prompt = `Extract contact information from the following text (email signature, business card text, or similar):

"""
${text}
"""

Return a JSON object with these fields (use null for missing information):
{
  "fullName": "Person's full name",
  "companyName": "Company or organization name",
  "jobTitle": "Job title or role",
  "email": "Email address",
  "phone": "Phone number (include country code if present)",
  "website": "Website URL",
  "linkedinUrl": "LinkedIn profile URL",
  "companyDomain": "Company domain extracted from email or website"
}

Be accurate and only extract information that is clearly present in the text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("No content in OpenAI response for contact parsing");
      return {};
    }

    const parsed = JSON.parse(content);
    
    const result: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && value !== null && value !== "null" && value !== "") {
        result[key] = String(value);
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing contact from text:", error);
    return {};
  }
}

export async function parseContactFromImage(imageBase64: string): Promise<{
  fullName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  companyDomain?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all contact information from this business card image.

Return a JSON object with these fields (use null for missing information):
{
  "fullName": "Person's full name",
  "companyName": "Company or organization name",
  "jobTitle": "Job title or role",
  "email": "Email address",
  "phone": "Phone number (include country code if present)",
  "website": "Website URL",
  "linkedinUrl": "LinkedIn profile URL",
  "companyDomain": "Company domain extracted from email or website"
}

Be accurate and only extract information that is clearly visible on the card.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("No content in OpenAI response for image parsing");
      return {};
    }

    const parsed = JSON.parse(content);
    
    const result: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && value !== null && value !== "null" && value !== "") {
        result[key] = String(value);
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing contact from image:", error);
    return {};
  }
}
