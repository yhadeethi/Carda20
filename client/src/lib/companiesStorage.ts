/**
 * Companies Storage Module for Org Intelligence
 * Stores and manages company data with localStorage persistence
 */

const STORAGE_KEY_V1 = "carda_companies_v1";
const STORAGE_KEY_V2 = "carda_companies_v2";

export interface Company {
  id: string;
  dbId?: number;
  name: string;
  domain?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  legacyId?: string;
  _needsUpsert?: boolean;
}

function generateId(): string {
  return crypto.randomUUID();
}

function loadCompaniesV1(): Company[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function getCompanies(): Company[] {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) return parsed;
    }

    const v1 = loadCompaniesV1();
    if (v1.length > 0) {
      saveCompanies(v1);
    }
    return v1;
  } catch (e) {
    console.error("[CompaniesStorage] Failed to load companies:", e);
    return [];
  }
}

export function saveCompanies(companies: Company[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(companies));
  } catch (e) {
    console.error("[CompaniesStorage] Failed to save companies:", e);
  }
}

export function upsertCompany(company: Company): Company[] {
  const companies = getCompanies();
  const existingIndex = companies.findIndex((c) => c.id === company.id);
  
  if (existingIndex >= 0) {
    companies[existingIndex] = { ...company, updatedAt: new Date().toISOString(), _needsUpsert: true };
  } else {
    companies.push({
      ...company,
      id: company.id || generateId(),
      createdAt: company.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _needsUpsert: true,
    });
  }
  
  saveCompanies(companies);
  const saved = companies.find((c) => c.id === (company.id || companies[companies.length - 1].id));
  if (saved) fireCompanyUpsert(saved);
  return companies;
}

function fireCompanyUpsert(company: Company): void {
  import('./api/sync').then(({ upsertCompanyToServer }) => {
    upsertCompanyToServer(company).then((ok) => {
      if (ok) {
        const companies = getCompanies();
        const idx = companies.findIndex((c) => c.id === company.id);
        if (idx !== -1) {
          companies[idx]._needsUpsert = false;
          saveCompanies(companies);
        }
      }
    });
  });
}

export function deleteCompany(companyId: string): Company[] {
  const companies = getCompanies();
  const filtered = companies.filter((c) => c.id !== companyId);
  saveCompanies(filtered);
  return filtered;
}

export function getCompanyById(companyId: string): Company | undefined {
  return getCompanies().find((c) => c.id === companyId);
}

export function findCompanyByName(name: string): Company | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return getCompanies().find((c) => c.name.trim().toLowerCase() === normalized);
}

export function findCompanyByDomain(domain: string): Company | undefined {
  if (!domain) return undefined;
  const normalized = domain.trim().toLowerCase();
  return getCompanies().find((c) => c.domain?.trim().toLowerCase() === normalized);
}

/**
 * Extract domain from email address
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email) return null;
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract domain from website URL
 */
export function extractDomainFromWebsite(website: string): string | null {
  if (!website) return null;
  try {
    // Handle URLs without protocol
    const urlString = website.includes('://') ? website : `https://${website}`;
    const url = new URL(urlString);
    // Remove www. prefix if present
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    // Fallback regex for malformed URLs
    const match = website.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    return match ? match[1].toLowerCase() : null;
  }
}

/**
 * Normalize company name for comparison
 */
export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,.]$/g, '')
    .trim();
}

/**
 * Create a new company with proper defaults
 */
