import { ParsedContact } from "./types";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;

const WEBSITE_REGEX = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi;

const COMMON_TITLES = [
  "ceo", "cto", "cfo", "coo", "cmo", "cio", "cpo",
  "president", "vice president", "vp",
  "director", "manager", "lead", "head",
  "engineer", "developer", "designer", "architect",
  "analyst", "consultant", "specialist", "coordinator",
  "executive", "officer", "partner", "founder", "co-founder",
  "sales", "marketing", "hr", "finance", "operations",
  "senior", "junior", "principal", "associate", "assistant",
];

const COMPANY_SUFFIXES = [
  "inc", "inc.", "incorporated",
  "llc", "l.l.c.",
  "ltd", "ltd.", "limited",
  "corp", "corp.", "corporation",
  "co", "co.", "company",
  "gmbh", "ag", "sa", "nv", "bv",
  "plc", "pty", "pte",
  "group", "holdings", "partners",
];

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.map(e => e.toLowerCase())));
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return matches
    .map(p => p.replace(/[^\d+]/g, ""))
    .filter(p => p.length >= 7 && p.length <= 15)
    .filter((p, i, arr) => arr.indexOf(p) === i);
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  
  if (digits.startsWith("+")) {
    if (digits.length === 12 && digits.startsWith("+1")) {
      return `+1 (${digits.slice(2, 5)}) ${digits.slice(5, 8)}-${digits.slice(8)}`;
    }
    return digits;
  }
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return digits;
}

function extractWebsites(text: string): string[] {
  const matches = text.match(WEBSITE_REGEX) || [];
  return matches
    .filter(url => !url.includes("linkedin.com"))
    .filter(url => !url.match(EMAIL_REGEX))
    .map(url => {
      if (!url.startsWith("http")) {
        return `https://${url}`;
      }
      return url;
    })
    .filter((url, i, arr) => arr.indexOf(url) === i);
}

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

function extractName(lines: string[], email?: string): string | undefined {
  const skipPatterns = [
    /^(?:tel|phone|mobile|fax|email|www|http|linkedin)/i,
    /@/,
    /^\+?\d/,
    /\.com|\.org|\.net|\.io/i,
  ];
  
  for (const line of lines) {
    const cleaned = cleanText(line);
    
    if (cleaned.length < 2 || cleaned.length > 50) continue;
    
    if (skipPatterns.some(p => p.test(cleaned))) continue;
    
    const lowerLine = cleaned.toLowerCase();
    const hasTitle = COMMON_TITLES.some(t => lowerLine.includes(t));
    const hasCompanySuffix = COMPANY_SUFFIXES.some(s => lowerLine.includes(s));
    
    if (hasTitle || hasCompanySuffix) continue;
    
    const words = cleaned.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const allWordsLookLikeNames = words.every(w => 
        /^[A-Z][a-z]+$/.test(w) || 
        /^[A-Z]\.?$/.test(w) ||
        /^[A-Z][a-z]*-[A-Z][a-z]+$/.test(w)
      );
      
      if (allWordsLookLikeNames) {
        return cleaned;
      }
    }
  }
  
  if (email) {
    const localPart = email.split("@")[0];
    const nameParts = localPart.split(/[._-]/).filter(p => p.length > 1);
    if (nameParts.length >= 2) {
      return nameParts
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
    }
  }
  
  return undefined;
}

function extractJobTitle(lines: string[], nameFound?: string): string | undefined {
  for (const line of lines) {
    const cleaned = cleanText(line);
    const lowerLine = cleaned.toLowerCase();
    
    if (nameFound && cleaned === nameFound) continue;
    
    if (cleaned.length < 3 || cleaned.length > 80) continue;
    
    if (/@|www\.|\.com|^\+?\d/.test(cleaned)) continue;
    
    const hasTitle = COMMON_TITLES.some(t => lowerLine.includes(t));
    const hasCompanySuffix = COMPANY_SUFFIXES.some(s => lowerLine.includes(s));
    
    if (hasTitle && !hasCompanySuffix) {
      return cleaned;
    }
  }
  
  return undefined;
}

function extractCompanyName(lines: string[], nameFound?: string, titleFound?: string): string | undefined {
  for (const line of lines) {
    const cleaned = cleanText(line);
    const lowerLine = cleaned.toLowerCase();
    
    if (nameFound && cleaned === nameFound) continue;
    if (titleFound && cleaned === titleFound) continue;
    
    if (cleaned.length < 2 || cleaned.length > 80) continue;
    
    if (/@|^\+?\d/.test(cleaned)) continue;
    
    const hasCompanySuffix = COMPANY_SUFFIXES.some(s => lowerLine.includes(s));
    
    if (hasCompanySuffix) {
      return cleaned;
    }
  }
  
  for (const line of lines) {
    const cleaned = cleanText(line);
    
    if (nameFound && cleaned === nameFound) continue;
    if (titleFound && cleaned === titleFound) continue;
    
    if (cleaned.length < 2 || cleaned.length > 60) continue;
    
    if (/@|www\.|\.com|^\+?\d/.test(cleaned)) continue;
    
    const words = cleaned.split(/\s+/);
    if (words.length <= 4) {
      const hasCapitals = words.some(w => /^[A-Z]/.test(w));
      if (hasCapitals) {
        return cleaned;
      }
    }
  }
  
  return undefined;
}

export function parseContact(rawText: string): ParsedContact {
  const lines = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  const emails = extractEmails(rawText);
  const phones = extractPhones(rawText);
  const websites = extractWebsites(rawText);
  const linkedinUrl = extractLinkedIn(rawText);
  
  const email = emails[0];
  const fullName = extractName(lines, email);
  const jobTitle = extractJobTitle(lines, fullName);
  const companyName = extractCompanyName(lines, fullName, jobTitle);
  
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
  };
}

export function normalizeForDuplicateCheck(value: string | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}
