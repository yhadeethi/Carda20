export interface ParsedContact {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  address?: string;
}

export interface SplitAddress {
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

/**
 * Split an AU address string into vCard ADR components
 * Handles formats like:
 * - "45B/2 Park Street, Sydney NSW 2000 Australia"
 * - "Ground Floor, 109 Burwood Road Hawthorn VIC 3122"
 */
export function splitAuAddress(address: string | undefined): SplitAddress {
  if (!address) {
    return { street: "", city: "", state: "", postcode: "", country: "" };
  }

  const trimmed = address.replace(/\s+/g, " ").trim();

  // Try to match AU address formats with comma separating street from city
  // Pattern: "Street Address, City STATE POSTCODE [Country]"
  let match = trimmed.match(
    /^(.*?),\s*([A-Za-z ]+)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})(?:\s+(Australia|AU|AUS))?$/i
  );

  if (match) {
    const [, street, city, state, postcode, countryRaw] = match;
    return {
      street: street.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      postcode: postcode.trim(),
      country: countryRaw ? countryRaw.trim() : "Australia",
    };
  }

  // Try format without comma: "Street City STATE POSTCODE [Country]"
  // This is trickier - try to find where city starts by looking for state code
  match = trimmed.match(
    /^(.+?)\s+([A-Za-z]+)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})(?:\s+(Australia|AU|AUS))?$/i
  );

  if (match) {
    const [, streetAndMaybeCity, city, state, postcode, countryRaw] = match;
    return {
      street: streetAndMaybeCity.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      postcode: postcode.trim(),
      country: countryRaw ? countryRaw.trim() : "Australia",
    };
  }

  // Fallback: treat entire string as street
  return {
    street: trimmed,
    city: "",
    state: "",
    postcode: "",
    country: "",
  };
}

/**
 * Check if a string looks like an address (not a company name)
 */
export function looksLikeAddress(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  
  // Heuristics: contains AU state code or postcode or common address words
  const hasState = /\b(nsw|vic|qld|wa|sa|tas|act|nt)\b/.test(t);
  const hasPostcode = /\b\d{4}\b/.test(t);
  const hasAddressWord = /(street|st\.|road|rd\.|ave|avenue|floor|lvl|level|drive|dr\.|boulevard|blvd|lane|ln\.|place|pl\.|way|court|ct\.|terrace|tce|crescent|cres|highway|hwy|parade|pde)/i.test(t);
  
  return hasState || hasPostcode || hasAddressWord;
}

/**
 * Fix company name when it appears to be an address
 * Uses email domain to find the real company name in the raw text
 */
export function fixCompanyIfAddress(contact: ParsedContact, rawText: string): ParsedContact {
  // If company doesn't look like an address, leave it
  if (contact.companyName && !looksLikeAddress(contact.companyName)) {
    return contact;
  }

  const lines = rawText
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  // Get base domain from email for matching
  const email = contact.email || "";
  const domainMatch = email.match(/@([A-Za-z0-9.-]+)/);
  const baseDomain = domainMatch ? domainMatch[1].split('.')[0].toLowerCase() : null;

  let bestCompany = "";

  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Skip if this line IS the detected (wrong) company
    if (contact.companyName && line === contact.companyName) continue;
    
    // Skip email, URL, phone lines
    if (lower.includes("@")) continue;
    if (lower.startsWith("http") || lower.includes("www.")) continue;
    if (/^\+?\d[\d\s()-]{6,}/.test(line)) continue;
    
    // Skip lines that look like addresses
    if (looksLikeAddress(line)) continue;
    
    // Skip lines that look like job titles
    if (looksLikeTitle(line)) continue;
    
    // Skip lines that look like names (short, title case, 2-4 words)
    if (isTitleCase(line) && line.split(/\s+/).length <= 3 && line.length < 30) {
      // Could be a name - check if it has a company suffix
      if (!hasCompanySuffix(line)) continue;
    }
    
    // If line contains the base domain as words (e.g. "Flow Power" for flowpower.com.au), prefer it
    if (baseDomain && lower.includes(baseDomain)) {
      bestCompany = line;
      break;
    }
    
    // If line has a company suffix, it's likely the company
    if (hasCompanySuffix(line) && !bestCompany) {
      bestCompany = line;
    }
  }

  if (bestCompany) {
    contact.companyName = bestCompany;
  }

  return contact;
}

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{1,4}\)?[-.\s]?)?(?:\d{1,4}[-.\s]?){2,4}\d{1,4}/g;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9_-]+\/?/gi;

