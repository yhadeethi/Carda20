import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface AIParseResult {
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  address: string;
  website: string;
}

const SYSTEM_PROMPT = `You are an expert business card parser.

INPUT:
You will be given ONLY the raw text extracted from a business card by OCR. The text may contain line breaks, OCR mistakes, extra spaces and marketing slogans.

GOAL:
From this noisy text, extract the REAL contact details of the human on the card and output a SINGLE JSON object with this exact shape:

{
  "name": "",
  "company": "",
  "title": "",
  "email": "",
  "phone": "",
  "mobile": "",
  "fax": "",
  "address": "",
  "website": ""
}

GENERAL RULES:
- Only use information that clearly appears on the card.
- NEVER invent, guess or hallucinate any data (especially websites).
- If a field is not present or cannot be confidently determined, leave it as an empty string "".
- Do not add any extra keys or comments. Output ONLY the JSON object.

DETAILED RULES:

1. PERSON NAME
- The person's name is usually:
  - A realistic human name (2–3 words)
  - Near a job title (e.g., "Product Manager", "Sales Director")
  - Not a pure logo word.
- DO NOT treat large stylised logos as names (e.g. "EVE", "CATL", "BYD", "LG", "TESLA", "SAMSUNG").
- If you see both a human name (e.g., "Elina Ling") and a big logo (e.g., "EVE"), use the human name for "name" and the logo/company line for "company".

2. COMPANY NAME
- The company is often:
  - Near address, city, country, or words like "Co.", "Ltd.", "Inc.", "GmbH", "Pty Ltd", "Company".
  - Possibly the same text as a large logo, but may also include suffixes (e.g. "EVE Energy Storage Co., Ltd.").
- Prefer the most complete, descriptive line as the company name, not just the logo word.

3. JOB TITLE
- Typical titles include words like: Manager, Director, Engineer, Specialist, Officer, Consultant, VP, CEO, CTO, COO, Founder, Partner, Head, Lead, Analyst, Representative, etc.
- Extract the full title (e.g., "Product Manager", "ESS Solution Center Product Manager" if that appears as one line).
- If there are multiple lines like "ESS Solution Center" and "Product Manager", treat the actual role as "Product Manager" and optional department text can be included if they clearly form one title.

4. EMAIL
- Must contain an "@" symbol and a domain with a dot (e.g. ".com", ".cn", ".com.au").
- If the OCR text clearly contains something like "E-mail:" or "Email:" use the address that follows.
- Do not guess emails from the person's name or company. Only use what is present.

5. PHONE / MOBILE / FAX
- Look for labels: "Tel", "Telephone", "Phone", "T:", "P:" → usually office phone.
- "Mobile", "M:", "M.P.", "Cell" → mobile phone.
- "Fax", "F:", "Fax:" → fax.
- Clean out spaces and dashes only if obvious (e.g. "0724-6079688" is fine to keep as-is).
- If there is only one unlabelled number and it clearly looks like a phone number, put it in "phone".
- If multiple numbers exist, assign them as:
  - mobile → "mobile"
  - office → "phone"
  - fax → "fax"

6. ADDRESS
- The address is usually a long string containing any of: building, room, street, avenue, road, city, postcode, state, province, country.
- Combine the full address into a single line, preserving commas and order as much as possible.
- Include room/building numbers if present (e.g., "Room 902, Building A3, Financial Harbor, No.77 Guanggu Avenue, East Lake High-tech Development Zone, Wuhan, Hubei.").
- Do NOT include email, website, phone, or slogans in the address.

7. WEBSITE
- Only extract a website if:
  - It clearly appears in the text AND
  - It contains a dot, e.g. "www.evebattery.com", "evebattery.com", "www.company.cn".
- Accept forms like:
  - "www.example.com"
  - "example.com"
  - "http://example.com"
  - "https://example.com"
- Normalise by keeping it as text as written (e.g., "www.evebattery.com").
- NEVER fabricate or guess a website such as "www.[person_name].com" or "www.[company].com" if it is not printed on the card.

8. LOGOS AND TAGLINES
- Ignore marketing phrases such as:
  - "Powering the future", "Innovative solutions", "Your trusted partner".
- Ignore QR codes and any text that is clearly a scan artifact.
- Common logo-only words (when not clearly part of a longer company line) to treat as LOGO/TAGLINE and NOT as name or title:
  - "EVE", "CATL", "BYD", "LG", "PANASONIC", "TESLA", "SAMSUNG", "HUAWEI", "ABB", "SIEMENS", "GE", "STATE GRID".
- If a logo word appears inside a longer formal company name (e.g., "EVE Energy Storage Co., Ltd."), use the full line as the company.

9. HANDLING OCR NOISE
- If the OCR text has obvious split lines (e.g. address broken over many lines), reconstruct them logically in the "address" field.
- Fix trivial OCR mistakes only when obvious (e.g., changing "E-main:" to "E-mail:" does not matter; just take the email).
- Do not change names or company names unless the correction is very clear and minor.

OUTPUT:
- Output ONLY the final JSON object.
- Do not include any explanation, prose, comments, or extra text before or after the JSON.`;

export async function parseContactWithAI(ocrText: string): Promise<AIParseResult> {
  try {
    console.log("[AI Parse] Starting AI parsing for text length:", ocrText.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: ocrText }
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    
    if (!content) {
      console.error("[AI Parse] Empty response from OpenAI");
      return emptyResult();
    }

    console.log("[AI Parse] Raw response:", content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI Parse] No JSON found in response");
      return emptyResult();
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIParseResult;
    
    return {
      name: parsed.name || "",
      company: parsed.company || "",
      title: parsed.title || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      mobile: parsed.mobile || "",
      fax: parsed.fax || "",
      address: parsed.address || "",
      website: parsed.website || "",
    };
  } catch (error) {
    console.error("[AI Parse] Error:", error);
    return emptyResult();
  }
}

function emptyResult(): AIParseResult {
  return {
    name: "",
    company: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    address: "",
    website: "",
  };
}

export function convertAIResultToContact(aiResult: AIParseResult) {
  const phone = aiResult.mobile || aiResult.phone;
  
  // Validate website - must contain a dot to be a real URL
  let website = aiResult.website || "";
  if (website && !website.includes(".")) {
    console.log("[AI Parse] Rejecting invalid website (no dot):", website);
    website = "";
  }
  
  return {
    fullName: aiResult.name || undefined,
    jobTitle: aiResult.title || undefined,
    companyName: aiResult.company || undefined,
    email: aiResult.email || undefined,
    phone: phone || undefined,
    website: website || undefined,
    address: aiResult.address || undefined,
    mobile: aiResult.mobile || undefined,
    fax: aiResult.fax || undefined,
  };
}
