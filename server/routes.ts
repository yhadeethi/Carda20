import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { extractTextFromImage, initializeOCR } from "./ocrService";
import { parseContact, normalizeForDuplicateCheck, ParsedContact } from "./parseService";
import { getOrCreateCompanyIntel, IntelContext } from "./intelService";
import { updateProfileSchema, User } from "@shared/schema";

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

  lines.push("END:VCARD");
  
  return lines.join("\r\n");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  initializeOCR();
  setupAuth(app);

  app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { password: _, ...profile } = user;
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).send("Failed to fetch profile");
    }
  });

  app.post("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = updateProfileSchema.parse(req.body);
      
      const updated = await storage.updateUser(user.id, validatedData);
      if (!updated) {
        return res.status(404).send("User not found");
      }
      
      const { password: _, ...profile } = updated;
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).send("Failed to update profile");
    }
  });

  app.post("/api/scan", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
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

  app.post("/api/parse", requireAuth, async (req: Request, res: Response) => {
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

  app.post("/api/check_duplicate", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { email, companyName } = req.body;

      if (!email && !companyName) {
        return res.json({ isDuplicate: false });
      }

      const normalizedEmail = normalizeForDuplicateCheck(email);
      const normalizedCompany = normalizeForDuplicateCheck(companyName);

      const existingContact = await storage.findDuplicateContact(
        user.id,
        normalizedEmail,
        normalizedCompany
      );

      res.json({
        isDuplicate: !!existingContact,
        existingContactId: existingContact?.id,
      });
    } catch (error) {
      console.error("Error checking duplicate:", error);
      res.status(500).send("Failed to check duplicate");
    }
  });

  app.post("/api/vcard", requireAuth, async (req: Request, res: Response) => {
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

  app.post("/api/intel", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { companyName, email, website } = req.body;

      if (!companyName && !email && !website) {
        return res.status(400).send("Company name, email, or website is required");
      }

      const companyDomain = email || website;

      const userContext: IntelContext = {
        userIndustry: user.industry || undefined,
        userCountry: user.country || undefined,
        userCity: user.city || undefined,
        userFocusTopics: user.focusTopics || undefined,
      };

      const intel = await getOrCreateCompanyIntel(
        companyName,
        companyDomain,
        userContext
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

  app.post("/api/save_contact", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const contact: ParsedContact = req.body;

      const savedContact = await storage.createContact({
        userId: user.id,
        fullName: contact.fullName || null,
        jobTitle: contact.jobTitle || null,
        companyName: contact.companyName || null,
        email: contact.email || null,
        phone: contact.phone || null,
        website: contact.website || null,
        linkedinUrl: contact.linkedinUrl || null,
        companyDomain: contact.email?.split("@")[1] || null,
      });

      res.status(201).json(savedContact);
    } catch (error) {
      console.error("Error saving contact:", error);
      res.status(500).send("Failed to save contact");
    }
  });

  return httpServer;
}
