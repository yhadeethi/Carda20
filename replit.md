# Carda 2.0 - Lean Contact Scanner

## Overview
Carda 2.0 is a mobile-first business card scanner with AI-powered company intelligence. Users can scan business cards or paste email signatures to extract contact information, then generate AI-powered company insights.

## Current State
- **Status**: MVP Complete (OCR requires API key)
- **Stack**: React SPA (frontend) + Express.js (backend)
- **OCR**: OCR.space API (modular, swappable)
- **Parsing**: Deterministic regex/heuristics (no AI)
- **Intel**: OpenAI via Replit AI Integrations

## Core Features
1. **Business Card OCR** - Upload/scan card images, extract text via OCR.space
2. **Contact Parsing** - Deterministic extraction of name, title, company, email, phone, website, LinkedIn
3. **Editable Results** - Review and edit extracted fields before saving
4. **vCard Export** - Download contact as .vcf file
5. **Company Intel** - AI-generated company snapshots and talking points

## Project Structure

### Frontend (`/client/src/`)
- `App.tsx` - Main app with routing and theme provider
- `pages/home-page.tsx` - Main scanner page
- `components/scan-tab.tsx` - Scan/paste modes, contact display, edit, vCard
- `components/company-intel-card.tsx` - AI-generated intel display
- `hooks/use-theme.tsx` - Dark/light theme toggle

### Backend (`/server/`)
- `index.ts` - Express server entry point
- `routes.ts` - API endpoints (all public, no auth required)
- `ocrService.ts` - Modular OCR service (OCR.space provider)
- `parseService.ts` - Deterministic contact parser
- `intelService.ts` - OpenAI-powered company intel generation

## API Endpoints (All Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | POST | Upload image for OCR + parsing |
| `/api/parse` | POST | Parse contact from pasted text |
| `/api/vcard` | POST | Generate vCard from contact data |
| `/api/intel` | POST | Generate AI company intelligence |

## Architecture

### Modular OCR (server/ocrService.ts)
```typescript
interface OCRProvider {
  name: string;
  extractText(imageBase64: string): Promise<OCRResult>;
}
```
Currently implements OCR.space. To swap providers:
1. Create new class implementing `OCRProvider`
2. Update `initializeOCR()` to use new provider

### Deterministic Parsing (server/parseService.ts)
Uses regex patterns and heuristics:
- Email: Standard email regex
- Phone: Multiple formats, output formatted consistently
- Website: URL detection excluding LinkedIn
- LinkedIn: LinkedIn profile URL detection
- Name: Identifies proper names from line structure
- Title: Matches against common job title keywords
- Company: Matches company suffixes (Inc, LLC, Corp, etc.)

## Environment Variables

### Required for OCR
- `OCR_SPACE_API_KEY` - Get free key at https://ocr.space/ocrapi

### Auto-configured (Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`

## Running the App
- `npm run dev` - Start development server (port 5000)

## Design
- Mobile-first, responsive layout
- Glassmorphism card design
- System font stack for native feel
- Dark mode support
