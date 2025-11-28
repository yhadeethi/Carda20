import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - stores user accounts and profile data
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
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

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
});

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

// Intel data structure
export interface CompanyIntelData {
  snapshot: {
    industry?: string;
    founded?: string;
    employees?: string;
    headquarters?: string;
    description?: string;
    keyProducts?: string[];
  };
  recentNews: Array<{
    headline: string;
    date: string;
    summary: string;
  }>;
  talkingPoints: string[];
  generatedAt: string;
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
