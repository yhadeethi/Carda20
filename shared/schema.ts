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


// HubSpot OAuth tokens (per-user)
export const hubspotTokens = pgTable(
  "hubspot_tokens",
  {
    userId: integer("user_id").notNull().references(() => users.id).primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    hubDomain: text("hub_domain"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("hubspot_tokens_user_idx").on(t.userId),
  })
);


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
  notes: text("notes"), // Contact notes
  lastTouchedAt: timestamp("last_touched_at"), // Last interaction timestamp
  // Org chart fields
  orgDepartment: varchar("org_department", { length: 50 }),
  orgRole: varchar("org_role", { length: 50 }),
  orgReportsToId: integer("org_reports_to_id"), // Self-referencing for manager relationship
  orgInfluence: varchar("org_influence", { length: 50 }),
  orgRelationshipStrength: varchar("org_relationship_strength", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contact Tasks table - stores tasks per contact
export const contactTasks = pgTable("contact_tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  clientId: text("client_id").notNull(), // Client-generated ID for offline sync
  title: text("title").notNull(),
  done: integer("done").notNull().default(0), // 0 = false, 1 = true (SQLite compatibility)
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contact_tasks_contact_idx").on(table.contactId),
  index("contact_tasks_user_idx").on(table.userId),
  index("contact_tasks_client_id_idx").on(table.clientId),
]);

// Contact Reminders table - stores reminders per contact
export const contactReminders = pgTable("contact_reminders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  clientId: text("client_id").notNull(), // Client-generated ID for offline sync
  label: text("label").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  done: integer("done").notNull().default(0), // 0 = false, 1 = true
  doneAt: timestamp("done_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contact_reminders_contact_idx").on(table.contactId),
  index("contact_reminders_user_idx").on(table.userId),
  index("contact_reminders_client_id_idx").on(table.clientId),
  index("contact_reminders_remind_at_idx").on(table.remindAt),
]);

// Timeline Events table - stores activity timeline per contact
export const timelineEvents = pgTable("timeline_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  clientId: text("client_id").notNull(), // Client-generated ID for offline sync
  type: varchar("type", { length: 50 }).notNull(), // e.g., "scan_created", "note_added", etc.
  summary: text("summary").notNull(),
  meta: jsonb("meta"), // Additional metadata
  eventAt: timestamp("event_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("timeline_events_contact_idx").on(table.contactId),
  index("timeline_events_user_idx").on(table.userId),
  index("timeline_events_client_id_idx").on(table.clientId),
  index("timeline_events_event_at_idx").on(table.eventAt),
]);

// Event Preferences table - stores user preferences for calendar events
export const eventPreferences = pgTable("event_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  eventId: text("event_id").notNull(), // External event ID (from calendar)
  pinned: integer("pinned").notNull().default(0), // 0 = false, 1 = true
  attending: varchar("attending", { length: 10 }), // 'yes', 'no', 'maybe', null
  note: text("note"),
  reminderSet: integer("reminder_set").notNull().default(0),
  reminderDismissed: integer("reminder_dismissed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("event_preferences_user_idx").on(table.userId),
  index("event_preferences_event_idx").on(table.eventId),
]);

// Merge History table - stores contact merge operations for undo functionality
export const mergeHistory = pgTable("merge_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  primaryContactId: text("primary_contact_id").notNull(), // The contact that was kept
  mergedContactSnapshots: jsonb("merged_contact_snapshots").notNull(), // Array of merged contact data
  mergedAt: timestamp("merged_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("merge_history_user_idx").on(table.userId),
  index("merge_history_merged_at_idx").on(table.mergedAt),
]);

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

// User Events table - stores user-created events (from scan mode, manual creation, or calendar import)
export const userEvents = pgTable("user_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startAt: timestamp("start_at").defaultNow().notNull(),
  endAt: timestamp("end_at"),
  locationLabel: text("location_label"),
  lat: text("lat"), // stored as text, parsed to double
  lng: text("lng"), // stored as text, parsed to double
  tags: jsonb("tags").default([]).$type<string[]>(),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual").notNull(), // 'manual', 'calendar_import', 'scan_draft'
  isDraft: integer("is_draft").default(0).notNull(), // 0 = false, 1 = true
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("user_events_user_idx").on(table.userId),
  startAtIdx: index("user_events_start_at_idx").on(table.startAt),
  isDraftIdx: index("user_events_is_draft_idx").on(table.isDraft),
}));

