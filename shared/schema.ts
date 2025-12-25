import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, json, index, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - stores user accounts and profile data
// Uses authId for Replit Auth (OpenID sub claim) while keeping integer PK for foreign keys
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  authId: varchar("auth_id").unique(), // Replit Auth sub claim
  email: text("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  fullName: text("full_name"),
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  country: text("country"),
  city: text("city"),
  industry: text("industry"),
  focusTopics: text("focus_topics"),
  publicSlug: text("public_slug").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table - stores company information for intel caching
export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  domain: text("domain").unique(),
  name: text("name"),
  industry: text("industry"),
  sizeBand: text("size_band"),
  hqCountry: text("hq_country"),
  hqCity: text("hq_city"),
  lastEnrichedAt: timestamp("last_enriched_at"),
});

// Contacts table - stores scanned/extracted contacts
export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  fullName: text("full_name"),
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  rawText: text("raw_text"),
  companyDomain: text("company_domain"),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Company Intel table - stores cached AI-generated intel
export const companyIntel = pgTable("company_intel", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  intelJson: json("intel_json").$type<CompanyIntelData>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Apollo cache table - stores enrichment data from Apollo.io (30-day cache)
export const apolloCache = pgTable("apollo_cache", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  domain: text("domain").notNull().unique(),
  apolloData: jsonb("apollo_data").$type<ApolloEnrichmentData>(),
  cachedAt: timestamp("cached_at").defaultNow(),
});

// Apollo enrichment data structure
export interface ApolloEnrichmentData {
  name?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  employeeCountRange?: string | null;
  foundedYear?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  ceoName?: string | null;
  annualRevenue?: number | null;
  annualRevenueFormatted?: string | null;
  totalFunding?: number | null;
  totalFundingFormatted?: string | null;
  latestFundingRoundType?: string | null;
  latestFundingAmount?: number | null;
  technologies?: string[] | null;
}

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
  intel: many(companyIntel),
}));

export const companyIntelRelations = relations(companyIntel, ({ one }) => ({
  company: one(companies, {
    fields: [companyIntel.companyId],
    references: [companies.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
});

export const insertCompanyIntelSchema = createInsertSchema(companyIntel).omit({
  id: true,
  createdAt: true,
});

// Upsert user type for Replit Auth
export type UpsertUser = {
  authId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
};

// Profile update schema
export const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  focusTopics: z.string().optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompanyIntel = z.infer<typeof insertCompanyIntelSchema>;
export type CompanyIntel = typeof companyIntel.$inferSelect;

// Key Development item for historical company events
export interface KeyDevelopment {
  headline: string;
  approxDate: string;
  summary: string;
  note?: string;
}

// Funding round information
export interface FundingRound {
  type: string; // "Seed", "Series A", "Series B", etc.
  amount?: string; // "$10M", "$50M", etc.
  date?: string; // "March 2024", "2023", etc.
  leadInvestors?: string[]; // ["Sequoia", "a16z"]
}

// Funding data structure
export interface FundingData {
  totalRaised?: string; // "$150M total"
  latestRound?: FundingRound;
  fundingStage?: string; // "Series B", "Pre-IPO", "Bootstrapped", etc.
  investors?: string[]; // Notable investors
  ipoStatus?: string; // "Private", "Public (NYSE: XYZ)", etc.
}

// Technology stack item
export interface TechStackItem {
  category: string; // "Frontend", "Backend", "Infrastructure", "Analytics", etc.
  technologies: string[]; // ["React", "Next.js", "TypeScript"]
}

// Tech stack data structure
export interface TechStackData {
  categories: TechStackItem[];
  highlights?: string[]; // Key takeaways about their tech choices
}

// Competitor information
export interface CompetitorInfo {
  name: string;
  description?: string; // Brief description of what they do
  differentiator?: string; // How target company differs from this competitor
}

// Competitive landscape data
export interface CompetitiveLandscape {
  directCompetitors: CompetitorInfo[];
  indirectCompetitors?: CompetitorInfo[];
  marketPosition?: string; // Brief analysis of where they stand
}

// Intel data structure - Focused Sales Brief format
export interface CompanyIntelData {
  // 2-3 sentence overview of what the company actually does
  companySnapshot: string;
  
  // Specific reasons this company is relevant to B2B sellers
  whyTheyMatterToYou: string[];
  
  // What someone with this title typically cares about (KPIs, problems, responsibilities)
  roleInsights: string[];
  
  // Short, sharp questions for a first meeting
  highImpactQuestions: string[];
  
  // Potential landmines or sensitive topics (regulation, setbacks, competitors)
  risksOrSensitivities: string[];
  
  // Key historical developments (not live news)
  keyDevelopments: KeyDevelopment[];
  
  // Enhanced intel: Funding data (Crunchbase-style)
  funding?: FundingData;
  
  // Enhanced intel: Technology stack (BuiltWith-style)
  techStack?: TechStackData;
  
  // Enhanced intel: Competitive landscape
  competitors?: CompetitiveLandscape;
  
  // Metadata
  generatedAt: string;
  error?: string; // Optional error message when using fallback data
  
  // Legacy fields for backwards compatibility (optional)
  snapshot?: {
    industry?: string;
    founded?: string;
    employees?: string;
    headquarters?: string;
    description?: string;
    keyProducts?: string[];
  };
  recentNews?: Array<{
    headline: string;
    date: string;
    summary: string;
  }>;
  talkingPoints?: string[];
}

// ============================================
// Intel V2 Types - Source-backed, verified intel
// ============================================

// Source reference for verified claims
export interface IntelSource {
  title: string;
  url: string;
}

// Verified bullet with source backing
export interface VerifiedBullet {
  text: string;
  source: IntelSource;
}

// Signal/news item with date and source
export interface SignalItem {
  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  sourceName: string;
}

// Headcount range buckets
export type HeadcountRange = "1-10" | "11-50" | "51-200" | "201-500" | "501-1k" | "1k-5k" | "5k-10k" | "10k+";

// Stock data for company
export interface StockData {
  ticker: string;
  exchange?: string | null;
  price?: number | null;
  changePercent?: number | null;
  currency?: string | null;
}

// Company Intel V2 - verified facts + visual cards
export interface CompanyIntelV2 {
  companyName: string;
  website?: string | null;
  canonicalEntity?: string | null;
  lastRefreshedAt: string;
  
  // Section 1: Company Profile
  summary?: string | null; // Short company description
  industry?: string | null;
  founded?: string | null;
  founderOrCeo?: string | null;
  
  // Social links (displayed under profile)
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  
  // Section 2: Visual Quick Cards
  headcount?: {
    range: HeadcountRange;
    source: IntelSource;
  } | null;
  
  hq?: {
    city?: string | null;
    country?: string | null;
    source: IntelSource;
  } | null;
  
  stock?: StockData | null;
  
  // Section 3: Recent News (3-4 items)
  latestSignals: SignalItem[];
  
  // Section 4: Competitors
  competitors?: CompetitorInfo[];
  
  // All sources used
  sources?: IntelSource[];
  
  // Metadata
  error?: string;
}

// Parsed contact from OCR/text extraction
export interface ParsedContact {
  fullName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  linkedinSearchUrl?: string;  // Google search URL when no direct LinkedIn found
  address?: string;
  companyDomain?: string;
}

// Public profile type (limited fields)
export interface PublicProfile {
  fullName: string | null;
  jobTitle: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedinUrl: string | null;
  country: string | null;
  city: string | null;
}
