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
 * Extract address - lines between company and contact fields
 */
function extractAddress(lines: string[], companyIndex: number): string | undefined {
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
  
  // Extract address (between company and contact fields)
  const address = extractAddress(lines, companyIndex);
  
  // Format phone
  const phone = phones[0] ? formatPhone(phones[0]) : undefined;
  const website = websites[0];
  
  return {
    fullName,
    jobTitle,
    companyName,
    email,
    phone,
    website,
    linkedinUrl,
    address,
  };
}

export function normalizeForDuplicateCheck(value: string | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}