// Common TLDs for website detection (expanded list covering most real-world cases)
const VALID_TLDS = [
  // Generic TLDs
  "com", "org", "net", "io", "co", "ai", "app", "dev", "tech", "biz", "info",
  "edu", "gov", "mil", "int", "pro", "name", "aero", "coop", "museum",
  // New gTLDs (popular ones)
  "solutions", "services", "consulting", "digital", "agency", "studio", "design",
  "systems", "cloud", "software", "online", "store", "shop", "energy", "global",
  "group", "holdings", "capital", "finance", "ventures", "partners", "legal",
  "media", "marketing", "technology", "engineering", "construction", "health",
  "education", "academy", "institute", "foundation", "center", "centre",
  "network", "zone", "world", "life", "work", "space", "site", "website",
  "company", "business", "enterprises", "industries", "international",
  // Country code TLDs
  "au", "uk", "de", "fr", "es", "it", "nl", "be", "ch", "at", "nz", "ca", "us",
  "jp", "cn", "kr", "sg", "hk", "tw", "in", "pk", "ae", "sa", "za", "br", "mx",
  "ar", "cl", "co", "pe", "ve", "ru", "pl", "cz", "hu", "ro", "bg", "ua", "tr",
  "gr", "pt", "se", "no", "fi", "dk", "ie", "is", "il", "eg", "ng", "ke", "gh",
  "my", "ph", "th", "vn", "id", "bd",
  // Compound TLDs
  "com.au", "co.uk", "co.nz", "com.br", "co.za", "co.in", "com.sg", "com.hk",
  "co.jp", "co.kr", "com.mx", "com.ar", "co.th", "com.my", "com.ph", "co.id",
  "org.uk", "org.au", "net.au", "gov.au", "edu.au", "ac.uk", "gov.uk",
  // Misc popular
  "eu", "asia", "me", "tv", "cc", "ws", "fm", "ly", "to", "gg", "xyz", "club",
  "link", "click", "news", "live", "one", "plus", "today", "tips", "guide",
  "blog", "video", "photos", "games", "tools", "reviews", "directory"
];

// Field label patterns (for labeled lines like "m:", "e:", "w:")
const FIELD_LABEL_REGEX = /^(?:m|mobile|t|tel|telephone|p|phone|ph|f|fax|e|email|w|web|website|a|address|linkedin)\s*[:|\-]/i;

// Disclaimer triggers - stop parsing when we see these
const DISCLAIMER_TRIGGERS = [
  "important notice",
  "this e-mail message is intended",
  "this email message is intended",
  "confidentiality notice",
  "disclaimer",
  "this message is confidential",
  "if you are not the intended recipient",
  "this communication is intended",
  "please consider the environment",
  "this email and any attachments",
  "privilege and confidential",
  "unauthorized use",
];

// Company suffixes to identify company names
const COMPANY_SUFFIXES = [
  "pty ltd", "pty. ltd.", "pty. ltd",
  "inc", "inc.", "incorporated",
  "llc", "l.l.c.", "l.l.c",
  "ltd", "ltd.", "limited",
  "corp", "corp.", "corporation",
  "co", "co.", "company",
  "gmbh", "ag", "sa", "s.a.", "nv", "bv", "b.v.",
  "plc", "pte", "pte.", "pte ltd",
  "group", "holdings", "partners", "partnership",
  "associates", "consulting", "services", "solutions",
  "international", "enterprises", "industries",
];

// Common job title keywords
const TITLE_KEYWORDS = [
  "ceo", "cto", "cfo", "coo", "cmo", "cio", "cpo", "chro",
  "president", "vice president", "vp", "svp", "evp",
  "director", "managing director", "md",
  "manager", "general manager", "gm",
  "lead", "head", "chief",
  "engineer", "developer", "programmer", "architect", "designer",
  "analyst", "consultant", "specialist", "coordinator", "administrator",
  "executive", "officer", "partner", "founder", "co-founder", "owner",
  "sales", "marketing", "hr", "finance", "operations", "legal",
  "senior", "junior", "principal", "associate", "assistant",
  "project", "product", "program", "account", "client", "customer",
  "advisor", "strategist", "researcher", "scientist",
];

/**
 * Pre-clean raw text: split lines, trim, remove empty, stop at disclaimers
 */
