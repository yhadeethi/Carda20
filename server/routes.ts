import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractTextFromImage, initializeOCR } from "./ocrService";
import { parseContact, ParsedContact, splitAuAddress } from "./parseService";
import { getOrCreateCompanyIntel } from "./intelService";
import { parseContactWithAI, convertAIResultToContact } from "./aiParseService";

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

  // Add address using vCard ADR field format
  // ADR;TYPE=WORK:;;street;city;state;postcode;country
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
        {}, // userContext
        { contactName, contactTitle } // contactContext for role-specific insights
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
