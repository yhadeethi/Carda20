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
 * - "Ground Floor, 109 Burwood road Hawthorn Melbourne Vic 3122"
 */
export function splitAuAddress(address: string | undefined): SplitAddress {
  if (!address) {
    return { street: "", city: "", state: "", postcode: "", country: "" };
  }

  const trimmed = address.replace(/\s+/g, " ").trim();

  // Try to match AU address formats with comma separating street from city
  // Pattern: "Street Address, City STATE POSTCODE [Country]"
  // Case-insensitive and tolerant of missing country
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
      country: countryRaw ? "Australia" : "Australia", // Always default to Australia
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
      country: countryRaw ? "Australia" : "Australia", // Always default to Australia
    };
  }

  // Fallback: treat entire string as street, default country to Australia if has AU indicators
  const hasAuState = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i.test(trimmed);
  const hasPostcode = /\b\d{4}\b/.test(trimmed);
  
  return {
    street: trimmed,
    city: "",
    state: "",
    postcode: "",
    country: (hasAuState || hasPostcode) ? "Australia" : "",
  };
}

/**
 * Derive a clean company name from a domain/website string
 * e.g., "flowpower.com.au" -> "Flow Power"
 * e.g., "w. flowpower.com.au" -> "Flow Power"
 */
export function deriveCompanyFromDomain(rawDomain: string | undefined): string {
  if (!rawDomain) return "";

  let domain = rawDomain.trim();
  
  // Strip protocol and leading labels
  domain = domain.replace(/^https?:\/\//i, "");
  domain = domain.replace(/^www\./i, "");
  domain = domain.replace(/^w\.\s*/i, "");

  // If the line has extra text, extract the first thing that looks like a domain
  const domainMatch = domain.match(/[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (domainMatch) {
    domain = domainMatch[0];
  }

  // Get the main part (before first dot)
  const parts = domain.split(".");
  const main = parts[0]; // e.g., "flowpower"
  if (!main) return "";

  // Convert to title case, splitting on hyphens/underscores
  // "flowpower" -> "Flowpower" (simple case)
  // "flow-power" -> "Flow Power"
  // For single words, try to detect camelCase boundaries or common patterns
  
  // Check if it's a compound word we can split intelligently
  // Common patterns: flowpower -> flow power, energyaustralia -> energy australia
  let words = main
    .split(/[-_]/)
    .filter(Boolean);
  
  // If it's a single word, try to split it intelligently
  if (words.length === 1 && words[0]) {
    const word = words[0].toLowerCase();
    // Try to find natural word boundaries in compound domain names
    // This is heuristic - split before common business words
    const splitPatterns = [
      /^(.+?)(power)$/i,
      /^(.+?)(energy)$/i,
      /^(.+?)(australia)$/i,
      /^(.+?)(global)$/i,
      /^(.+?)(group)$/i,
      /^(.+?)(digital)$/i,
      /^(.+?)(solutions)$/i,
      /^(.+?)(services)$/i,
      /^(.+?)(tech)$/i,
      /^(.+?)(labs)$/i,
      /^(.+?)(media)$/i,
      /^(.+?)(works)$/i,
    ];
    
    for (const pattern of splitPatterns) {
      const match = word.match(pattern);
      if (match && match[1] && match[1].length >= 2) {
        words = [match[1], match[2]];
        break;
      }
    }
  }

  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Check if a string looks like a URL or website reference
 */
function looksLikeUrl(text: string): boolean {
  const t = text.toLowerCase().trim();
  // Starts with protocol, www, or w. label
  if (/^(https?:\/\/|www\.|w\.\s*)/.test(t)) return true;
  // Looks like a domain (word.tld pattern)
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return true;
  return false;
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
  const hasAddressWord = /(street|st\.|road|rd\.|ave|avenue|floor|lvl|level|drive|dr\.|boulevard|blvd|lane|ln\.|place|pl\.|way|court|ct\.|terrace|tce|crescent|cres|highway|hwy|parade|pde|bouvets|rue|via|plaza|cs\s*\d+)/i.test(t);
  
  return hasState || hasPostcode || hasAddressWord;
}

/**
 * Check if company name is the same as the contact's name (invalid)
 */
function isSameAsName(candidate: string | undefined, fullName: string | undefined): boolean {
  if (!candidate || !fullName) return false;
  
  // Normalize: lowercase, remove accents, remove non-alphanumeric
  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]+/g, "");     // strip spaces/punct
  
  return normalize(candidate) === normalize(fullName);
}

/**
 * Derive website from email domain or explicit URL in text
 * NEVER derives from local part of email (before @)
 */
function deriveWebsite(email: string | undefined, rawText: string | undefined): string {
  const lines = rawText
    ? rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
    : [];

  // 1) Prefer explicit website line in the signature
  for (const line of lines) {
    // Look for explicit URLs
    const urlMatch = line.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
    if (urlMatch) {
      let url = urlMatch[0];
      // Skip LinkedIn
      if (/linkedin\.com/i.test(url)) continue;
      // Add protocol if missing
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }
      return url;
    }
  }

  // 2) Fallback: build from email domain (NOT local part)
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return "";
  const domain = parts[1].toLowerCase();
  
  // Don't create websites for generic email providers
  if (GENERIC_EMAIL_DOMAINS.includes(domain)) return "";

  return "https://www." + domain;
}

/**
 * Generate a Google search URL for finding someone's LinkedIn profile
 * @param fullName The person's full name
 * @param companyName The person's company name
 * @returns A Google search URL for "fullName companyName LinkedIn"
 */
function generateLinkedInSearchUrl(fullName?: string, companyName?: string): string {
  const parts: string[] = [];
  if (fullName) parts.push(fullName);
  if (companyName) parts.push(companyName);
  parts.push("LinkedIn");
  
  const query = parts.join(" ");
  const encodedQuery = encodeURIComponent(query);
  
  return `https://www.google.com/search?q=${encodedQuery}`;
}

/**
 * Fix company name when it appears to be an address, URL, same as name, or is missing
 * Uses email domain to find the real company name in the raw text
 * Priority: 1) Line with domain match + company suffix, 2) Company suffix line, 3) Derived from domain, 4) First safe line
 */
export function fixCompanyIfAddress(contact: ParsedContact, rawText: string): ParsedContact {
  const currentCompany = contact.companyName || "";
  const fullName = contact.fullName || "";
  
  // Check if company is invalid for various reasons
  const companyLooksLikeAddress = looksLikeAddress(currentCompany);
  const companyIsSameAsName = isSameAsName(currentCompany, fullName);
  const companyLooksLikeUrl = looksLikeUrl(currentCompany);
  const companyHasSuffix = hasCompanySuffix(currentCompany);
  
  // Company is valid if it has a company suffix (strongest signal)
  // Otherwise, we should try to find a better match
  const hasValidCompany =
    currentCompany &&
    companyHasSuffix && // Must have company suffix to be considered valid
    !companyLooksLikeAddress &&
    !companyIsSameAsName &&
    !companyLooksLikeUrl;
    
  if (hasValidCompany) {
    return contact;
  }

  const lines = rawText
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  // Get base domain from email for matching (e.g., "flowpower" from flowpower.com.au)
  const email = contact.email || "";
  const emailDomainMatch = email.match(/@([A-Za-z0-9.-]+)/);
  const baseDomain = emailDomainMatch ? emailDomainMatch[1].split('.')[0].toLowerCase() : null;

  // Find candidate domain from website or rawText
  let candidateDomain: string | undefined = contact.website;
  
  // If no website, look for w. or www. lines in rawText
  if (!candidateDomain) {
    for (const line of lines) {
      if (/^w\.\s*.+\.[a-z]{2,}/i.test(line) || /^www\..+\.[a-z]{2,}/i.test(line)) {
        candidateDomain = line;
        break;
      }
    }
  }
  
  // If still no candidate domain, use email domain
  if (!candidateDomain && emailDomainMatch) {
    candidateDomain = emailDomainMatch[1];
  }

  // Normalize job title for comparison
  const jobTitleLower = contact.jobTitle?.trim().toLowerCase() || "";

  // Collect candidate lines
  interface Candidate {
    line: string;
    hasDomainMatch: boolean;
    hasSuffix: boolean;
  }
  
  const candidates: Candidate[] = [];

  // Normalize full name for comparison
  const fullNameLower = fullName.trim().toLowerCase();
  const fullNameNormalized = fullNameLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");

  for (const line of lines) {
    const lower = line.toLowerCase();
    const normalizedLine = lower.replace(/\s+/g, ""); // Remove all spaces for domain matching
    
    // Skip if this line IS the detected (wrong) company
    if (currentCompany && line === currentCompany) continue;
    
    // Skip lines that match the contact's name
    if (fullNameLower && lower === fullNameLower) continue;
    if (fullNameNormalized) {
      const lineNormalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
      if (lineNormalized === fullNameNormalized) continue;
    }
    
    // Skip email lines
    if (lower.includes("@")) continue;
    
    // Skip URL/website lines (these shouldn't be company names)
    if (looksLikeUrl(line)) continue;
    if (/^w\.\s*/i.test(line)) continue; // Skip "w. flowpower.com.au" style lines
    if (/^e\.\s*/i.test(line)) continue; // Skip "e. email@..." style lines
    
    // Skip phone lines (various formats: +61..., m. 0432..., m: 0432..., Mobile..., Mob:..., etc.)
    if (/^\+?\d[\d\s()-]{6,}/.test(line)) continue;
    if (/^m\s*[.:|\-]/i.test(line)) continue; // Skip "m. 0432...", "m: +61...", etc.
    if (/^mob\s*[.:|\-]/i.test(line)) continue; // Skip "Mob: +33...", etc.
    if (/^mobile\s*[.:|\-\(]/i.test(line)) continue; // Skip "Mobile (Australia) +61...", etc.
    
    // Skip lines that look like addresses
    if (looksLikeAddress(line)) continue;
    
    // Skip lines that ARE the job title (exact match)
    if (jobTitleLower && lower === jobTitleLower) continue;
    
    // Skip lines that CONTAIN the job title (fuzzy match)
    if (jobTitleLower && jobTitleLower.length > 10 && lower.includes(jobTitleLower)) continue;
    
    // Skip lines that look like job titles (but not if they have company suffix)
    if (looksLikeTitle(line) && !hasCompanySuffix(line)) continue;
    
    // Skip lines that look like names (short, title case, 2-4 words) unless they have company suffix
    if (isTitleCase(line) && line.split(/\s+/).length <= 3 && line.length < 30) {
      if (!hasCompanySuffix(line)) continue;
    }
    
    // Check if line matches domain (space-insensitive)
    // "flow power pty ltd" → "flowpowerptyltd" includes "flowpower" ✓
    const hasDomainMatch = baseDomain ? normalizedLine.includes(baseDomain) : false;
    
    // Check if line has company suffix
    const hasSuffix = hasCompanySuffix(line);
    
    candidates.push({ line, hasDomainMatch, hasSuffix });
  }

  // Priority 1: Line with domain match AND company suffix (strongest signal)
  const domainAndSuffixMatch = candidates.find(c => c.hasDomainMatch && c.hasSuffix);
  if (domainAndSuffixMatch) {
    contact.companyName = domainAndSuffixMatch.line;
    return contact;
  }

  // Priority 2: Company suffix line (strong signal - explicit company name)
  const suffixMatch = candidates.find(c => c.hasSuffix);
  if (suffixMatch) {
    contact.companyName = suffixMatch.line;
    return contact;
  }
  
  // Priority 3: Derive company name from domain
  // This is preferred over generic candidate lines to avoid department names
  const derivedCompany = deriveCompanyFromDomain(candidateDomain);
  if (derivedCompany) {
    contact.companyName = derivedCompany;
    return contact;
  }
  
  // Priority 4: Line with domain match only (but no suffix)
  const domainOnlyMatch = candidates.find(c => c.hasDomainMatch);
  if (domainOnlyMatch) {
    contact.companyName = domainOnlyMatch.line;
    return contact;
  }
  
  // Priority 5: First safe line (last resort fallback - rarely used)
  // Skip this if we have domain derivation available
  if (candidates.length > 0 && !baseDomain) {
    contact.companyName = candidates[0].line;
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

// Email salutations to skip at the start (not part of the contact)
const SALUTATION_PATTERNS = [
  /^regards$/i,
  /^kind regards$/i,
  /^best regards$/i,
  /^warm regards$/i,
  /^many thanks$/i,
  /^thanks$/i,
  /^thank you$/i,
  /^cheers$/i,
  /^best$/i,
  /^sincerely$/i,
  /^yours sincerely$/i,
  /^yours faithfully$/i,
  /^yours truly$/i,
  /^with thanks$/i,
  /^with best regards$/i,
  /^all the best$/i,
  /^warmly$/i,
  /^cordially$/i,
  /^respectfully$/i,
  /^ciao$/i,
  /^take care$/i,
  /^speak soon$/i,
  /^looking forward$/i,
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

// Generic email domains - don't derive websites or companies from these
const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "mail.com",
  "protonmail.com",
  "zoho.com",
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
 * Check if a line is a salutation
 */
function isSalutation(line: string): boolean {
  const trimmed = line.trim();
  return SALUTATION_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Pre-clean raw text: split lines, trim, remove empty, skip salutations, stop at disclaimers
 */
function preCleanText(text: string): string[] {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  // Find where disclaimer starts and cut off there
  const cleanedLines: string[] = [];
  let passedSalutation = false;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Stop at disclaimer
    const isDisclaimer = DISCLAIMER_TRIGGERS.some(trigger => lowerLine.includes(trigger));
    if (isDisclaimer) break;
    
    // Skip salutations at the start
    if (!passedSalutation && isSalutation(line)) {
      continue; // Skip this line
    }
    
    // Once we have a non-salutation line, we've passed the salutation section
    passedSalutation = true;
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
  
  // For unknown TLDs, only accept if they're 3+ characters (2-char TLDs must be in list)
  // This prevents "peter.yu" from being treated as a valid domain
  if (!hasValidTld && /^[a-z]{3,6}$/.test(tld)) {
    hasValidTld = true;
  }
  
  if (!hasValidTld) return false;
  
  // Reject if it looks like a person's name (firstName.lastName pattern)
  // e.g., "peter.yu", "john.smith", "francisco.guerrero"
  if (parts.length === 2) {
    const firstName = parts[0].toLowerCase();
    const lastName = parts[1].toLowerCase();
    
    // If first part looks like a first name (all lowercase, 2-15 chars) and 
    // the second part is short (2-10 chars), it's likely a name, not a domain
    if (/^[a-z]{2,15}$/.test(firstName) && /^[a-z]{2,10}$/.test(lastName)) {
      // Common first names
      const commonFirstNames = /^(peter|john|james|david|michael|robert|william|richard|joseph|thomas|charles|daniel|matthew|mark|paul|steven|andrew|kenneth|joshua|kevin|brian|edward|ronald|timothy|jason|jeffrey|ryan|jacob|gary|nicholas|eric|jonathan|stephen|larry|justin|scott|brandon|benjamin|samuel|gregory|alexander|patrick|frank|raymond|jack|dennis|jerry|tyler|aaron|jose|adam|nathan|henry|douglas|zachary|joe|kyle|noah|ethan|jeremy|walter|christian|keith|roger|terry|austin|sean|gerald|carl|dylan|harold|jordan|jesse|bryan|lawrence|arthur|gabriel|bruce|logan|billy|albert|willie|eugene|russell|louis|philip|vincent|bobby|johnny|bradley|roy|eugene|clarence|randy|barry|travis|phillip|howard|shawn|micheal|derrick|andre|marcus|oscar|alex|angel|diego|ivan|edgar|sergio|fernando|eduardo|carlos|jorge|hector|rafael|victor|miguel|mario|antonio|francisco|juan|manuel|jose|ricardo|luis|pedro|javier|enrique|andres|roberto|raul|arturo|jaime|felipe|alfonso|gerardo|cesar|marco|gustavo|santiago|nicolas|sebastian|mateo|diego)$/i;
      // Common last names / short surnames
      const commonLastNames = /^(yu|li|wu|xu|hu|ma|zhang|wang|chen|liu|yang|zhao|huang|zhou|sun|he|lin|guo|luo|wei|lee|kim|park|choi|jung|kang|cho|yoon|jang|song|shin|han|oh|seo|yun|kwon|moon|jeon|bae|baek|ko|nam|smith|johnson|williams|brown|jones|garcia|miller|davis|rodriguez|martinez|hernandez|lopez|gonzalez|wilson|anderson|thomas|taylor|moore|jackson|martin|lee|perez|thompson|white|harris|sanchez|clark|ramirez|lewis|robinson|walker|young|allen|king|wright|scott|torres|nguyen|hill|flores|green|adams|nelson|baker|hall|rivera|campbell|mitchell|carter|roberts|chen|wang|zhang|liu|singh|kumar|patel|sharma|savage)$/i;
      
      if (commonFirstNames.test(firstName) || commonLastNames.test(lastName)) {
        return false;
      }
      
      // Also reject any firstName.lastName where lastName is 2-3 chars (very likely a name)
      if (lastName.length <= 3) {
        return false;
      }
    }
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
    
    // Check if it looks like a proper name (1-4 words, capitalized)
    const words = cleaned.split(/\s+/);
    if (words.length >= 1 && words.length <= 4) {
      const allWordsCapitalized = words.every(w => 
        /^[A-Z][a-z''-]*$/.test(w) || // Standard name
        /^[A-Z]\.?$/.test(w) || // Initial
        /^[A-Z][a-z]+-[A-Z][a-z]+$/.test(w) || // Hyphenated
        /^O'[A-Z][a-z]+$/.test(w) || // O'Brien style
        /^Mc[A-Z][a-z]+$/.test(w) || // McName style
        /^Mac[A-Z][a-z]+$/.test(w) || // MacName style
        /^[A-Z]+$/.test(w) || // ALL CAPS surname (LADOUX, SMITH)
        /^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ''-]*$/.test(w) // Accented names (Clément, José, François)
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

  // AU state codes (case-insensitive to catch "Vic", "vic", etc.)
  const AU_STATES = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i;
  const AU_POSTCODE = /\b\d{4}\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Must have an AU state code and 4-digit postcode
    const hasState = AU_STATES.test(line);
    const hasPostcode = AU_POSTCODE.test(line);
    if (!hasState || !hasPostcode) continue;

    // This line contains "City STATE POSTCODE"
    const placeLine = line;
    
    // Street line is typically the line before - always include if present and looks like an address
    let streetLine = "";
    if (i > 0) {
      const prevLine = lines[i - 1];
      // Include if it looks like a street address (has numbers, floor, level, etc.)
      // but skip if it's a field label, phone, email, URL, or company name with suffix
      const isFieldLabel = hasFieldLabel(prevLine);
      const isPhone = /^\+?\d[\d\s()-]{6,}/.test(prevLine) || /^m\s*[.:|\-]/i.test(prevLine);
      const isEmail = /@/.test(prevLine);
      const isUrl = /https?:\/\/|www\.|^w\.\s/i.test(prevLine);
      const isCompany = hasCompanySuffix(prevLine);
      const isLabel = /^(registered|office|sydney|melbourne|brisbane)\s*(address)?:?$/i.test(prevLine);
      
      if (!isFieldLabel && !isPhone && !isEmail && !isUrl && !isCompany && !isLabel) {
        streetLine = prevLine;
      }
    }
    
    // Country line is typically the line after (if it says Australia)
    let countryPart = "";
    if (lines[i + 1] && /^australia$/i.test(lines[i + 1].trim())) {
      countryPart = "Australia";
    }
    
    // If no explicit country line, check if the current line has Australia at the end
    if (!countryPart && /australia$/i.test(placeLine.trim())) {
      countryPart = ""; // Already in placeLine
    } else if (!countryPart) {
      // Default to Australia for AU addresses
      countryPart = "Australia";
    }

    // Check label 2 lines up to determine address type
    const labelLine = (lines[i - 2] || "").toLowerCase();
    const isOffice = labelLine.includes("office address") || 
                     labelLine.includes("office:") ||
                     labelLine.includes("sydney office") ||
                     labelLine.includes("melbourne office") ||
                     labelLine.includes("brisbane office");
    const isRegistered = labelLine.includes("registered address") || 
                         labelLine.includes("registered:");

    // Build full address parts
    const parts: string[] = [];
    if (streetLine) parts.push(streetLine);
    parts.push(placeLine);
    if (countryPart && !/australia/i.test(placeLine)) {
      parts.push(countryPart);
    }
    
    // Join with comma for street/place separation
    let full: string;
    if (streetLine && parts.length >= 2) {
      // Format as "Street, City STATE POSTCODE Country"
      full = `${streetLine}, ${parts.slice(1).join(" ")}`;
    } else {
      full = parts.join(" ");
    }
    
    // Clean up spacing
    full = full
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
 * Extract international/generic address from raw text
 * Used as fallback when AU-specific address extraction returns null
 */
function extractGenericAddress(rawText: string): string | null {
  const lines = rawText
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  // Address keywords covering multiple countries
  const addressKeywords = /(street|st\.|road|rd\.|boulevard|blvd|bouvets|avenue|ave|rue|place|via|plaza|cs\s*\d+|floor|level|suite|unit|building|bldg)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip obvious non-address lines
    if (/^(mob|mobile|tel|telephone|phone|t\.|m\.)\s*[:|\-\(]/i.test(lower)) continue;
    if (lower.includes("@")) continue;
    if (lower.startsWith("http") || lower.includes("www.")) continue;
    
    // Skip company names with suffixes
    if (hasCompanySuffix(line)) continue;
    
    // Skip lines that look like job titles
    if (looksLikeTitle(line)) continue;

    const hasDigit = /\d/.test(line);
    const hasKeyword = addressKeywords.test(line);

    if (hasDigit && hasKeyword) {
      const streetLine = line;
      const nextLine = lines[i + 1] || "";
      const nextLower = nextLine.toLowerCase();

      // Skip next line if it's a phone/email/url
      const nextIsContact = 
        /^(mob|mobile|tel|telephone|phone|t\.|m\.)\s*[:|\-\(]/i.test(nextLower) ||
        nextLower.includes("@") ||
        nextLower.startsWith("http") ||
        nextLower.includes("www.");

      // Include next line if it looks like postcode + city (e.g., "92741 NANTERRE CEDEX")
      let cityLine = "";
      if (!nextIsContact) {
        // Has 4-5 digit postcode, or CEDEX (French), or uppercase city name
        if (/\d{4,5}/.test(nextLine) || /cedex/i.test(nextLine)) {
          cityLine = nextLine;
        }
      }

      const addressParts = [streetLine, cityLine].filter(Boolean);
      return addressParts.join(", ");
    }
  }

  return null;
}

/**
 * Extract address - lines between company and contact fields
 * Uses AU-aware extraction first, falls back to generic international
 */
function extractAddress(lines: string[], companyIndex: number, rawText?: string): string | undefined {
  if (!rawText) return undefined;
  
  // Try AU-aware extraction first (works for AU business cards with multiple addresses)
  const auAddress = extractBestAUAddress(rawText);
  if (auAddress) {
    return auAddress;
  }
  
  // Try generic international address extraction
  const genericAddress = extractGenericAddress(rawText);
  if (genericAddress) {
    return genericAddress;
  }
  
  // Return undefined if no valid address found (no fake fallbacks)
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
  let website = websites[0];
  
  // If no website found, derive from email domain (never from local part)
  if (!website && email) {
    const derivedWebsite = deriveWebsite(email, rawText);
    if (derivedWebsite) {
      website = derivedWebsite;
    }
  }
  
  // Generate LinkedIn search URL if no direct LinkedIn URL found
  let linkedinSearchUrl: string | undefined;
  if (!linkedinUrl && (fullName || companyName)) {
    linkedinSearchUrl = generateLinkedInSearchUrl(fullName, companyName);
  }

  let contact: ParsedContact = {
    fullName,
    jobTitle,
    companyName,
    email,
    phone,
    website,
    linkedinUrl,
    linkedinSearchUrl,
    address,
  };
  
  // Post-process: fix company if it looks like an address or same as name
  contact = fixCompanyIfAddress(contact, rawText);
  
  return contact;
}

export function normalizeForDuplicateCheck(value: string | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}
