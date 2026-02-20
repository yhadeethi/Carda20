import {
  users, contacts, companies, companyIntel, hubspotTokens, salesforceTokens,
  contactTasks, contactReminders, timelineEvents, eventPreferences, mergeHistory,
  userEvents, userEventContacts, userEventPhotos,
  type User, type InsertUser, type UpsertUser,
  type Contact, type InsertContact,
  type Company, type InsertCompany,
  type CompanyIntel, type InsertCompanyIntel,
  type HubspotToken, type InsertHubspotToken,
  type SalesforceToken, type InsertSalesforceToken,
  type CompanyIntelData,
  type ContactTask, type InsertContactTask,
  type ContactReminder, type InsertContactReminder,
  type TimelineEvent, type InsertTimelineEvent,
  type EventPreference, type InsertEventPreference,
  type MergeHistory, type InsertMergeHistory,
  type UserEvent, type InsertUserEvent,
  type UserEventContact, type InsertUserEventContact,
  type UserEventPhoto, type InsertUserEventPhoto
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

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
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined>;
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

  // Salesforce OAuth tokens
  getSalesforceTokens(userId: number): Promise<SalesforceToken | undefined>;
  upsertSalesforceTokens(tokens: InsertSalesforceToken): Promise<SalesforceToken>;
  deleteSalesforceTokens(userId: number): Promise<void>;

  // Contact Tasks
  getContactTasks(contactId: number, userId: number): Promise<ContactTask[]>;
  getContactTaskByClientId(clientId: string): Promise<ContactTask | undefined>;
  createContactTask(task: InsertContactTask): Promise<ContactTask>;
  updateContactTask(id: number, userId: number, updates: Partial<ContactTask>): Promise<ContactTask | undefined>;
  deleteContactTask(id: number, userId: number): Promise<boolean>;

  // Contact Reminders
  getContactReminders(contactId: number, userId: number): Promise<ContactReminder[]>;
  getContactReminderByClientId(clientId: string): Promise<ContactReminder | undefined>;
  getUpcomingReminders(userId: number, limit?: number): Promise<ContactReminder[]>;
  createContactReminder(reminder: InsertContactReminder): Promise<ContactReminder>;
  updateContactReminder(id: number, userId: number, updates: Partial<ContactReminder>): Promise<ContactReminder | undefined>;
  deleteContactReminder(id: number, userId: number): Promise<boolean>;

  // Timeline Events
  getTimelineEvents(contactId: number, userId: number): Promise<TimelineEvent[]>;
  getTimelineEventByClientId(clientId: string): Promise<TimelineEvent | undefined>;
  createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent>;
  deleteTimelineEvent(id: number, userId: number): Promise<boolean>;

  // Event Preferences
  getEventPreferences(userId: number, eventId: string): Promise<EventPreference | undefined>;
  getAllEventPreferences(userId: number): Promise<EventPreference[]>;
  upsertEventPreference(preference: InsertEventPreference): Promise<EventPreference>;

  // Merge History
  getMergeHistory(userId: number, limit?: number): Promise<MergeHistory[]>;
  createMergeHistory(history: InsertMergeHistory): Promise<MergeHistory>;
  deleteMergeHistory(id: number): Promise<boolean>;

  // User Events
  getUserEvents(userId: number, limit?: number): Promise<UserEvent[]>;
  getUserEvent(id: number): Promise<UserEvent | undefined>;
  getActiveUserEvent(userId: number): Promise<UserEvent | undefined>;
  createUserEvent(event: InsertUserEvent): Promise<UserEvent>;
  updateUserEvent(id: number, updates: Partial<UserEvent>): Promise<UserEvent | undefined>;
  deleteUserEvent(id: number): Promise<boolean>;

  // User Event Contacts
  getUserEventContacts(eventId: number): Promise<UserEventContact[]>;
  getContactsForUserEvent(eventId: number): Promise<Contact[]>;
  attachContactToEvent(eventContact: InsertUserEventContact): Promise<UserEventContact>;
  detachContactFromEvent(eventId: number, contactId: number): Promise<boolean>;

  // User Event Photos
  getUserEventPhotos(eventId: number): Promise<UserEventPhoto[]>;
  createUserEventPhoto(photo: InsertUserEventPhoto): Promise<UserEventPhoto>;
  deleteUserEventPhoto(id: number): Promise<boolean>;

  // Public ID resolvers
  getContactByPublicId(userId: number, publicId: string): Promise<Contact | undefined>;
  getCompanyByPublicId(userId: number, publicId: string): Promise<Company | undefined>;
  getUserEventByPublicId(userId: number, publicId: string): Promise<UserEvent | undefined>;
  resolveContactRef(userId: number, ref: string): Promise<number>;
  resolveCompanyRef(userId: number, ref: string): Promise<number>;
  resolveEventRef(userId: number, ref: string): Promise<number>;

  // Upsert by publicId (non-destructive merge)
  upsertContactByPublicId(userId: number, publicId: string, data: Partial<Contact>): Promise<Contact>;
  upsertCompanyByPublicId(userId: number, publicId: string, data: Partial<Company>): Promise<Company>;
  upsertUserEventByPublicId(userId: number, publicId: string, data: Partial<UserEvent>): Promise<UserEvent>;

  // List endpoints (with publicId)
  getCompaniesByUserId(userId: number): Promise<Company[]>;
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

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db
      .insert(contacts)
      .values(contact)
      .returning();
    return created;
  }

  async updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    // Drizzle returns an array-like result with rowCount property
    return (result as any).rowCount > 0;
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

  async getSalesforceTokens(userId: number): Promise<SalesforceToken | undefined> {
    const [token] = await db
      .select()
      .from(salesforceTokens)
      .where(eq(salesforceTokens.userId, userId));
    return token || undefined;
  }

  async upsertSalesforceTokens(tokens: InsertSalesforceToken): Promise<SalesforceToken> {
    const [result] = await db
      .insert(salesforceTokens)
      .values(tokens)
      .onConflictDoUpdate({
        target: salesforceTokens.userId,
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          instanceUrl: tokens.instanceUrl,
          expiresAt: tokens.expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteSalesforceTokens(userId: number): Promise<void> {
    await db.delete(salesforceTokens).where(eq(salesforceTokens.userId, userId));
  }

  // Contact Tasks
  async getContactTasks(contactId: number, userId: number): Promise<ContactTask[]> {
    return db
      .select()
      .from(contactTasks)
      .where(and(eq(contactTasks.contactId, contactId), eq(contactTasks.userId, userId)))
      .orderBy(desc(contactTasks.createdAt));
  }

  async getContactTaskByClientId(clientId: string): Promise<ContactTask | undefined> {
    const [task] = await db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.clientId, clientId))
      .limit(1);
    return task || undefined;
  }

  async createContactTask(task: InsertContactTask): Promise<ContactTask> {
    const [created] = await db
      .insert(contactTasks)
      .values(task)
      .returning();
    return created;
  }

  async updateContactTask(id: number, userId: number, updates: Partial<ContactTask>): Promise<ContactTask | undefined> {
    const [task] = await db
      .update(contactTasks)
      .set(updates)
      .where(and(eq(contactTasks.id, id), eq(contactTasks.userId, userId)))
      .returning();
    return task || undefined;
  }

  async deleteContactTask(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(contactTasks).where(and(eq(contactTasks.id, id), eq(contactTasks.userId, userId)));
    return (result as any).rowCount > 0;
  }

  // Contact Reminders
  async getContactReminders(contactId: number, userId: number): Promise<ContactReminder[]> {
    return db
      .select()
      .from(contactReminders)
      .where(and(eq(contactReminders.contactId, contactId), eq(contactReminders.userId, userId)))
      .orderBy(desc(contactReminders.remindAt));
  }

  async getContactReminderByClientId(clientId: string): Promise<ContactReminder | undefined> {
    const [reminder] = await db
      .select()
      .from(contactReminders)
      .where(eq(contactReminders.clientId, clientId))
      .limit(1);
    return reminder || undefined;
  }

  async getUpcomingReminders(userId: number, limit: number = 20): Promise<ContactReminder[]> {
    return db
      .select()
      .from(contactReminders)
      .where(and(
        eq(contactReminders.userId, userId),
        eq(contactReminders.done, 0)
      ))
      .orderBy(contactReminders.remindAt)
      .limit(limit);
  }

  async createContactReminder(reminder: InsertContactReminder): Promise<ContactReminder> {
    const [created] = await db
      .insert(contactReminders)
      .values(reminder)
      .returning();
    return created;
  }

  async updateContactReminder(id: number, userId: number, updates: Partial<ContactReminder>): Promise<ContactReminder | undefined> {
    const [reminder] = await db
      .update(contactReminders)
      .set(updates)
      .where(and(eq(contactReminders.id, id), eq(contactReminders.userId, userId)))
      .returning();
    return reminder || undefined;
  }

  async deleteContactReminder(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(contactReminders).where(and(eq(contactReminders.id, id), eq(contactReminders.userId, userId)));
    return (result as any).rowCount > 0;
  }

  // Timeline Events
  async getTimelineEvents(contactId: number, userId: number): Promise<TimelineEvent[]> {
    return db
      .select()
      .from(timelineEvents)
      .where(and(eq(timelineEvents.contactId, contactId), eq(timelineEvents.userId, userId)))
      .orderBy(desc(timelineEvents.eventAt));
  }

  async getTimelineEventByClientId(clientId: string): Promise<TimelineEvent | undefined> {
    const [event] = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.clientId, clientId))
      .limit(1);
    return event || undefined;
  }

  async createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent> {
    const [created] = await db
      .insert(timelineEvents)
      .values(event)
      .returning();
    return created;
  }

  async deleteTimelineEvent(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(timelineEvents).where(and(eq(timelineEvents.id, id), eq(timelineEvents.userId, userId)));
    return (result as any).rowCount > 0;
  }

  // Event Preferences
  async getEventPreferences(userId: number, eventId: string): Promise<EventPreference | undefined> {
    const [preference] = await db
      .select()
      .from(eventPreferences)
      .where(and(
        eq(eventPreferences.userId, userId),
        eq(eventPreferences.eventId, eventId)
      ))
      .limit(1);
    return preference || undefined;
  }

  async getAllEventPreferences(userId: number): Promise<EventPreference[]> {
    return db
      .select()
      .from(eventPreferences)
      .where(eq(eventPreferences.userId, userId));
  }

  async upsertEventPreference(preference: InsertEventPreference): Promise<EventPreference> {
    // Check if preference already exists
    const existing = await this.getEventPreferences(preference.userId, preference.eventId);

    if (existing) {
      const [updated] = await db
        .update(eventPreferences)
        .set({ ...preference, updatedAt: new Date() })
        .where(and(
          eq(eventPreferences.userId, preference.userId),
          eq(eventPreferences.eventId, preference.eventId)
        ))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(eventPreferences)
        .values(preference)
        .returning();
      return created;
    }
  }

  // Merge History
  async getMergeHistory(userId: number, limit: number = 10): Promise<MergeHistory[]> {
    return db
      .select()
      .from(mergeHistory)
      .where(eq(mergeHistory.userId, userId))
      .orderBy(desc(mergeHistory.mergedAt))
      .limit(limit);
  }

  async createMergeHistory(history: InsertMergeHistory): Promise<MergeHistory> {
    const [created] = await db
      .insert(mergeHistory)
      .values(history)
      .returning();
    return created;
  }

  async deleteMergeHistory(id: number): Promise<boolean> {
    const result = await db.delete(mergeHistory).where(eq(mergeHistory.id, id));
    return (result as any).rowCount > 0;
  }

  // User Events
  async getUserEvents(userId: number, limit: number = 50): Promise<UserEvent[]> {
    return db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, userId))
      .orderBy(desc(userEvents.createdAt))
      .limit(limit);
  }

  async getUserEvent(id: number): Promise<UserEvent | undefined> {
    const [event] = await db.select().from(userEvents).where(eq(userEvents.id, id));
    return event || undefined;
  }

  async getActiveUserEvent(userId: number): Promise<UserEvent | undefined> {
    const [event] = await db
      .select()
      .from(userEvents)
      .where(and(
        eq(userEvents.userId, userId),
        eq(userEvents.isActive, 1)
      ))
      .orderBy(desc(userEvents.createdAt))
      .limit(1);
    return event || undefined;
  }

  async createUserEvent(event: InsertUserEvent): Promise<UserEvent> {
    const [created] = await db
      .insert(userEvents)
      .values(event)
      .returning();
    return created;
  }

  async updateUserEvent(id: number, updates: Partial<UserEvent>): Promise<UserEvent | undefined> {
    const [event] = await db
      .update(userEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userEvents.id, id))
      .returning();
    return event || undefined;
  }

  async deleteUserEvent(id: number): Promise<boolean> {
    const result = await db.delete(userEvents).where(eq(userEvents.id, id));
    return (result as any).rowCount > 0;
  }

  // User Event Contacts
  async getUserEventContacts(eventId: number): Promise<UserEventContact[]> {
    return db
      .select()
      .from(userEventContacts)
      .where(eq(userEventContacts.eventId, eventId))
      .orderBy(desc(userEventContacts.createdAt));
  }

  async getContactsForUserEvent(eventId: number): Promise<Contact[]> {
    const eventContactLinks = await db
      .select()
      .from(userEventContacts)
      .where(eq(userEventContacts.eventId, eventId));

    if (eventContactLinks.length === 0) return [];

    const contactIds = eventContactLinks.map(ec => ec.contactId);
    const result: Contact[] = [];

    for (const contactId of contactIds) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, contactId));
      if (contact) result.push(contact);
    }

    return result;
  }

  async attachContactToEvent(eventContact: InsertUserEventContact): Promise<UserEventContact> {
    const [created] = await db
      .insert(userEventContacts)
      .values(eventContact)
      .onConflictDoNothing()
      .returning();
    if (!created) {
      const [existing] = await db.select().from(userEventContacts)
        .where(and(
          eq(userEventContacts.eventId, eventContact.eventId),
          eq(userEventContacts.contactId, eventContact.contactId)
        ));
      return existing;
    }
    return created;
  }

  async detachContactFromEvent(eventId: number, contactId: number): Promise<boolean> {
    const result = await db
      .delete(userEventContacts)
      .where(and(
        eq(userEventContacts.eventId, eventId),
        eq(userEventContacts.contactId, contactId)
      ));
    return (result as any).rowCount > 0;
  }

  // User Event Photos
  async getUserEventPhotos(eventId: number): Promise<UserEventPhoto[]> {
    return db
      .select()
      .from(userEventPhotos)
      .where(eq(userEventPhotos.eventId, eventId))
      .orderBy(desc(userEventPhotos.createdAt));
  }

  async createUserEventPhoto(photo: InsertUserEventPhoto): Promise<UserEventPhoto> {
    const [created] = await db
      .insert(userEventPhotos)
      .values(photo)
      .returning();
    return created;
  }

  async deleteUserEventPhoto(id: number): Promise<boolean> {
    const result = await db.delete(userEventPhotos).where(eq(userEventPhotos.id, id));
    return (result as any).rowCount > 0;
  }

  // Public ID resolvers
  async getContactByPublicId(userId: number, publicId: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.publicId, publicId)));
    return contact || undefined;
  }

  async getCompanyByPublicId(userId: number, publicId: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies)
      .where(and(eq(companies.userId, userId), eq(companies.publicId, publicId)));
    return company || undefined;
  }

  async getUserEventByPublicId(userId: number, publicId: string): Promise<UserEvent | undefined> {
    const [event] = await db.select().from(userEvents)
      .where(and(eq(userEvents.userId, userId), eq(userEvents.publicId, publicId)));
    return event || undefined;
  }

  async resolveContactRef(userId: number, ref: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ref)) {
      throw new Error("INVALID_REF");
    }
    const contact = await this.getContactByPublicId(userId, ref);
    if (!contact) throw new Error("NOT_FOUND");
    return contact.id;
  }

  async resolveCompanyRef(userId: number, ref: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ref)) {
      throw new Error("INVALID_REF");
    }
    const company = await this.getCompanyByPublicId(userId, ref);
    if (!company) throw new Error("NOT_FOUND");
    return company.id;
  }

  async resolveEventRef(userId: number, ref: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ref)) {
      throw new Error("INVALID_REF");
    }
    const event = await this.getUserEventByPublicId(userId, ref);
    if (!event) throw new Error("NOT_FOUND");
    return event.id;
  }

  // Non-destructive upsert helpers
  private buildNonDestructiveUpdate<T extends Record<string, any>>(data: Partial<T>, excludeKeys: string[] = []): Record<string, any> {
    const update: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (excludeKeys.includes(key)) continue;
      if (value === null || value === undefined || value === "") continue;
      update[key] = value;
    }
    return update;
  }

  async upsertContactByPublicId(userId: number, publicId: string, data: Partial<Contact>): Promise<Contact> {
    const existing = await this.getContactByPublicId(userId, publicId);

    if (existing) {
      const updateData = this.buildNonDestructiveUpdate(data, ["id", "userId", "publicId", "createdAt"]);
      if (Object.keys(updateData).length === 0) return existing;
      const [updated] = await db.update(contacts)
        .set(updateData)
        .where(and(eq(contacts.userId, userId), eq(contacts.publicId, publicId)))
        .returning();
      return updated;
    } else {
      const insertData = this.buildNonDestructiveUpdate(data, ["id", "userId", "publicId", "createdAt"]);
      const [created] = await db.insert(contacts)
        .values({
          ...insertData,
          userId,
          publicId,
        } as any)
        .returning();
      return created;
    }
  }

  async upsertCompanyByPublicId(userId: number, publicId: string, data: Partial<Company>): Promise<Company> {
    const existing = await this.getCompanyByPublicId(userId, publicId);

    if (existing) {
      const updateData = this.buildNonDestructiveUpdate(data, ["id", "userId", "publicId"]);
      if (Object.keys(updateData).length === 0) return existing;
      const [updated] = await db.update(companies)
        .set(updateData)
        .where(and(eq(companies.userId, userId), eq(companies.publicId, publicId)))
        .returning();
      return updated;
    } else {
      const insertData = this.buildNonDestructiveUpdate(data, ["id", "userId", "publicId"]);
      const [created] = await db.insert(companies)
        .values({
          ...insertData,
          userId,
          publicId,
        } as any)
        .returning();
      return created;
    }
  }

  async upsertUserEventByPublicId(userId: number, publicId: string, data: Partial<UserEvent>): Promise<UserEvent> {
    const existing = await this.getUserEventByPublicId(userId, publicId);

    if (existing) {
      const updateData = this.buildNonDestructiveUpdate(data, ["id", "userId", "publicId", "createdAt", "updatedAt"]);
      if (Object.keys(updateData).length === 0) return existing;
      updateData.updatedAt = new Date();
      const [updated] = await db.update(userEvents)
        .set(updateData)
        .where(and(eq(userEvents.userId, userId), eq(userEvents.publicId, publicId)))
        .returning();
      return updated;
    } else {
      const insertData = this.buildNonDestructiveUpdate(data, ["id", "userId", "publicId", "createdAt", "updatedAt"]);
      const [created] = await db.insert(userEvents)
        .values({
          ...insertData,
          userId,
          publicId,
          title: (data.title || "Untitled Event"),
        } as any)
        .returning();
      return created;
    }
  }

  // List companies for user
  async getCompaniesByUserId(userId: number): Promise<Company[]> {
    return db.select().from(companies)
      .where(eq(companies.userId, userId))
      .orderBy(desc(companies.id));
  }
}

export const storage = new DatabaseStorage();
