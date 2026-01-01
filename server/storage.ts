import { 
  users, contacts, companies, companyIntel, hubspotTokens,
  type User, type InsertUser, type UpsertUser,
  type Contact, type InsertContact,
  type Company, type InsertCompany,
  type CompanyIntel, type InsertCompanyIntel,
  type HubspotToken, type InsertHubspotToken,
  type CompanyIntelData
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByAuthId(authId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPublicSlug(slug: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getContact(id: number): Promise<Contact | undefined>;
  getContactsByUserId(userId: number, limit?: number): Promise<Contact[]>;
  createContact(contact: Partial<InsertContact> & { userId: number }): Promise<Contact>;
  updateContact(id: number, updates: Record<string, unknown>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  findDuplicateContact(userId: number, email: string, companyName: string): Promise<Contact | undefined>;
  
  getCompanyByDomain(domain: string): Promise<Company | undefined>;
  getCompanyById(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined>;
  
  getCompanyIntelByCompanyId(companyId: number): Promise<CompanyIntel | undefined>;
  createCompanyIntel(intel: InsertCompanyIntel): Promise<CompanyIntel>
  // HubSpot OAuth tokens
  getHubspotTokens(userId: number): Promise<HubspotToken | undefined>;
  upsertHubspotTokens(tokens: InsertHubspotToken): Promise<HubspotToken>;
  deleteHubspotTokens(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByAuthId(authId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.authId, authId));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPublicSlug(slug: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.publicSlug, slug));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        authId: userData.authId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.authId,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async getContactsByUserId(userId: number, limit: number = 10): Promise<Contact[]> {
    return db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.createdAt))
      .limit(limit);
  }

  async createContact(contact: Partial<InsertContact> & { userId: number }): Promise<Contact> {
    const contactData = {
      userId: contact.userId,
      fullName: contact.fullName ?? null,
      companyName: contact.companyName ?? null,
      jobTitle: contact.jobTitle ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      website: contact.website ?? null,
      linkedinUrl: contact.linkedinUrl ?? null,
      address: contact.address ?? null,
      eventName: contact.eventName ?? null,
      rawText: contact.rawText ?? null,
      companyDomain: contact.companyDomain ?? null,
      dbCompanyId: contact.dbCompanyId ?? null,
      localCompanyId: contact.localCompanyId ?? null,
      org: contact.org ?? null,
      tasks: contact.tasks ?? [],
      reminders: contact.reminders ?? [],
      timeline: contact.timeline ?? [],
      notes: contact.notes ?? null,
      mergeMeta: contact.mergeMeta ?? null,
      lastTouchedAt: contact.lastTouchedAt ? new Date(contact.lastTouchedAt) : new Date(),
    };
    
    const [created] = await db
      .insert(contacts)
      .values([contactData])
      .returning();
    return created;
  }

  async updateContact(id: number, updates: Record<string, unknown>): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set(updates as Partial<Contact>)
      .where(eq(contacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return true;
  }

  async findDuplicateContact(userId: number, email: string, companyName: string): Promise<Contact | undefined> {
    if (!email && !companyName) {
      return undefined;
    }

    if (email) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.userId, userId),
          eq(contacts.email, email)
        ))
        .limit(1);
      
      if (contact) return contact;
    }

    return undefined;
  }

  async getCompanyByDomain(domain: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.domain, domain));
    return company || undefined;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db
      .insert(companies)
      .values(company)
      .returning();
    return created;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async getCompanyIntelByCompanyId(companyId: number): Promise<CompanyIntel | undefined> {
    const [intel] = await db
      .select()
      .from(companyIntel)
      .where(eq(companyIntel.companyId, companyId))
      .orderBy(desc(companyIntel.createdAt))
      .limit(1);
    return intel || undefined;
  }

  async createCompanyIntel(intel: InsertCompanyIntel): Promise<CompanyIntel> {
    const [created] = await db
      .insert(companyIntel)
      .values(intel)
      .returning();
    return created;
  }

  async getHubspotTokens(userId: number): Promise<HubspotToken | undefined> {
    const [token] = await db
      .select()
      .from(hubspotTokens)
      .where(eq(hubspotTokens.userId, userId));
    return token || undefined;
  }

  async upsertHubspotTokens(tokens: InsertHubspotToken): Promise<HubspotToken> {
    const [result] = await db
      .insert(hubspotTokens)
      .values(tokens)
      .onConflictDoUpdate({
        target: hubspotTokens.userId,
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteHubspotTokens(userId: number): Promise<void> {
    await db.delete(hubspotTokens).where(eq(hubspotTokens.userId, userId));
  }
}

export const storage = new DatabaseStorage();
