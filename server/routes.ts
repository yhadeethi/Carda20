import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { extractTextFromImage, initializeOCR } from "./ocrService";
import { parseContact, ParsedContact, splitAuAddress } from "./parseService";
import { getOrCreateCompanyIntel } from "./intelService";
import { generateIntelV2 } from "./intelV2Service";
// CompanyIntelV2 and HeadcountRange removed - Apollo boost disabled
import { parseContactWithAI, convertAIResultToContact } from "./aiParseService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { db } from "./db";
import OpenAI from "openai";

// Type definitions for authenticated requests
interface ReplitAuthUser {
  claims: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface AuthenticatedRequest extends Request {
  user: ReplitAuthUser;
}

interface HubSpotOAuthSession {
  hubspot_oauth_state?: string;
  hubspot_oauth_user?: number;
}

interface SessionRequest extends Request {
  session: Express.Session & HubSpotOAuthSession;
}

async function getCurrentUserId(req: Request): Promise<number> {
  const authUser = req.user as ReplitAuthUser | undefined;
  const authId = authUser?.claims?.sub;
  if (!authId) throw new Error("Unauthorized");
  const user = await storage.getUserByAuthId(authId);
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

function getHubSpotRedirectUri(req: Request): string {
  const envOverride = process.env.HUBSPOT_REDIRECT_URI;
  if (envOverride) return envOverride;
  const host = req.get("host");
  const proto = req.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/hubspot/callback`;
}

import { buildHubSpotAuthUrl, connectHubSpotForUser, disconnectHubSpotForUser, isHubSpotConnected, syncContactToHubSpot } from "./hubspotService";
import crypto from "crypto";

const contactInputSchema = z.object({
  fullName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  rawText: z.string().nullable().optional(),
  companyDomain: z.string().nullable().optional(),
  // Org chart fields
  orgDepartment: z.string().nullable().optional(),
  orgRole: z.string().nullable().optional(),
  orgReportsToId: z.number().nullable().optional(),
  orgInfluence: z.string().nullable().optional(),
  orgRelationshipStrength: z.string().nullable().optional(),
});

// Allowed MIME types for business card images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1, // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }

    // Check file extension as additional validation
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
    if (ext && !allowedExtensions.includes(ext)) {
      return cb(new Error(`Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`));
    }

    cb(null, true);
  },
});

// Rate limiting for expensive AI/OCR operations
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each user to 50 requests per 15 minutes
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  // Use user ID if authenticated, otherwise IP
  keyGenerator: async (req) => {
    try {
      const authUser = req.user as ReplitAuthUser | undefined;
      if (authUser?.claims?.sub) {
        return `user:${authUser.claims.sub}`;
      }
      return req.ip || 'unknown';
    } catch {
      return req.ip || 'unknown';
    }
  },
});

// Stricter rate limiting for image upload endpoints
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 uploads per 15 minutes
  message: { error: 'Too many file uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: async (req) => {
    try {
      const authUser = req.user as ReplitAuthUser | undefined;
      if (authUser?.claims?.sub) {
        return `user:${authUser.claims.sub}`;
      }
      return req.ip || 'unknown';
    } catch {
      return req.ip || 'unknown';
    }
  },
});

function generateVCard(contact: ParsedContact): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
  ];

  if (contact.fullName) {
    const names = contact.fullName.split(" ");
    const lastName = names.pop() || "";
    const firstName = names.join(" ");
    lines.push(`N:${lastName};${firstName};;;`);
    lines.push(`FN:${contact.fullName}`);
  }

  if (contact.companyName) {
    lines.push(`ORG:${contact.companyName}`);
  }

  if (contact.jobTitle) {
    lines.push(`TITLE:${contact.jobTitle}`);
  }

  if (contact.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${contact.email}`);
  }

  if (contact.phone) {
    lines.push(`TEL;TYPE=CELL:${contact.phone}`);
  }

  if (contact.website) {
    lines.push(`URL:${contact.website}`);
  }