function preCleanText(text: string): string[] {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  // Find where disclaimer starts and cut off there
  const cleanedLines: string[] = [];
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const isDisclaimer = DISCLAIMER_TRIGGERS.some(trigger => lowerLine.includes(trigger));
    if (isDisclaimer) break;
    cleanedLines.push(line);
  }
  
  return cleanedLines;
}

/**
 * Check if a line looks like a field label (m:, e:, w:, etc.)
 */
function hasFieldLabel(line: string): boolean {
  return FIELD_LABEL_REGEX.test(line);
}

/**
 * Check if line contains a company suffix
 */
function hasCompanySuffix(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return COMPANY_SUFFIXES.some(suffix => {
    // Check for suffix at word boundary
    const regex = new RegExp(`\\b${suffix.replace(/\./g, '\\.?')}\\b`, 'i');
    return regex.test(lowerLine);
  });
}

/**
 * Check if line looks like a job title
 */
function looksLikeTitle(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return TITLE_KEYWORDS.some(keyword => lowerLine.includes(keyword));
}

/**
 * Check if line is in Title Case (most words start with uppercase)
 */
function isTitleCase(line: string): boolean {
  const words = line.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return false;
  const titleCaseWords = words.filter(w => /^[A-Z]/.test(w));
  return titleCaseWords.length / words.length >= 0.6;
}

/**
 * Extract all emails from text
 */
function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.map(e => e.toLowerCase())));
}

/**
 * Extract all phone numbers from text
 */
function extractPhones(text: string, lines: string[]): string[] {
  const phones: string[] = [];
  
  // First, look for labeled phone lines
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (/^(?:m|mobile|t|tel|telephone|p|phone|ph)\s*[:|\-]/i.test(line)) {
      const phoneMatch = line.match(PHONE_REGEX);
      if (phoneMatch) {
        phones.push(...phoneMatch);
      }
    }
  }
  
  // Also extract from full text
  const textMatches = text.match(PHONE_REGEX) || [];
  phones.push(...textMatches);
  
  // Clean and dedupe
  return phones
    .map(p => p.replace(/[^\d+\s()-]/g, "").trim())
    .filter(p => {
      const digits = p.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    })
    .filter((p, i, arr) => arr.indexOf(p) === i);
}

/**
 * Format phone number for display
 */
function formatPhone(phone: string): string {
  // Keep original formatting if it looks good
  const cleaned = phone.replace(/[^\d+\s()-]/g, "").trim();
  
  // If it starts with +, keep international format
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  
  const digits = cleaned.replace(/\D/g, "");
  
  // US format: 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // US with country code: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return cleaned version for other formats
  return cleaned;
}

/**
 * Check if a string looks like a valid website URL
 */
function isValidWebsite(candidate: string): boolean {
  // Must not contain spaces
  if (/\s/.test(candidate)) return false;
  
  // Must not look like an email address
  if (/@/.test(candidate)) return false;
  
  // Must not be a LinkedIn URL (those go to LinkedIn field)
  if (/linkedin\.com/i.test(candidate)) return false;
  
  // Clean up for validation
  let cleaned = candidate.toLowerCase().trim();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, "");
  cleaned = cleaned.split("/")[0]; // Just get the domain part
  cleaned = cleaned.split("?")[0]; // Remove query params
  
  // Must have at least one dot
  if (!cleaned.includes(".")) return false;
  
  // Must have a valid TLD
  const parts = cleaned.split(".");
  const tld = parts.slice(-1)[0];
  const tld2 = parts.slice(-2).join(".");
  
  // Check against known TLDs first
  let hasValidTld = VALID_TLDS.includes(tld) || VALID_TLDS.includes(tld2);
  
  // Also accept any 2-6 character alphabetic TLD as potentially valid
  // This catches newer gTLDs we don't have in the list
  if (!hasValidTld && /^[a-z]{2,6}$/.test(tld)) {
    hasValidTld = true;
  }
  
  if (!hasValidTld) return false;
  
  // Domain part (before TLD) must not be just a name pattern (e.g., francisco.guerrero)
  // Valid domains have meaningful names, not just firstName.lastName patterns
  const domainPart = parts.slice(0, -1).join(".");
  
  // Reject if it looks like a person's name (two lowercase name-like parts)
  if (parts.length === 2 && /^[a-z]+$/.test(parts[0]) && parts[0].length <= 15) {
    // Could be a name like "francisco.guerrero" - check if TLD is actually a name-like word
    const potentialLastName = parts[1];
    // Common surnames that are NOT TLDs
    const nameLikePatterns = /^(guerrero|smith|johnson|williams|brown|jones|garcia|miller|davis|rodriguez|martinez|hernandez|lopez|gonzalez|wilson|anderson|thomas|taylor|moore|jackson|martin|lee|perez|thompson|white|harris|sanchez|clark|ramirez|lewis|robinson|walker|young|allen|king|wright|scott|torres|nguyen|hill|flores|green|adams|nelson|baker|hall|rivera|campbell|mitchell|carter|roberts|savage|chen|wang|zhang|liu|singh|kumar|patel|sharma)$/i;
    if (nameLikePatterns.test(potentialLastName)) return false;
  }
  
  return true;
}

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && domain.includes(".")) {
    return domain;
  }
  return null;
}

