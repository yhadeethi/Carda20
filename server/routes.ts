import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { 
  getOrCreateCompanyIntel, 
  parseContactFromText, 
  parseContactFromImage,
  IntelContext 
} from "./intelService";
import { 
  updateProfileSchema, 
  insertContactSchema,
  User, 
  Contact,
  PublicProfile 
} from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function generateVCard(contact: {
  fullName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
}): string {
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

  app.get("/api/profile/vcard", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const vcard = generateVCard({
        fullName: user.fullName,
        companyName: user.companyName,
        jobTitle: user.jobTitle,
        email: user.email,
        phone: user.phone,
        website: user.website,
        linkedinUrl: user.linkedinUrl,
      });

      const filename = `${user.fullName?.replace(/[^a-z0-9]/gi, "_") || "contact"}.vcf`;
      res.setHeader("Content-Type", "text/vcard");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(vcard);
    } catch (error) {
      console.error("Error generating vCard:", error);
      res.status(500).send("Failed to generate vCard");
    }
  });

  app.get("/api/public_profile/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const user = await storage.getUserByPublicSlug(slug);
      
      if (!user) {
        return res.status(404).send("Profile not found");
      }

      const publicProfile: PublicProfile = {
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        companyName: user.companyName,
        email: user.email,
        phone: user.phone,
        website: user.website,
        linkedinUrl: user.linkedinUrl,
        country: user.country,
        city: user.city,
      };

      res.json(publicProfile);
    } catch (error) {
      console.error("Error fetching public profile:", error);
      res.status(500).send("Failed to fetch profile");
    }
  });

  app.get("/api/public_profile/:slug/vcard", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const user = await storage.getUserByPublicSlug(slug);
      
      if (!user) {
        return res.status(404).send("Profile not found");
      }

      const vcard = generateVCard({
        fullName: user.fullName,
        companyName: user.companyName,
        jobTitle: user.jobTitle,
        email: user.email,
        phone: user.phone,
        website: user.website,
        linkedinUrl: user.linkedinUrl,
      });

      const filename = `${user.fullName?.replace(/[^a-z0-9]/gi, "_") || "contact"}.vcf`;
      res.setHeader("Content-Type", "text/vcard");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(vcard);
    } catch (error) {
      console.error("Error generating public vCard:", error);
      res.status(500).send("Failed to generate vCard");
    }
  });

  app.post("/api/scan_contact", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).send("No image file provided");
      }

      const base64 = file.buffer.toString("base64");
      const parsed = await parseContactFromImage(base64);
      
      res.json(parsed);
    } catch (error) {
      console.error("Error scanning contact:", error);
      res.status(500).send("Failed to scan contact");
    }
  });

  app.post("/api/extract_contact_from_text", requireAuth, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).send("Text is required");
      }

      const parsed = await parseContactFromText(text);
      res.json(parsed);
    } catch (error) {
      console.error("Error extracting contact:", error);
      res.status(500).send("Failed to extract contact");
    }
  });

  app.post("/api/contacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      
      const contactData = {
        ...req.body,
        userId: user.id,
      };

      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).send("Failed to create contact");
    }
  });

  app.get("/api/contacts/recent", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const contacts = await storage.getContactsByUserId(user.id, 10);
      
      const recentContacts = contacts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        companyName: c.companyName,
        createdAt: c.createdAt,
      }));

      res.json(recentContacts);
    } catch (error) {
      console.error("Error fetching recent contacts:", error);
      res.status(500).send("Failed to fetch contacts");
    }
  });

  app.get("/api/contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const contactId = parseInt(req.params.id);
      
      if (isNaN(contactId)) {
        return res.status(400).send("Invalid contact ID");
      }

      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).send("Contact not found");
      }

      if (contact.userId !== user.id) {
        return res.status(403).send("Access denied");
      }

      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).send("Failed to fetch contact");
    }
  });

  app.get("/api/contacts/:id/vcard", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const contactId = parseInt(req.params.id);
      
      if (isNaN(contactId)) {
        return res.status(400).send("Invalid contact ID");
      }

      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).send("Contact not found");
      }

      if (contact.userId !== user.id) {
        return res.status(403).send("Access denied");
      }

      const vcard = generateVCard({
        fullName: contact.fullName,
        companyName: contact.companyName,
        jobTitle: contact.jobTitle,
        email: contact.email,
        phone: contact.phone,
        website: contact.website,
        linkedinUrl: contact.linkedinUrl,
      });

      const filename = `${contact.fullName?.replace(/[^a-z0-9]/gi, "_") || "contact"}.vcf`;
      res.setHeader("Content-Type", "text/vcard");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(vcard);
    } catch (error) {
      console.error("Error generating contact vCard:", error);
      res.status(500).send("Failed to generate vCard");
    }
  });

  app.post("/api/company_intel", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { contactId } = req.body;

      if (!contactId) {
        return res.status(400).send("Contact ID is required");
      }

      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).send("Contact not found");
      }

      if (contact.userId !== user.id) {
        return res.status(403).send("Access denied");
      }

      const userContext: IntelContext = {
        userIndustry: user.industry || undefined,
        userCountry: user.country || undefined,
        userCity: user.city || undefined,
        userFocusTopics: user.focusTopics || undefined,
      };

      const intel = await getOrCreateCompanyIntel(
        contact.companyName,
        contact.companyDomain || contact.email,
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

  app.get("/api/contacts/:id/intel", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const contactId = parseInt(req.params.id);
      
      if (isNaN(contactId)) {
        return res.status(400).send("Invalid contact ID");
      }

      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).send("Contact not found");
      }

      if (contact.userId !== user.id) {
        return res.status(403).send("Access denied");
      }

      const userContext: IntelContext = {
        userIndustry: user.industry || undefined,
        userCountry: user.country || undefined,
        userCity: user.city || undefined,
        userFocusTopics: user.focusTopics || undefined,
      };

      const intel = await getOrCreateCompanyIntel(
        contact.companyName,
        contact.companyDomain || contact.email,
        userContext
      );

      if (!intel) {
        return res.status(500).send("Failed to generate intel");
      }

      res.json(intel);
    } catch (error) {
      console.error("Error getting contact intel:", error);
      res.status(500).send("Failed to get intel");
    }
  });

  return httpServer;
}
