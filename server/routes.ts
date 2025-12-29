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
import { isHubSpotConnected, syncContactToHubSpot } from "./hubspotService";

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

  app.get("/api/hubspot/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const connected = await isHubSpotConnected();
      res.json({ connected });
    } catch (error) {
      console.error("Error checking HubSpot status:", error);
      res.json({ connected: false });
    }
  });

  app.post("/api/hubspot/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { email, firstname, lastname, phone, company, jobtitle, website, city, address } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required" });
      }

      const result = await syncContactToHubSpot({
        email,
        firstname,
        lastname,
        phone,
        company,
        jobtitle,
        website,
        city,
        address,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error syncing to HubSpot:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to sync with HubSpot" });
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

  return httpServer;
}