/**
 * Extract websites from text (excluding LinkedIn)
 */
function extractWebsites(text: string, lines: string[], email?: string): string[] {
  const websites: string[] = [];
  
  // Pattern to find potential URLs
  const URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s]*)?/gi;
  
  // First priority: look for labeled website lines
  for (const line of lines) {
    if (/^(?:w|web|website)\s*[:|\-]/i.test(line)) {
      // Extract the value after the label
      const valueMatch = line.match(/^(?:w|web|website)\s*[:|\-]\s*(.+)/i);
      if (valueMatch && valueMatch[1]) {
        const value = valueMatch[1].trim();
        const urlMatch = value.match(URL_PATTERN);
        if (urlMatch) {
          for (const url of urlMatch) {
            if (isValidWebsite(url)) {
              websites.push(url);
            }
          }
        } else if (isValidWebsite(value)) {
          // The whole value might be a URL without http://
          websites.push(value);
        }
      }
    }
  }
  
  // Second priority: look for explicit URLs (starting with http:// or https:// or www.)
  const explicitUrlPattern = /(?:https?:\/\/|www\.)[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s]*)?/gi;
  const explicitMatches = text.match(explicitUrlPattern) || [];
  for (const url of explicitMatches) {
    if (isValidWebsite(url)) {
      websites.push(url);
    }
  }
  
  // Third priority: look for domain-like patterns with valid TLDs
  const domainPattern = /\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?\b/gi;
  const domainMatches = text.match(domainPattern) || [];
  for (const domain of domainMatches) {
    if (isValidWebsite(domain) && !websites.some(w => w.includes(domain))) {
      websites.push(domain);
    }
  }
  
  // Fallback: if no website found, derive from email domain
  if (websites.length === 0 && email) {
    const emailDomain = extractDomainFromEmail(email);
    if (emailDomain) {
      websites.push(emailDomain);
    }
  }
  
  // Clean up and dedupe
  return websites
    .map(url => {
      let cleaned = url.trim();
      // Remove trailing punctuation
      cleaned = cleaned.replace(/[.,;:!?]+$/, "");
      if (!cleaned.startsWith("http")) {
        return `https://${cleaned.startsWith("www.") ? cleaned : `www.${cleaned}`}`;
      }
      return cleaned;
    })
    .filter((url, i, arr) => arr.indexOf(url) === i);
}

/**
 * Extract LinkedIn URL from text
 */
function extractLinkedIn(text: string): string | undefined {
  const matches = text.match(LINKEDIN_REGEX) || [];
  if (matches.length > 0 && matches[0]) {
    let url = matches[0];
    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }
    return url;
  }
  return undefined;
}

/**
 * Extract name - assume first non-contact, non-company line is the name
 */
function extractName(lines: string[], email?: string): { name?: string; nameIndex: number } {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = line.trim();
    
    // Skip empty or too short/long
    if (cleaned.length < 2 || cleaned.length > 60) continue;
    
    // Skip if it has field labels
    if (hasFieldLabel(cleaned)) continue;
    
    // Skip if it contains email, phone pattern, or URL
    if (/@/.test(cleaned)) continue;
    if (/^\+?\d/.test(cleaned)) continue;
    if (/https?:\/\/|www\./i.test(cleaned)) continue;
    if (/\.com|\.org|\.net|\.io|\.au|\.uk/i.test(cleaned)) continue;
    
    // Skip if it looks like a company
    if (hasCompanySuffix(cleaned)) continue;
    
    // Skip if it looks like a job title
    if (looksLikeTitle(cleaned)) continue;
    
    // Check if it looks like a proper name (2-4 words, capitalized)
    const words = cleaned.split(/\s+/);
    if (words.length >= 1 && words.length <= 4) {
      const allWordsCapitalized = words.every(w => 
        /^[A-Z][a-z''-]*$/.test(w) || // Standard name
        /^[A-Z]\.?$/.test(w) || // Initial
        /^[A-Z][a-z]+-[A-Z][a-z]+$/.test(w) || // Hyphenated
        /^O'[A-Z][a-z]+$/.test(w) || // O'Brien style
        /^Mc[A-Z][a-z]+$/.test(w) || // McName style
        /^Mac[A-Z][a-z]+$/.test(w) // MacName style
      );
      
      if (allWordsCapitalized) {
        return { name: cleaned, nameIndex: i };
      }
    }
  }
  
  // Fallback: try to derive from email
  if (email) {
    const localPart = email.split("@")[0];
    const nameParts = localPart.split(/[._-]/).filter(p => p.length > 1);
    if (nameParts.length >= 2) {
      const derivedName = nameParts
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
      return { name: derivedName, nameIndex: -1 };
    }
  }
  
  return { name: undefined, nameIndex: -1 };
}