export function createCompany(data: Partial<Company>): Company {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: normalizeCompanyName(data.name || 'Unknown Company'),
    domain: data.domain || null,
    city: data.city || null,
    state: data.state || null,
    country: data.country || null,
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Auto-generate companies from existing contacts
 * Groups contacts by company name or email domain and creates Company records
 * Idempotent - safe to call multiple times
 */
export function autoGenerateCompaniesFromContacts(contacts: Array<{
  company: string;
  email: string;
  website?: string;
  companyId?: string | null;
}>): Company[] {
  const existingCompanies = getCompanies();
  const newCompanies: Company[] = [];
  
  // Group contacts by normalized company name
  const companyGroups = new Map<string, { name: string; domain: string | null }>();
  
  contacts.forEach((contact) => {
    const companyName = contact.company?.trim();
    // Priority: website domain > email domain
    const websiteDomain = extractDomainFromWebsite(contact.website || '');
    const emailDomain = extractDomainFromEmail(contact.email);
    const domain = websiteDomain || emailDomain;
    
    if (companyName) {
      const normalized = normalizeCompanyName(companyName).toLowerCase();
      if (normalized && !companyGroups.has(normalized)) {
        companyGroups.set(normalized, { name: companyName, domain });
      } else if (normalized && domain && !companyGroups.get(normalized)!.domain) {
        // Update with domain if we have one
        companyGroups.get(normalized)!.domain = domain;
      }
    } else if (domain) {
      // Fallback: use domain as company grouping
      if (!companyGroups.has(domain)) {
        // Create company name from domain (e.g., flowpower.com.au -> Flow Power)
        const nameFromDomain = domain
          .replace(/\.(com|com\.au|net|org|io|co)$/i, '')
          .split('.')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
        companyGroups.set(domain, { name: nameFromDomain, domain });
      }
    }
  });
  
  // Create companies for groups that don't already exist
  companyGroups.forEach(({ name, domain }) => {
    const normalizedName = normalizeCompanyName(name).toLowerCase();
    
    // Check if company already exists by name or domain
    const existsByName = existingCompanies.some(
      (c) => normalizeCompanyName(c.name).toLowerCase() === normalizedName
    );
    const existsByDomain = domain && existingCompanies.some(
      (c) => c.domain?.toLowerCase() === domain.toLowerCase()
    );
    
    if (!existsByName && !existsByDomain) {
      const newCompany = createCompany({ name, domain });
      newCompanies.push(newCompany);
    }
  });
  
  // Save all new companies
  if (newCompanies.length > 0) {
    const allCompanies = [...existingCompanies, ...newCompanies];
    saveCompanies(allCompanies);
    return allCompanies;
  }
  
  return existingCompanies;
}

/**
 * Link a contact to a company - returns the companyId to use
 * Priority: existing companyId > matching name > matching domain > null
 */
export function resolveCompanyIdForContact(contact: {
  companyId?: string | null;
  company: string;
  email: string;
}): string | null {
  // Already has companyId
  if (contact.companyId) {
    const company = getCompanyById(contact.companyId);
    if (company) return contact.companyId;
  }
  
  // Try to find by company name
  if (contact.company) {
    const byName = findCompanyByName(contact.company);
    if (byName) return byName.id;
  }
  
  // Try to find by email domain
  const domain = extractDomainFromEmail(contact.email);
  if (domain) {
    const byDomain = findCompanyByDomain(domain);
    if (byDomain) return byDomain.id;
  }
  
  return null;
}

/**
 * Get contact count for a company
 */
export function getContactCountForCompany(companyId: string, contacts: Array<{ companyId?: string | null; company: string; email: string }>): number {
  const company = getCompanyById(companyId);
  if (!company) return 0;
  
  return contacts.filter((c) => {
    // Linked by companyId
    if (c.companyId === companyId) return true;
    // Match by company name
    if (c.company && normalizeCompanyName(c.company).toLowerCase() === normalizeCompanyName(company.name).toLowerCase()) return true;
    // Match by domain
    if (company.domain) {
      const contactDomain = extractDomainFromEmail(c.email);
      if (contactDomain === company.domain.toLowerCase()) return true;
    }
    return false;
  }).length;
}

/**
 * Get all contacts for a company (by ID, name, or domain)
 */
export function getContactsForCompany(companyId: string, contacts: Array<{ id: string; companyId?: string | null; company: string; email: string }>): string[] {
  const company = getCompanyById(companyId);
  if (!company) return [];
  
  return contacts.filter((c) => {
    if (c.companyId === companyId) return true;
    if (c.company && normalizeCompanyName(c.company).toLowerCase() === normalizeCompanyName(company.name).toLowerCase()) return true;
    if (company.domain) {
      const contactDomain = extractDomainFromEmail(c.email);
      if (contactDomain === company.domain.toLowerCase()) return true;
    }
    return false;
  }).map((c) => c.id);
}