// User Event Contacts table - links contacts to events
export const userEventContacts = pgTable("user_event_contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => userEvents.id, { onDelete: "cascade" }),
  contactIdV1: text("contact_id_v1"), // LocalStorage contact ID (v1 format)
  contactIdV2: integer("contact_id_v2"), // Database contact ID (v2 format)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("user_event_contacts_user_idx").on(table.userId),
  eventIdx: index("user_event_contacts_event_idx").on(table.eventId),
  contactV1Idx: index("user_event_contacts_contact_v1_idx").on(table.contactIdV1),
  contactV2Idx: index("user_event_contacts_contact_v2_idx").on(table.contactIdV2),
}));

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
  primaryPhone?: string | null;
  investors?: string[] | null;
}

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  contactTasks: many(contactTasks),
  contactReminders: many(contactReminders),
  timelineEvents: many(timelineEvents),
  eventPreferences: many(eventPreferences),
  mergeHistory: many(mergeHistory),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  tasks: many(contactTasks),
  reminders: many(contactReminders),
  timelineEvents: many(timelineEvents),
}));

export const contactTasksRelations = relations(contactTasks, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTasks.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [contactTasks.userId],
    references: [users.id],
  }),
}));

export const contactRemindersRelations = relations(contactReminders, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactReminders.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [contactReminders.userId],
    references: [users.id],
  }),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  contact: one(contacts, {
    fields: [timelineEvents.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [timelineEvents.userId],
    references: [users.id],
  }),
}));

export const eventPreferencesRelations = relations(eventPreferences, ({ one }) => ({
  user: one(users, {
    fields: [eventPreferences.userId],
    references: [users.id],
  }),
}));

export const mergeHistoryRelations = relations(mergeHistory, ({ one }) => ({
  user: one(users, {
    fields: [mergeHistory.userId],
    references: [users.id],
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

export const userEventsRelations = relations(userEvents, ({ one, many }) => ({
  user: one(users, {
    fields: [userEvents.userId],
    references: [users.id],
  }),
  eventContacts: many(userEventContacts),
}));

export const userEventContactsRelations = relations(userEventContacts, ({ one }) => ({
  user: one(users, {
    fields: [userEventContacts.userId],
    references: [users.id],
  }),
  event: one(userEvents, {
    fields: [userEventContacts.eventId],
    references: [userEvents.id],
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

export const insertContactTaskSchema = createInsertSchema(contactTasks).omit({
  id: true,
  createdAt: true,
});

export const insertContactReminderSchema = createInsertSchema(contactReminders).omit({
  id: true,
  createdAt: true,
});

export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({
  id: true,
  createdAt: true,
});

export const insertEventPreferenceSchema = createInsertSchema(eventPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMergeHistorySchema = createInsertSchema(mergeHistory).omit({
  id: true,
  createdAt: true,
});

export const insertUserEventSchema = createInsertSchema(userEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserEventContactSchema = createInsertSchema(userEventContacts).omit({
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

export const insertHubspotTokenSchema = createInsertSchema(hubspotTokens);
export const upsertHubspotTokenSchema = insertHubspotTokenSchema;

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
export type HubspotToken = typeof hubspotTokens.$inferSelect;
export type InsertHubspotToken = typeof hubspotTokens.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompanyIntel = z.infer<typeof insertCompanyIntelSchema>;
export type CompanyIntel = typeof companyIntel.$inferSelect;

export type ContactTask = typeof contactTasks.$inferSelect;
export type InsertContactTask = z.infer<typeof insertContactTaskSchema>;
export type ContactReminder = typeof contactReminders.$inferSelect;
export type InsertContactReminder = z.infer<typeof insertContactReminderSchema>;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type EventPreference = typeof eventPreferences.$inferSelect;
export type InsertEventPreference = z.infer<typeof insertEventPreferenceSchema>;
export type MergeHistory = typeof mergeHistory.$inferSelect;
export type InsertMergeHistory = z.infer<typeof insertMergeHistorySchema>;
export type UserEvent = typeof userEvents.$inferSelect;
export type InsertUserEvent = z.infer<typeof insertUserEventSchema>;
export type UserEventContact = typeof userEventContacts.$inferSelect;
export type InsertUserEventContact = z.infer<typeof insertUserEventContactSchema>;

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
  
  // Apollo Boost data (user-triggered enrichment)
  isBoosted?: boolean;
  boostedAt?: string | null;
  revenue?: string | null; // Formatted revenue (e.g. "$10M - $50M")
  funding?: {
    totalRaised?: string | null; // Formatted total (e.g. "$25M")
    latestRound?: string | null; // e.g. "Series B"
    investors?: string[];
  } | null;
  primaryPhone?: string | null;
  
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