/**
 * Extract job title - look for title keywords after name
 */
function extractJobTitle(lines: string[], nameIndex: number, companyName?: string): string | undefined {
  // Look at lines after the name
  const startIndex = nameIndex >= 0 ? nameIndex + 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = line.trim();
    
    // Skip empty or too short/long
    if (cleaned.length < 3 || cleaned.length > 100) continue;
    
    // Skip field labels
    if (hasFieldLabel(cleaned)) continue;
    
    // Skip if contains email/phone/URL
    if (/@/.test(cleaned)) continue;
    if (/^\+?\d/.test(cleaned)) continue;
    if (/https?:\/\/|www\./i.test(cleaned)) continue;
    
    // Skip if it's the company name
    if (companyName && cleaned.toLowerCase() === companyName.toLowerCase()) continue;
    
    // If it has company suffix, it's not a title
    if (hasCompanySuffix(cleaned)) continue;
    
    // Check if it looks like a job title
    if (looksLikeTitle(cleaned)) {
      return cleaned;
    }
  }
  
  return undefined;
}

/**
 * Extract company name - look for company suffixes or Title Case after name/title
 */
function extractCompanyName(lines: string[], nameIndex: number, titleLine?: string): { company?: string; companyIndex: number } {
  const startIndex = nameIndex >= 0 ? nameIndex + 1 : 0;
  
  // First pass: look for lines with company suffixes
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = line.trim();
    
    // Skip the title line
    if (titleLine && cleaned === titleLine) continue;
    
    // Skip field labels
    if (hasFieldLabel(cleaned)) continue;
    
    // Skip email/phone/URL
    if (/@/.test(cleaned)) continue;
    if (/^\+?\d/.test(cleaned)) continue;
    if (/https?:\/\/|www\./i.test(cleaned)) continue;
    
    // Check for company suffix
    if (hasCompanySuffix(cleaned)) {
      return { company: cleaned, companyIndex: i };
    }
  }
  
  // Second pass: look for Title Case lines that could be company names
  for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
    const line = lines[i];
    const cleaned = line.trim();
    
    // Skip the title line
    if (titleLine && cleaned === titleLine) continue;
    
    // Skip field labels
    if (hasFieldLabel(cleaned)) continue;
    
    // Skip email/phone/URL
    if (/@/.test(cleaned)) continue;
    if (/^\+?\d/.test(cleaned)) continue;
    if (/https?:\/\/|www\./i.test(cleaned)) continue;
    
    // Skip if it looks like a job title
    if (looksLikeTitle(cleaned)) continue;
    
    // Check if Title Case and reasonable length
    if (isTitleCase(cleaned) && cleaned.length >= 3 && cleaned.length <= 60) {
      const words = cleaned.split(/\s+/);
      if (words.length <= 6) {
        return { company: cleaned, companyIndex: i };
      }
    }
  }
  
  return { company: undefined, companyIndex: -1 };
}

/**
 * Australian-aware address extraction
 * Handles business cards with multiple addresses (registered + office)
 * Picks office/working address over registered address
 */
