import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { extractTextFromImage, initializeOCR } from "./ocrService";
import { parseContact, ParsedContact, splitAuAddress } from "./parseService";
import { getOrCreateCompanyIntel } from "./intelService";
import { generateIntelV2 } from "./intelV2Service";
// CompanyIntelV2 and HeadcountRange removed - Apollo boost disabled
import { parseContactWithAI, convertAIResultToContact } from "./aiParseService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import OpenAI from "openai";

async function getCurrentUserId(req: Request): Promise<number> {
  const authId = (req.user as any)?.claims?.sub;
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

// Contact org schema for API
const contactOrgInputSchema = z.object({
  department: z.enum(['EXEC', 'LEGAL', 'PROJECT_DELIVERY', 'SALES', 'FINANCE', 'OPS', 'UNKNOWN']).optional(),
  reportsToId: z.string().nullable().optional(),
  role: z.enum(['CHAMPION', 'NEUTRAL', 'BLOCKER', 'UNKNOWN']).optional(),
  influence: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']).optional(),
  relationshipStrength: z.enum(['CLOSE', 'NORMAL', 'CASUAL', 'UNKNOWN']).optional(),
});

// Task schema
const contactTaskInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
  dueAt: z.string().optional(),
  completedAt: z.string().optional(),
});

// Reminder schema
const contactReminderInputSchema = z.object({
  id: z.string(),
  label: z.string(),
  remindAt: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
  doneAt: z.string().optional(),
});

// Timeline event schema
const contactTimelineEventInputSchema = z.object({
  id: z.string(),
  type: z.string(),
  at: z.string(),
  summary: z.string(),
  meta: z.record(z.unknown()).optional(),
});

// Merge meta schema
const contactMergeMetaInputSchema = z.object({
  mergedFromIds: z.array(z.string()).optional(),
  mergedAt: z.string().optional(),
});

const contactInputSchema = z.object({
  fullName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  eventName: z.string().nullable().optional(),
  rawText: z.string().nullable().optional(),
  companyDomain: z.string().nullable().optional(),
  dbCompanyId: z.number().nullable().optional(),
  localCompanyId: z.string().nullable().optional(),
  org: contactOrgInputSchema.nullable().optional(),
  tasks: z.array(contactTaskInputSchema).optional(),
  reminders: z.array(contactReminderInputSchema).optional(),
  timeline: z.array(contactTimelineEventInputSchema).optional(),
  notes: z.string().nullable().optional(),
  mergeMeta: contactMergeMetaInputSchema.nullable().optional(),
  lastTouchedAt: z.string().nullable().optional(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
      // Convert string dates to Date objects for storage
      const updateData: Record<string, unknown> = { ...parsed.data };
      if (typeof updateData.lastTouchedAt === 'string') {
        updateData.lastTouchedAt = new Date(updateData.lastTouchedAt);
      }
      
      // Merge timeline events instead of replacing - append new events to existing
      if (updateData.timeline !== undefined && Array.isArray(updateData.timeline)) {
        const existingTimeline = (existing.timeline as unknown[]) || [];
        const newTimeline = updateData.timeline as unknown[];
        // Get existing event IDs to avoid duplicates
        const existingIds = new Set(existingTimeline.map((e: any) => e.id));
        const eventsToAdd = newTimeline.filter((e: any) => !existingIds.has(e.id));
        updateData.timeline = [...existingTimeline, ...eventsToAdd];
      }
      
      const contact = await storage.updateContact(contactId, updateData);
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

  app.post("/api/scan", upload.single("image"), async (req: Request, res: Response) => {
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

  app.post("/api/intel", async (req: Request, res: Response) => {
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
  app.get("/api/hubspot/connect", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getCurrentUserId(req);
      const state = crypto.randomUUID();
      (req.session as any).hubspot_oauth_state = state;
      (req.session as any).hubspot_oauth_user = userId;

      const redirectUri = getHubSpotRedirectUri(req);
      const url = buildHubSpotAuthUrl({ redirectUri, state });
      res.redirect(url);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to start HubSpot OAuth" });
    }
  });

  app.get("/api/hubspot/callback", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const expectedState = (req.session as any).hubspot_oauth_state as string | undefined;
      const userId = (req.session as any).hubspot_oauth_user as number | undefined;

      if (!code || !state || !expectedState || state !== expectedState || !userId) {
        return res.status(400).send("Invalid HubSpot OAuth callback.");
      }

      const redirectUri = getHubSpotRedirectUri(req);
      await connectHubSpotForUser({ userId, code, redirectUri });

      // cleanup
      (req.session as any).hubspot_oauth_state = undefined;
      (req.session as any).hubspot_oauth_user = undefined;

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

  app.post("/api/parse-ai", async (req: Request, res: Response) => {
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

  app.post("/api/scan-ai", upload.single("image"), async (req: Request, res: Response) => {
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

  app.post("/api/followup", async (req: Request, res: Response) => {
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

  return httpServer;
}
