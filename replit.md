# Carda 2.0 - Lean Contact Scanner

## Overview
Carda 2.0 is a mobile-first business card scanner with AI-powered company intelligence. Users can scan business cards or paste email signatures to extract contact information, then generate AI-powered company insights.

## Current State
- **Status**: MVP Complete with image compression and improved parsing
- **Stack**: React SPA (frontend) + Express.js (backend)
- **OCR**: OCR.space API (modular, swappable)
- **Parsing**: Deterministic regex/heuristics (no AI)
- **Intel**: OpenAI via Replit AI Integrations

## Core Features
1. **Business Card OCR** - Upload/scan card images, extract text via OCR.space
   - Client-side image compression to stay under 1MB limit
   - Automatic resize to max 1400px on longest side
   - Progressive JPEG quality reduction
2. **Contact Parsing** - Deterministic extraction of name, title, company, email, phone, website, LinkedIn, address
   - Smart email signature parsing with disclaimer detection
   - Labeled field detection (m:, e:, w: prefixes)
   - Company suffix detection (Pty Ltd, Inc, LLC, etc.)
3. **Editable Results** - Review and edit extracted fields before saving
4. **vCard Export** - Download contact as .vcf file
5. **Company Intel** - AI-generated company snapshots and talking points

## Project Structure

### Frontend (`/client/src/`)
- `App.tsx` - Main app with routing and theme provider
- `pages/home-page.tsx` - Main scanner page
- `components/scan-tab.tsx` - Scan/paste modes, contact display, edit, vCard
- `components/company-intel-card.tsx` - AI-generated intel display
- `lib/imageUtils.ts` - Client-side image compression utility
- `hooks/use-theme.tsx` - Dark/light theme toggle

### Backend (`/server/`)
- `index.ts` - Express server entry point
- `routes.ts` - API endpoints (all public, no auth required)
- `ocrService.ts` - Modular OCR service (OCR.space provider)
- `parseService.ts` - Deterministic contact parser with email signature support
- `intelService.ts` - OpenAI-powered company intel generation

## API Endpoints (All Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | POST | Upload image for OCR + parsing |
| `/api/parse` | POST | Parse contact from pasted text |
| `/api/vcard` | POST | Generate vCard from contact data |
| `/api/intel` | POST | Generate AI company intelligence |

## Architecture

### Client-Side Image Compression (client/src/lib/imageUtils.ts)
- Resizes images to max 1400px on longest side
- Progressive JPEG compression from 85% quality down to 40%
- Ensures images stay under OCR.space 1MB limit
- User-friendly error messages for oversized images

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
- **Pre-cleaning**: Removes disclaimer text and empty lines
- **Email**: Standard email regex
- **Phone**: Labeled fields (m:, tel:) and pattern matching, international format support
- **Website**: URL detection excluding LinkedIn, labeled fields (w:)
- **LinkedIn**: LinkedIn profile URL detection
- **Name**: First non-contact line, proper name pattern matching
- **Title**: Job title keyword matching
- **Company**: Company suffix detection (Pty Ltd, Inc, LLC, GmbH, etc.)
- **Address**: Lines between company and contact fields

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