function extractBestAUAddress(rawText: string): string | null {
  const lines = rawText
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  interface AddressCandidate {
    full: string;
    score: number;
  }

  const addresses: AddressCandidate[] = [];

  // AU state codes
  const AU_STATES = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/;
  const AU_POSTCODE = /\b\d{4}\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Must have an AU state code and 4-digit postcode
    const hasState = AU_STATES.test(line);
    const hasPostcode = AU_POSTCODE.test(line);
    if (!hasState || !hasPostcode) continue;

    // This line contains "City STATE POSTCODE"
    const placeLine = line;
    
    // Street line is typically the line before
    const streetLine = lines[i - 1] || "";
    
    // Country line is typically the line after (if it says Australia)
    const countryLine =
      lines[i + 1] && /australia/i.test(lines[i + 1]) ? lines[i + 1] : "";

    // Check label 2 lines up to determine address type
    const labelLine = (lines[i - 2] || "").toLowerCase();
    const isOffice = labelLine.includes("office address") || 
                     labelLine.includes("office:") ||
                     labelLine.includes("sydney office") ||
                     labelLine.includes("melbourne office") ||
                     labelLine.includes("brisbane office");
    const isRegistered = labelLine.includes("registered address") || 
                         labelLine.includes("registered:");

    // Skip lines that look like labels (not actual street addresses)
    if (/^(registered|office|sydney|melbourne|brisbane)\s*(address)?:?$/i.test(streetLine)) {
      continue;
    }

    // Build full address, cleaning up spacing
    const full = `${streetLine} ${placeLine} ${countryLine}`
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",")
      .replace(/\s+/g, " ")
      .trim();

    // Score: prefer office (100) over registered (10) over unknown (50)
    const score = isOffice ? 100 : (isRegistered ? 10 : 50);

    addresses.push({ full, score });
  }

  if (!addresses.length) return null;
  
  // Sort by score descending (office first)
  addresses.sort((a, b) => b.score - a.score);
  return addresses[0].full;
}

/**
 * Extract address - lines between company and contact fields
 * Uses AU-aware extraction first, falls back to generic
 */
function extractAddress(lines: string[], companyIndex: number, rawText?: string): string | undefined {
  // Try AU-aware extraction first (works for AU business cards with multiple addresses)
  if (rawText) {
    const auAddress = extractBestAUAddress(rawText);
    if (auAddress) {
      return auAddress;
    }
  }
  
  // Fall back to generic extraction
  if (companyIndex < 0) return undefined;
  
  const addressParts: string[] = [];
  
  for (let i = companyIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = line.trim();
    
    // Stop if we hit a field label (m:, e:, w:, etc.)
    if (hasFieldLabel(cleaned)) break;
    
    // Stop if we hit email/phone/URL
    if (/@/.test(cleaned)) break;
    if (/https?:\/\/|www\./i.test(cleaned)) break;
    
    // Stop if line is mostly digits (phone)
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length / cleaned.replace(/\s/g, "").length > 0.5) break;
    
    // Skip label lines
    if (/^(registered|office|sydney|melbourne)\s*(address)?:?$/i.test(cleaned)) continue;
    
    // This looks like an address part
    if (cleaned.length > 0 && cleaned.length <= 100) {
      addressParts.push(cleaned);
    }
    
    // Limit address to 3 lines
    if (addressParts.length >= 3) break;
  }
  
  if (addressParts.length > 0) {
    return addressParts.join(", ");
  }
  
  return undefined;
}

/**
 * Main parsing function
 */
export function parseContact(rawText: string): ParsedContact {
  const lines = preCleanText(rawText);
  const fullText = lines.join("\n");
  
  // Extract structured data
  const emails = extractEmails(fullText);
  const email = emails[0];
  
  const phones = extractPhones(fullText, lines);
  const websites = extractWebsites(fullText, lines, email);
  const linkedinUrl = extractLinkedIn(fullText);
  
  // Extract name first (usually first line)
  const { name: fullName, nameIndex } = extractName(lines, email);
  
  // Extract company (to help with title detection)
  const { company: companyName, companyIndex } = extractCompanyName(lines, nameIndex);
  
  // Extract job title (after name, before or separate from company)
  const jobTitle = extractJobTitle(lines, nameIndex, companyName);
  
  // Extract address (between company and contact fields, uses AU-aware extraction)
  const address = extractAddress(lines, companyIndex, rawText);
  
  // Format phone
  const phone = phones[0] ? formatPhone(phones[0]) : undefined;
  const website = websites[0];
  
  let contact: ParsedContact = {
    fullName,
    jobTitle,
    companyName,
    email,
    phone,
    website,
    linkedinUrl,
    address,
  };
  
  // Post-process: fix company if it looks like an address
  contact = fixCompanyIfAddress(contact, rawText);
  
  return contact;
}

export function normalizeForDuplicateCheck(value: string | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}