  if (contact.linkedinUrl) {
    lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${contact.linkedinUrl}`);
  }

  if (contact.address) {
    const { street, city, state, postcode, country } = splitAuAddress(contact.address);
    if (street || city || state || postcode || country) {
      lines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postcode};${country}`);
    }
  }

  lines.push("END:VCARD");
  
  return lines.join("\r\n");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  initializeOCR();
  
  await setupAuth(app);

  app.get('/api/auth/user', async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json(null);
      }
      const authId = req.user.claims.sub;
      const user = await storage.getUserByAuthId(authId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.json(null);
    }
  });

  app.get("/api/contacts", isAuthenticated, async (req: any, res: Response) => {
    try {
      const authId = req.user.claims.sub;
      const user = await storage.getUserByAuthId(authId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const contacts = await storage.getContactsByUserId(user.id, limit);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res: Response) => {
    try {
      const authId = req.user.claims.sub;
      const user = await storage.getUserByAuthId(authId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const parsed = contactInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid contact data", errors: parsed.error.errors });
      }
      const contact = await storage.createContact({
        userId: user.id,
        ...parsed.data,
      });
      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const authId = req.user.claims.sub;
      const user = await storage.getUserByAuthId(authId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }
      const existing = await storage.getContact(contactId);
      if (!existing || existing.userId !== user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const parsed = contactInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid contact data", errors: parsed.error.errors });
      }
      const contact = await storage.updateContact(contactId, parsed.data);
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const authId = req.user.claims.sub;
      const user = await storage.getUserByAuthId(authId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }
      const existing = await storage.getContact(contactId);
      if (!existing || existing.userId !== user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteContact(contactId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.post("/api/scan", uploadRateLimiter, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).send("No image file provided");
      }

      const base64 = file.buffer.toString("base64");
      const ocrResult = await extractTextFromImage(base64);

      if (ocrResult.error) {
        return res.status(400).json({ error: ocrResult.error });
      }

      const parsed = parseContact(ocrResult.rawText);

      res.json({
        rawText: ocrResult.rawText,
        contact: parsed,
      });
    } catch (error) {
      console.error("Error scanning contact:", error);
      res.status(500).send("Failed to scan contact");
    }
  });

  app.post("/api/parse", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).send("Text is required");
      }

      const parsed = parseContact(text);
      res.json({
        rawText: text,
        contact: parsed,
      });
    } catch (error) {
      console.error("Error parsing contact:", error);
      res.status(500).send("Failed to parse contact");
    }
  });

  app.post("/api/vcard", async (req: Request, res: Response) => {
    try {
      const contact: ParsedContact = req.body;
      const vcard = generateVCard(contact);

      const filename = `${contact.fullName?.replace(/[^a-z0-9]/gi, "_") || "contact"}.vcf`;
      res.setHeader("Content-Type", "text/vcard");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(vcard);
    } catch (error) {
      console.error("Error generating vCard:", error);
      res.status(500).send("Failed to generate vCard");
    }
  });

  app.post("/api/intel", aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const { companyName, email, website, contactName, contactTitle } = req.body;

      if (!companyName && !email && !website) {
        return res.status(400).send("Company name, email, or website is required");
      }

      const companyDomain = email || website;

      const intel = await getOrCreateCompanyIntel(
        companyName,
        companyDomain,
        {},
        { contactName, contactTitle }
      );

      if (!intel) {
        return res.status(500).send("Failed to generate intel");
      }

      res.json(intel);
    } catch (error) {
      console.error("Error getting company intel:", error);
      res.status(500).send("Failed to get company intel");
    }
  });

  app.get("/api/intel-v2", async (req: Request, res: Response) => {
    try {
      const { companyName, domain, role, address } = req.query;

      if (!companyName && !domain) {
        return res.status(400).json({ error: "companyName or domain is required" });
      }

      const intel = await generateIntelV2(
        companyName as string || "",
        domain as string || null,
        role as string || undefined,
        address as string || undefined
      );

      res.json(intel);
    } catch (error) {
      console.error("Error getting company intel v2:", error);
      res.status(500).json({ error: "Failed to get company intel" });
    }
  });

  // Apollo Boost endpoint - disabled (fetchApolloEnrichment not implemented)
  // TODO: Implement Apollo enrichment when API integration is ready
  app.post("/api/intel-v2/boost", async (_req: Request, res: Response) => {
    res.status(501).json({ error: "Apollo boost feature not yet implemented" });
  });

  
  // HubSpot OAuth (per-user)
  app.get("/api/hubspot/connect", isAuthenticated, async (req: SessionRequest, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const state = crypto.randomUUID();
      req.session.hubspot_oauth_state = state;
      req.session.hubspot_oauth_user = userId;

      const redirectUri = getHubSpotRedirectUri(req);
      const url = buildHubSpotAuthUrl({ redirectUri, state });
      res.redirect(url);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to start HubSpot OAuth" });
    }
  });

  app.get("/api/hubspot/callback", isAuthenticated, async (req: SessionRequest, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const expectedState = req.session.hubspot_oauth_state;
      const userId = req.session.hubspot_oauth_user;

      if (!code || !state || !expectedState || state !== expectedState || !userId) {
        return res.status(400).send("Invalid HubSpot OAuth callback.");
      }

      const redirectUri = getHubSpotRedirectUri(req);
      await connectHubSpotForUser({ userId, code, redirectUri });

      // cleanup
      req.session.hubspot_oauth_state = undefined;
      req.session.hubspot_oauth_user = undefined;

      res.redirect("/?hubspot=connected");
    } catch (e: any) {
      console.error("HubSpot callback error:", e);
      res.redirect("/?hubspot=error");
    }
  });

  app.post("/api/hubspot/disconnect", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      await disconnectHubSpotForUser(userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to disconnect HubSpot" });
    }
  });

