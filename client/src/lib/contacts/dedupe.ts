/**
 * Duplicate Detection Engine
 * Fast, local fuzzy matching for contact deduplication
 */

import { ContactV2 } from './storage';

// Normalization helpers
export function normalizeEmail(email: string | undefined): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

export function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  // Keep leading + if present, remove all other non-digits
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeName(name: string | undefined): string {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizeCompany(company: string | undefined): string {
  if (!company) return '';
  return company
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(pty|ltd|inc|llc|corp|gmbh|co|company|limited)\b\.?/gi, '')
    .trim();
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (0-100)
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (!a || !b) return 0;
  
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  
  return Math.round((1 - distance / maxLen) * 100);
}

// Get email domain
function getEmailDomain(email: string | undefined): string {
  if (!email) return '';
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

// Match reason type
export interface MatchReason {
  field: string;
  description: string;
  confidence: number;
}

// Duplicate group
export interface DuplicateGroup {
  contactIds: string[];
  score: number;
  reasons: MatchReason[];
}

// Calculate match score between two contacts
function calculateMatchScore(a: ContactV2, b: ContactV2): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let maxScore = 0;

  // Email exact match (highest confidence)
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  if (emailA && emailB && emailA === emailB) {
    reasons.push({ field: 'email', description: 'Email exact match', confidence: 100 });
    maxScore = Math.max(maxScore, 100);
  }

  // Phone exact match
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  if (phoneA && phoneB && phoneA === phoneB && phoneA.length >= 8) {
    reasons.push({ field: 'phone', description: 'Phone exact match', confidence: 95 });
    maxScore = Math.max(maxScore, 95);
  }

  // LinkedIn exact match
  if (a.linkedinUrl && b.linkedinUrl) {
    const linkedinA = a.linkedinUrl.toLowerCase().replace(/\/$/, '');
    const linkedinB = b.linkedinUrl.toLowerCase().replace(/\/$/, '');
    if (linkedinA === linkedinB) {
      reasons.push({ field: 'linkedin', description: 'LinkedIn URL match', confidence: 95 });
      maxScore = Math.max(maxScore, 95);
    }
  }

  // Name + Company fuzzy match
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);
  const companyA = normalizeCompany(a.company);
  const companyB = normalizeCompany(b.company);

  if (nameA && nameB && companyA && companyB) {
    const nameSimilarity = stringSimilarity(nameA, nameB);
    const companySimilarity = stringSimilarity(companyA, companyB);

    if (nameSimilarity >= 85 && companySimilarity >= 80) {
      const combinedScore = Math.round((nameSimilarity + companySimilarity) / 2);
      reasons.push({
        field: 'name+company',
        description: `Name+Company similarity ${combinedScore}%`,
        confidence: Math.min(90, combinedScore),
      });
      maxScore = Math.max(maxScore, Math.min(90, combinedScore));
    } else if (nameSimilarity >= 90) {
      // High name similarity alone
      reasons.push({
        field: 'name',
        description: `Name similarity ${nameSimilarity}%`,
        confidence: Math.min(70, nameSimilarity - 20),
      });
      maxScore = Math.max(maxScore, Math.min(70, nameSimilarity - 20));
    }
  }

  // Name fuzzy + email domain matches company
  if (nameA && nameB && stringSimilarity(nameA, nameB) >= 85) {
    const domainA = getEmailDomain(a.email);
    const domainB = getEmailDomain(b.email);
    
    // Check if domain resembles company name
    const domainMatchesCompany = (domain: string, company: string) => {
      if (!domain || !company) return false;
      const domainBase = domain.split('.')[0];
      return stringSimilarity(domainBase, company.replace(/\s/g, '').toLowerCase()) >= 60;
    };

    if (domainA && domainMatchesCompany(domainA, companyB || '')) {
      const score = Math.min(80, stringSimilarity(nameA, nameB));
      reasons.push({
        field: 'name+domain',
        description: 'Name match + email domain matches company',
        confidence: score,
      });
      maxScore = Math.max(maxScore, score);
    }
  }

  return { score: maxScore, reasons };
}

// Find duplicate groups
export function findDuplicateGroups(contacts: ContactV2[], minScore: number = 60): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    if (processed.has(contacts[i].id)) continue;

    const group: DuplicateGroup = {
      contactIds: [contacts[i].id],
      score: 0,
      reasons: [],
    };

    for (let j = i + 1; j < contacts.length; j++) {
      if (processed.has(contacts[j].id)) continue;

      const { score, reasons } = calculateMatchScore(contacts[i], contacts[j]);
      
      if (score >= minScore) {
        group.contactIds.push(contacts[j].id);
        group.score = Math.max(group.score, score);
        group.reasons.push(...reasons);
      }
    }

    if (group.contactIds.length > 1) {
      // Dedupe reasons
      const uniqueReasons = group.reasons.filter((r, idx, arr) => 
        arr.findIndex(x => x.field === r.field) === idx
      );
      group.reasons = uniqueReasons.sort((a, b) => b.confidence - a.confidence);
      
      // Mark all as processed
      group.contactIds.forEach(id => processed.add(id));
      groups.push(group);
    }
  }

  // Sort by score descending
  return groups.sort((a, b) => b.score - a.score);
}

// Suggest top merges
export function suggestMerges(contacts: ContactV2[], limit: number = 10): DuplicateGroup[] {
  const groups = findDuplicateGroups(contacts, 70);
  return groups.slice(0, limit);
}

// Merge field selector - pick the more complete value
export function pickBestValue<T>(a: T | undefined, b: T | undefined): T | undefined {
  if (a === undefined || a === null || a === '') return b;
  if (b === undefined || b === null || b === '') return a;
  
  // For strings, prefer longer value (more complete)
  if (typeof a === 'string' && typeof b === 'string') {
    return a.length >= b.length ? a : b;
  }
  
  return a;
}

// Merge two contacts
export function mergeContacts(primary: ContactV2, secondary: ContactV2): ContactV2 {
  return {
    ...primary,
    // Pick best values for each field
    name: pickBestValue(primary.name, secondary.name) || primary.name,
    company: pickBestValue(primary.company, secondary.company) || '',
    title: pickBestValue(primary.title, secondary.title) || '',
    email: pickBestValue(primary.email, secondary.email) || '',
    phone: pickBestValue(primary.phone, secondary.phone) || '',
    website: pickBestValue(primary.website, secondary.website) || '',
    linkedinUrl: pickBestValue(primary.linkedinUrl, secondary.linkedinUrl) || '',
    address: pickBestValue(primary.address, secondary.address) || '',
    notes: [primary.notes, secondary.notes].filter(Boolean).join('\n\n---\n\n'),
    
    // Merge arrays (dedupe by id)
    tasks: [...primary.tasks, ...secondary.tasks.filter(t => !primary.tasks.find(pt => pt.id === t.id))],
    reminders: [...primary.reminders, ...secondary.reminders.filter(r => !primary.reminders.find(pr => pr.id === r.id))],
    timeline: [...primary.timeline, ...secondary.timeline].sort((a, b) => b.at.localeCompare(a.at)),
    
    // Update metadata
    lastTouchedAt: new Date().toISOString(),
    mergeMeta: {
      mergedFromIds: [...(primary.mergeMeta?.mergedFromIds || []), secondary.id],
      mergedAt: new Date().toISOString(),
    },
  };
}
