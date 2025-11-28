export interface ParsedContact {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingContactId?: number;
}
