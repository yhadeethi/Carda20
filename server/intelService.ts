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

export async function getOrCreateCompanyIntel(
  companyName: string | null,
  companyDomain: string | null,
  userContext: IntelContext
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
          return existingIntel.intelJson as CompanyIntelData;
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
      userContext
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
    userContext
  );

  return freshIntel;
}

async function generateCompanyIntel(
  companyName: string,
  domain: string | null,
  userContext: IntelContext
): Promise<CompanyIntelData | null> {
  try {
    const userContextStr = buildUserContextPrompt(userContext);
    
    const prompt = `You are a business intelligence analyst helping a sales professional prepare for a meeting.

Company to research: ${companyName}${domain ? ` (${domain})` : ""}

${userContextStr}

Provide comprehensive company intelligence in JSON format. Be specific, professional, and focus on information that would be valuable for a B2B sales or networking conversation.

Return a JSON object with this exact structure:
{
  "snapshot": {
    "industry": "Primary industry sector",
    "founded": "Year founded or 'Unknown'",
    "employees": "Employee count estimate (e.g., '50-200')",
    "headquarters": "City, Country",
    "description": "2-3 sentence company description",
    "keyProducts": ["Main product/service 1", "Main product/service 2", "Main product/service 3"]
  },
  "recentNews": [
    {
      "headline": "Recent news headline or company development",
      "date": "Approximate date (e.g., 'November 2024')",
      "summary": "Brief 1-sentence summary"
    }
  ],
  "talkingPoints": [
    "Personalized talking point relevant to the user's context",
    "Another relevant conversation starter",
    "Industry-specific insight or question"
  ],
  "generatedAt": "${new Date().toISOString()}"
}

Generate 2-3 news items and 3-4 talking points. If you don't have specific information about the company, make reasonable inferences based on the industry and company name, but keep the information realistic and useful.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("No content in OpenAI response");
      return null;
    }

    const intel = JSON.parse(content) as CompanyIntelData;
    intel.generatedAt = new Date().toISOString();
    
    return intel;
  } catch (error) {
    console.error("Error generating company intel:", error);
    return null;
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