app.get("/api/hubspot/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const connected = await isHubSpotConnected(userId);
      res.json({ connected });
    } catch (error) {
      console.error("Error checking HubSpot status:", error);
      res.json({ connected: false });
    }
  });

  app.post("/api/hubspot/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const { email, firstname, lastname, company, jobtitle, phone, website, linkedinUrl } = req.body || {};

      const name = [firstname, lastname].filter(Boolean).join(" ").trim() || null;

      const result = await syncContactToHubSpot(userId, {
        email: email || null,
        name,
        company: company || null,
        title: jobtitle || null,
        phone: phone || null,
        website: website || null,
        linkedinUrl: linkedinUrl || null,
      });

      res.json(result);
    } catch (error: any) {
      console.error("HubSpot sync error:", error);
      res.status(500).json({ success: false, message: error?.message || "HubSpot sync failed" });
    }
  });

  app.post("/api/parse-ai", aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).send("Text is required");
      }

      const aiResult = await parseContactWithAI(text);
      console.log("AI PARSE RAW:", JSON.stringify(aiResult, null, 2));
      
      const contact = convertAIResultToContact(aiResult);
      
      res.json({
        rawText: text,
        contact: contact,
      });
    } catch (error) {
      console.error("Error parsing contact with AI:", error);
      res.status(500).send("Failed to parse contact with AI");
    }
  });

  app.post("/api/scan-ai", uploadRateLimiter, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).send("No image file provided");
      }

      const base64 = file.buffer.toString("base64");
      const ocrResult = await extractTextFromImage(base64);

      if (ocrResult.error) {
        return res.status(400).json({ error: ocrResult.error });
      }

      const aiResult = await parseContactWithAI(ocrResult.rawText);
      console.log("AI PARSE RAW:", JSON.stringify(aiResult, null, 2));
      
      const contact = convertAIResultToContact(aiResult);

      res.json({
        rawText: ocrResult.rawText,
        contact: contact,
      });
    } catch (error) {
      console.error("Error scanning contact with AI:", error);
      res.status(500).send("Failed to scan contact with AI");
    }
  });

  // AI-powered follow-up message generation
  const followupSchema = z.object({
    contact: z.object({
      name: z.string(),
      company: z.string().optional(),
      title: z.string().optional(),
      email: z.string().optional(),
    }),
    request: z.object({
      mode: z.enum(['email_followup', 'linkedin_message', 'meeting_intro']),
      tone: z.enum(['friendly', 'direct', 'warm', 'formal']),
      goal: z.string().optional(),
      context: z.string().optional(),
      length: z.enum(['short', 'medium']),
    }),
  });

  app.post("/api/followup", aiRateLimiter, async (req: Request, res: Response) => {
    try {
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const parsed = followupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { contact, request: followupRequest } = parsed.data;
      const { mode, tone, goal, context, length } = followupRequest;

      const modeDescriptions: Record<string, string> = {
        email_followup: "a professional follow-up email",
        linkedin_message: "a LinkedIn direct message (concise, networking-focused)",
        meeting_intro: "an email requesting a meeting",
      };

      const toneDescriptions: Record<string, string> = {
        friendly: "friendly and approachable",
        direct: "direct and to the point",
        warm: "warm and personable",
        formal: "formal and professional",
      };

      const lengthGuide = length === 'short' 
        ? "Keep it very brief - 2-3 sentences max." 
        : "Keep it concise but complete - around 4-6 sentences.";

      const prompt = `Generate ${modeDescriptions[mode]} for the following contact:

Name: ${contact.name}
${contact.company ? `Company: ${contact.company}` : ''}
${contact.title ? `Title: ${contact.title}` : ''}

Requirements:
- Tone: ${toneDescriptions[tone]}
- ${lengthGuide}
${goal ? `- Main objective/goal: "${goal}" - IMPORTANT: Naturally incorporate this goal into a well-formed sentence. Do NOT just insert it verbatim.` : ''}
${context ? `- Context/how we met: ${context}` : ''}

Return a JSON object with these fields:
{
  "subject": "email subject line (omit for LinkedIn messages)",
  "body": "the complete message body",
  "bullets": ["key point 1", "key point 2"] // 2-3 key points summarizing the message
}

Important guidelines:
- Start with an appropriate greeting based on the tone
- If a goal is provided, work it naturally into the message as a complete, professional sentence
- Reference the context if provided
- Include a clear call-to-action
- End with an appropriate sign-off (but don't include a signature name)
- For LinkedIn, skip the subject line entirely

Return ONLY valid JSON, no markdown or explanation.`;

      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error("[Followup] Empty response from AI");
        return res.status(500).json({ error: "Empty AI response" });
      }

      // Parse the JSON response
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleanedContent);

      // Ensure required fields
      if (!result.body) {
        return res.status(500).json({ error: "Invalid AI response structure" });
      }

      res.json({
        subject: result.subject || null,
        body: result.body,
        bullets: result.bullets || [],
      });
    } catch (error) {
      console.error("[Followup] Error generating follow-up:", error);
      res.status(500).json({ error: "Failed to generate follow-up" });
    }
  });

  // ============================================
  // Timeline Data API Endpoints
  // ============================================

  // Contact Tasks - GET all tasks for a contact
  app.get("/api/contacts/:contactId/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const tasks = await storage.getContactTasks(contactId);
      res.json(tasks);
    } catch (error) {
      console.error("[Tasks] Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Contact Tasks - CREATE a new task
  app.post("/api/contacts/:contactId/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const { clientId, title, dueAt } = req.body;

      if (!clientId || !title) {
        return res.status(400).json({ error: "Missing required fields: clientId, title" });
      }

      // Check if task with this clientId already exists (idempotency)
      const existing = await storage.getContactTaskByClientId(clientId);
      if (existing) {
        return res.json(existing);
      }

      const task = await storage.createContactTask({
        contactId,
        userId,
        clientId,
        title,
        dueAt: dueAt ? new Date(dueAt) : undefined,
        done: 0,
      });

      res.json(task);
    } catch (error) {
      console.error("[Tasks] Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Contact Tasks - UPDATE a task
  app.put("/api/contacts/:contactId/tasks/:taskId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const taskId = parseInt(req.params.taskId);

      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      const { done, completedAt, title, dueAt } = req.body;
      const updates: any = {};

      if (done !== undefined) updates.done = done ? 1 : 0;
      if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;
      if (title !== undefined) updates.title = title;
      if (dueAt !== undefined) updates.dueAt = dueAt ? new Date(dueAt) : null;

      const task = await storage.updateContactTask(taskId, updates);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("[Tasks] Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Contact Tasks - DELETE a task
  app.delete("/api/contacts/:contactId/tasks/:taskId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const taskId = parseInt(req.params.taskId);

      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      const deleted = await storage.deleteContactTask(taskId);

      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Tasks] Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Contact Reminders - GET all reminders for a contact
  app.get("/api/contacts/:contactId/reminders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const reminders = await storage.getContactReminders(contactId);
      res.json(reminders);
    } catch (error) {
      console.error("[Reminders] Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  // Contact Reminders - CREATE a new reminder
  app.post("/api/contacts/:contactId/reminders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const { clientId, label, remindAt } = req.body;

      if (!clientId || !label || !remindAt) {
        return res.status(400).json({ error: "Missing required fields: clientId, label, remindAt" });
      }

      // Check if reminder with this clientId already exists (idempotency)
      const existing = await storage.getContactReminderByClientId(clientId);
      if (existing) {
        return res.json(existing);
      }

      const reminder = await storage.createContactReminder({
        contactId,
        userId,
        clientId,
        label,
        remindAt: new Date(remindAt),
        done: 0,
      });

      res.json(reminder);
    } catch (error) {
      console.error("[Reminders] Error creating reminder:", error);
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });

  // Contact Reminders - UPDATE a reminder
  app.put("/api/contacts/:contactId/reminders/:reminderId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const reminderId = parseInt(req.params.reminderId);

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      const { done, doneAt, label, remindAt } = req.body;
      const updates: any = {};

      if (done !== undefined) updates.done = done ? 1 : 0;
      if (doneAt !== undefined) updates.doneAt = doneAt ? new Date(doneAt) : null;
      if (label !== undefined) updates.label = label;
      if (remindAt !== undefined) updates.remindAt = new Date(remindAt);

      const reminder = await storage.updateContactReminder(reminderId, updates);

      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      res.json(reminder);
    } catch (error) {
      console.error("[Reminders] Error updating reminder:", error);
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  // Contact Reminders - DELETE a reminder
  app.delete("/api/contacts/:contactId/reminders/:reminderId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const reminderId = parseInt(req.params.reminderId);

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      const deleted = await storage.deleteContactReminder(reminderId);

      if (!deleted) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Reminders] Error deleting reminder:", error);
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });

  // Timeline Events - GET all events for a contact
  app.get("/api/contacts/:contactId/timeline", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const events = await storage.getTimelineEvents(contactId);
      res.json(events);
    } catch (error) {
      console.error("[Timeline] Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch timeline events" });
    }
  });

  // Timeline Events - CREATE a new event
  app.post("/api/contacts/:contactId/timeline", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const { clientId, type, summary, meta, eventAt } = req.body;

      if (!clientId || !type || !summary || !eventAt) {
        return res.status(400).json({ error: "Missing required fields: clientId, type, summary, eventAt" });
      }

      // Check if event with this clientId already exists (idempotency)
      const existing = await storage.getTimelineEventByClientId(clientId);
      if (existing) {
        return res.json(existing);
      }

      const event = await storage.createTimelineEvent({
        contactId,
        userId,
        clientId,
        type,
        summary,
        meta: meta || null,
        eventAt: new Date(eventAt),
      });

      res.json(event);
    } catch (error) {
      console.error("[Timeline] Error creating event:", error);
      res.status(500).json({ error: "Failed to create timeline event" });
    }
  });

  // Event Preferences - GET preferences for a specific event
  app.get("/api/events/:eventId/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = req.params.eventId;

      const preferences = await storage.getEventPreferences(userId, eventId);
      res.json(preferences || null);
    } catch (error) {
      console.error("[EventPreferences] Error fetching preferences:", error);
      res.status(500).json({ error: "Failed to fetch event preferences" });
    }
  });

  // Event Preferences - GET all preferences for the user
  app.get("/api/events/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const preferences = await storage.getAllEventPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("[EventPreferences] Error fetching all preferences:", error);
      res.status(500).json({ error: "Failed to fetch event preferences" });
    }
  });

  // Event Preferences - UPSERT preferences
  app.post("/api/events/:eventId/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = req.params.eventId;

      const { pinned, attending, note, reminderSet, reminderDismissed } = req.body;

      const preference = await storage.upsertEventPreference({
        userId,
        eventId,
        pinned: pinned ? 1 : 0,
        attending: attending || null,
        note: note || null,
        reminderSet: reminderSet ? 1 : 0,
        reminderDismissed: reminderDismissed ? 1 : 0,
      });

      res.json(preference);
    } catch (error) {
      console.error("[EventPreferences] Error upserting preferences:", error);
      res.status(500).json({ error: "Failed to save event preferences" });
    }
  });

  // Merge History - GET merge history for user
  app.get("/api/merge-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const limit = parseInt(req.query.limit as string) || 10;

      const history = await storage.getMergeHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("[MergeHistory] Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch merge history" });
    }
  });

  // Merge History - CREATE new merge history entry
  app.post("/api/merge-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const { primaryContactId, mergedContactSnapshots, mergedAt } = req.body;

      if (!primaryContactId || !mergedContactSnapshots || !mergedAt) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const history = await storage.createMergeHistory({
        userId,
        primaryContactId,
        mergedContactSnapshots,
        mergedAt: new Date(mergedAt),
      });

      res.json(history);
    } catch (error) {
      console.error("[MergeHistory] Error creating history:", error);
      res.status(500).json({ error: "Failed to create merge history" });
    }
  });

  // Database Migration Endpoint - Simple one-click migration
  app.get("/api/run-migrations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const results: string[] = [];

      // Migration SQL
      const migration0001 = `
        -- Migration 0001: Timeline Tables
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "notes" text;
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "last_touched_at" timestamp;

        CREATE TABLE IF NOT EXISTS "contact_tasks" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "contact_id" integer NOT NULL,
          "user_id" integer NOT NULL,
          "client_id" text NOT NULL,
          "title" text NOT NULL,
          "done" integer DEFAULT 0 NOT NULL,
          "due_at" timestamp,
          "completed_at" timestamp,
          "created_at" timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "contact_reminders" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "contact_id" integer NOT NULL,
          "user_id" integer NOT NULL,
          "client_id" text NOT NULL,
          "label" text NOT NULL,
          "remind_at" timestamp NOT NULL,
          "done" integer DEFAULT 0 NOT NULL,
          "done_at" timestamp,
          "created_at" timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "timeline_events" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "contact_id" integer NOT NULL,
          "user_id" integer NOT NULL,
          "client_id" text NOT NULL,
          "type" varchar(50) NOT NULL,
          "summary" text NOT NULL,
          "meta" jsonb,
          "event_at" timestamp NOT NULL,
          "created_at" timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "event_preferences" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "user_id" integer NOT NULL,
          "event_id" text NOT NULL,
          "pinned" integer DEFAULT 0 NOT NULL,
          "attending" varchar(10),
          "note" text,
          "reminder_set" integer DEFAULT 0 NOT NULL,
          "reminder_dismissed" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "merge_history" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "user_id" integer NOT NULL,
          "primary_contact_id" text NOT NULL,
          "merged_contact_snapshots" jsonb NOT NULL,
          "merged_at" timestamp NOT NULL,
          "created_at" timestamp DEFAULT now()
        );

        DO $$ BEGIN
          ALTER TABLE "contact_tasks" ADD CONSTRAINT "contact_tasks_contact_id_contacts_id_fk"
            FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "contact_tasks" ADD CONSTRAINT "contact_tasks_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "contact_reminders" ADD CONSTRAINT "contact_reminders_contact_id_contacts_id_fk"
            FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "contact_reminders" ADD CONSTRAINT "contact_reminders_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_contact_id_contacts_id_fk"
            FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "event_preferences" ADD CONSTRAINT "event_preferences_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE "merge_history" ADD CONSTRAINT "merge_history_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        CREATE INDEX IF NOT EXISTS "contact_tasks_contact_idx" ON "contact_tasks" ("contact_id");
        CREATE INDEX IF NOT EXISTS "contact_tasks_user_idx" ON "contact_tasks" ("user_id");
        CREATE INDEX IF NOT EXISTS "contact_tasks_client_id_idx" ON "contact_tasks" ("client_id");
        CREATE INDEX IF NOT EXISTS "contact_reminders_contact_idx" ON "contact_reminders" ("contact_id");
        CREATE INDEX IF NOT EXISTS "contact_reminders_user_idx" ON "contact_reminders" ("user_id");
        CREATE INDEX IF NOT EXISTS "contact_reminders_client_id_idx" ON "contact_reminders" ("client_id");
        CREATE INDEX IF NOT EXISTS "contact_reminders_remind_at_idx" ON "contact_reminders" ("remind_at");
        CREATE INDEX IF NOT EXISTS "timeline_events_contact_idx" ON "timeline_events" ("contact_id");
        CREATE INDEX IF NOT EXISTS "timeline_events_user_idx" ON "timeline_events" ("user_id");
        CREATE INDEX IF NOT EXISTS "timeline_events_client_id_idx" ON "timeline_events" ("client_id");
        CREATE INDEX IF NOT EXISTS "timeline_events_event_at_idx" ON "timeline_events" ("event_at");
        CREATE INDEX IF NOT EXISTS "event_preferences_user_idx" ON "event_preferences" ("user_id");
        CREATE INDEX IF NOT EXISTS "event_preferences_event_idx" ON "event_preferences" ("event_id");
        CREATE INDEX IF NOT EXISTS "merge_history_user_idx" ON "merge_history" ("user_id");
        CREATE INDEX IF NOT EXISTS "merge_history_merged_at_idx" ON "merge_history" ("merged_at");
      `;

      const migration0002 = `
        -- Migration 0002: Org Chart Fields
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "org_department" varchar(50);
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "org_role" varchar(50);
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "org_reports_to_id" integer;
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "org_influence" varchar(50);
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "org_relationship_strength" varchar(50);

        CREATE INDEX IF NOT EXISTS "contacts_org_reports_to_idx" ON "contacts" ("org_reports_to_id");
        CREATE INDEX IF NOT EXISTS "contacts_org_department_idx" ON "contacts" ("org_department");
      `;

      // Run migrations
      results.push("🚀 Running Migration 0001: Timeline Tables...");
      await db.execute(migration0001);
      results.push("✅ Migration 0001 completed successfully!");

      results.push("🚀 Running Migration 0002: Org Chart Fields...");
      await db.execute(migration0002);
      results.push("✅ Migration 0002 completed successfully!");

      results.push("🎉 All migrations completed! Your database is ready.");

      // Return HTML response
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Database Migrations</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #2d3748; margin-top: 0; }
            .result {
              padding: 10px;
              margin: 10px 0;
              background: #f7fafc;
              border-left: 3px solid #4299e1;
              border-radius: 4px;
            }
            .success { border-left-color: #48bb78; }
            .link {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
            a { color: #4299e1; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Database Migrations Complete</h1>
            ${results.map(r => `<div class="result ${r.includes('✅') ? 'success' : ''}">${r}</div>`).join('')}
            <div class="link">
              <a href="/">← Back to Carda</a>
            </div>
          </div>
        </body>
        </html>
      `;

      res.send(html);
    } catch (error: any) {
      console.error("[Migrations] Error running migrations:", error);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Migration Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #e53e3e; margin-top: 0; }
            .error {
              padding: 15px;
              background: #fff5f5;
              border-left: 3px solid #e53e3e;
              border-radius: 4px;
              margin: 20px 0;
              color: #742a2a;
            }
            pre {
              background: #f7fafc;
              padding: 15px;
              border-radius: 4px;
              overflow-x: auto;
            }
            .link { margin-top: 30px; }
            a { color: #4299e1; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Migration Error</h1>
            <div class="error">
              <strong>An error occurred while running migrations:</strong>
              <pre>${error.message || String(error)}</pre>
            </div>
            <div class="link">
              <a href="/">← Back to Carda</a>
            </div>
          </div>
        </body>
        </html>
      `;

      res.status(500).send(html);
    }
  });

  // ========================================
  // USER EVENTS API (Contact Capture Events)
  // ========================================

  // GET all user events
  app.get("/api/user-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getUserEvents(userId, limit);
      res.json(events);
    } catch (error) {
      console.error("[UserEvents] Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // GET active user event
  app.get("/api/user-events/active", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const activeEvent = await storage.getActiveUserEvent(userId);
      res.json(activeEvent || null);
    } catch (error) {
      console.error("[UserEvents] Error fetching active event:", error);
      res.status(500).json({ error: "Failed to fetch active event" });
    }
  });

  // POST create new user event
  app.post("/api/user-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const { title, locationLabel, latitude, longitude, tags, notes, eventLink } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      const event = await storage.createUserEvent({
        userId,
        title,
        locationLabel: locationLabel || null,
        latitude: latitude || null,
        longitude: longitude || null,
        tags: tags || null,
        notes: notes || null,
        eventLink: eventLink || null,
        isActive: 1,
        startedAt: new Date(),
      });

      res.json(event);
    } catch (error) {
      console.error("[UserEvents] Error creating event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // GET single user event
  app.get("/api/user-events/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      console.error("[UserEvents] Error fetching event:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  // PATCH update user event
  app.patch("/api/user-events/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const existingEvent = await storage.getUserEvent(eventId);
      if (!existingEvent || existingEvent.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      const { title, locationLabel, latitude, longitude, tags, notes, eventLink, isActive, endedAt } = req.body;

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (locationLabel !== undefined) updates.locationLabel = locationLabel;
      if (latitude !== undefined) updates.latitude = latitude;
      if (longitude !== undefined) updates.longitude = longitude;
      if (tags !== undefined) updates.tags = tags;
      if (notes !== undefined) updates.notes = notes;
      if (eventLink !== undefined) updates.eventLink = eventLink;
      if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
      if (endedAt !== undefined) updates.endedAt = endedAt ? new Date(endedAt) : null;

      const event = await storage.updateUserEvent(eventId, updates);
      res.json(event);
    } catch (error) {
      console.error("[UserEvents] Error updating event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // DELETE user event
  app.delete("/api/user-events/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const existingEvent = await storage.getUserEvent(eventId);
      if (!existingEvent || existingEvent.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      await storage.deleteUserEvent(eventId);
      res.json({ success: true });
    } catch (error) {
      console.error("[UserEvents] Error deleting event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // GET contacts for an event
  app.get("/api/user-events/:id/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      const contacts = await storage.getContactsForUserEvent(eventId);
      res.json(contacts);
    } catch (error) {
      console.error("[UserEvents] Error fetching event contacts:", error);
      res.status(500).json({ error: "Failed to fetch event contacts" });
    }
  });

  // POST attach contact(s) to event
  app.post("/api/user-events/:id/attach-contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      const { contactIds } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "contactIds array is required" });
      }

      const results = [];
      for (const contactId of contactIds) {
        try {
          const result = await storage.attachContactToEvent({
            eventId,
            contactId,
          });
          results.push(result);
        } catch (e) {
          console.warn(`[UserEvents] Failed to attach contact ${contactId} to event ${eventId}:`, e);
        }
      }

      res.json({ attached: results.length, results });
    } catch (error) {
      console.error("[UserEvents] Error attaching contacts:", error);
      res.status(500).json({ error: "Failed to attach contacts" });
    }
  });

  // DELETE detach contact from event
  app.delete("/api/user-events/:id/contacts/:contactId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);
      const contactId = parseInt(req.params.contactId);

      if (isNaN(eventId) || isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid event or contact ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      await storage.detachContactFromEvent(eventId, contactId);
      res.json({ success: true });
    } catch (error) {
      console.error("[UserEvents] Error detaching contact:", error);
      res.status(500).json({ error: "Failed to detach contact" });
    }
  });

  // GET photos for an event
  app.get("/api/user-events/:id/photos", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      const photos = await storage.getUserEventPhotos(eventId);
      res.json(photos);
    } catch (error) {
      console.error("[UserEvents] Error fetching photos:", error);
      res.status(500).json({ error: "Failed to fetch photos" });
    }
  });

  // POST add photo to event
  app.post("/api/user-events/:id/photos", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      const { filename, caption, mimeType, size } = req.body;
      if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
      }

      const photo = await storage.createUserEventPhoto({
        eventId,
        filename,
        caption: caption || null,
        mimeType: mimeType || null,
        size: size || null,
      });

      res.json(photo);
    } catch (error) {
      console.error("[UserEvents] Error adding photo:", error);
      res.status(500).json({ error: "Failed to add photo" });
    }
  });

  // DELETE photo from event
  app.delete("/api/user-events/:id/photos/:photoId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);
      const photoId = parseInt(req.params.photoId);

      if (isNaN(eventId) || isNaN(photoId)) {
        return res.status(400).json({ error: "Invalid event or photo ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      await storage.deleteUserEventPhoto(photoId);
      res.json({ success: true });
    } catch (error) {
      console.error("[UserEvents] Error deleting photo:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  // GET event report (HTML for printing to PDF)
  app.get("/api/user-events/:id/report", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const eventId = parseInt(req.params.id);

      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const event = await storage.getUserEvent(eventId);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }

      const contacts = await storage.getContactsForUserEvent(eventId);

      const escapeHtml = (str: string | null | undefined): string => {
        if (!str) return "";
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      };

      const formatDate = (date: Date | null | string) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      };

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.title)} - Event Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
      line-height: 1.5;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    .tags { margin-bottom: 24px; }
    .tag {
      display: inline-block;
      background: #f0f0f0;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    .notes {
      background: #f9f9f9;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      white-space: pre-wrap;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #eee;
    }
    .contacts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .contacts-table th,
    .contacts-table td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #eee;
    }
    .contacts-table th {
      background: #f9f9f9;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(event.title)}</h1>
  <div class="meta">
    <span>Date: ${formatDate(event.startedAt || event.createdAt)}</span>
    ${event.locationLabel ? `<span>Location: ${escapeHtml(event.locationLabel)}</span>` : ""}
    <span>Contacts: ${contacts.length}</span>
  </div>

  ${event.tags && event.tags.length > 0 ? `
  <div class="tags">
    ${event.tags.map((tag: string) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
  </div>
  ` : ""}

  ${event.notes ? `
  <div class="notes">${escapeHtml(event.notes)}</div>
  ` : ""}

  <h2 class="section-title">Contacts Captured (${contacts.length})</h2>
  ${contacts.length > 0 ? `
  <table class="contacts-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Title</th>
        <th>Company</th>
        <th>Email</th>
        <th>Phone</th>
      </tr>
    </thead>
    <tbody>
      ${contacts.map(c => `
      <tr>
        <td>${escapeHtml(c.fullName) || "-"}</td>
        <td>${escapeHtml(c.jobTitle) || "-"}</td>
        <td>${escapeHtml(c.companyName) || "-"}</td>
        <td>${escapeHtml(c.email) || "-"}</td>
        <td>${escapeHtml(c.phone) || "-"}</td>
      </tr>
      `).join("")}
    </tbody>
  </table>
  ` : `<p>No contacts captured at this event.</p>`}

  <div class="footer">
    Generated by Carda on ${new Date().toLocaleDateString()}
  </div>

  <script class="no-print">
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
      `;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("[UserEvents] Error generating report:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  return httpServer;
}
