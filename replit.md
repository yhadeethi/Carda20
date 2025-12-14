# Carda 2.0 - Lean Contact Scanner

## Overview
Carda 2.0 is a mobile-first business card scanner with AI-powered company intelligence. Users can scan business cards or paste email signatures to extract contact information, then generate AI-powered company insights.

## Current State
- **Status**: MVP Complete with AU address extraction, email truncation, My QR feature, AI-first parsing, and Org Intelligence
- **Stack**: React SPA (frontend) + Express.js (backend)
- **OCR**: OCR.space API (modular, swappable)
- **Parsing**: AI-powered (gpt-4o-mini) as default, deterministic fallback for resilience
- **Intel**: OpenAI via Replit AI Integrations
- **Storage**: localStorage for contacts, companies, and event preferences

## Core Features
1. **Business Card OCR** - Upload/scan card images, extract text via OCR.space
   - Client-side image compression to stay under 1MB limit
   - Automatic resize to max 1400px on longest side
   - Progressive JPEG quality reduction
2. **Contact Parsing** - Deterministic extraction of name, title, company, email, phone, website, LinkedIn, address
   - Smart email signature parsing with disclaimer detection
   - **Salutation detection**: Skips common email sign-offs (Regards, Best regards, Cheers, etc.) to prevent name extraction errors
   - Labeled field detection (m:, e:, w:, m. prefixes)
   - Company suffix detection (Pty Ltd, Inc, LLC, etc.)
   - **AU-aware address extraction**: Case-insensitive state detection (Vic, VIC, vic all work), street line joining, defaults country to "Australia"
   - **Domain-derived company names**: When no explicit company found, derives from email domain (flowpower.com.au → "Flow Power")
   - **Company/address separation**: Detects and fixes when company name incorrectly contains address text, using space-insensitive email domain matching
   - **Job title protection**: Prevents job title lines from being selected as company name
3. **Editable Results** - Review and edit extracted fields before saving
4. **vCard Export** - Download contact as .vcf file
5. **Company Intel** - AI-generated company snapshots and talking points
6. **My QR** - Personal QR code feature for quick contact sharing
   - Profile saved to localStorage (persists between sessions)
   - vCard 3.0 format QR code generation
   - Accessible from header QR button
7. **Bottom Navigation** - Apple-style liquid glass bottom nav bar
   - Three tabs: Scan, Contacts, Events
   - Smooth horizontal slide transitions using Framer Motion
   - Glassmorphism styling with backdrop-blur-2xl
   - Active tab highlighting with bold labels
   - **Scroll-driven morph**: Subtle visual-only animation (NO vertical movement)
     - Fixed to iOS safe-area at bottom with `pb-[env(safe-area-inset-bottom)]`
     - Expanded (at top / scroll up): shadow-xl, scale-100
     - Compact (scroll down >50px): shadow-lg, scale-[0.96]
     - Main content has pb-[calc(96px+env(safe-area-inset-bottom))] to ensure nothing hidden behind nav
   - `useScrollDirectionNav` hook for scroll detection
8. **Events Hub** - Industry event discovery and tracking
   - Three industries: Renewable Energy, Mining, Construction
   - **Tab labels**: Full names on desktop, shortened on mobile ("Renewables", "Mining", "Construction")
   - Event tiers: Major (flagship events) and Standard
   - Event sources: Curated (verified), AI-suggested (mocked), Other
   - **Source disclaimers**: "Verified from official website" or "AI-suggested — please verify details on the official site."
   - User controls per event: Pin/Unpin, Attendance (Going/Maybe/Not going), Notes
   - **Attendance button**: Shows "Attendance" by default, "Attendance: Going/Maybe/Not going" when set
   - Events sorted by start date within each group (pinned first, then unpinned)
   - Pinned events appear at top of list with visual indicator
   - 12 seed events across all three industries
   - Preferences persisted in localStorage (key: `carda_event_prefs_v1`)
   - Architecture ready for future AI + cron-based pipeline
9. **Org Intelligence v2** - Company tracking and organizational mapping
   - **Contacts Hub redesign**: People/Companies segmented control (tabs)
   - **Companies auto-generation**: Companies created from contact data (company name or email domain)
   - **Company Detail page**: Three-tab interface (People, Org, Notes)
   - **Quick Edit Bottom Sheet**: Drawer to edit Department, Role, Influence, Manager for any contact
   - **Department Filter Chips**: Horizontal scroll filter by department (Exec, Legal, Project Delivery, Sales, Finance, Ops)
   - **Auto-group Button**: Automatically assigns departments based on job titles with undo support
   - **Org Map**: Segmented control for Org Chart vs Influence Map views
     - **Org Chart (React Flow)**: Interactive canvas with dagre auto-layout
       - Custom contact nodes with name, title, department pill
       - Department color-coded node styling
       - Pinch-zoom, pan, and fit-to-view controls
       - Edit mode with drag-drop to set reporting lines
       - Cycle detection prevents circular reporting structures
       - Icon buttons: Pencil (edit), Sparkles (relayout), Trash (clear all)
       - Bottom sheet on node tap for quick metadata editing
     - **Influence Map**: Force-directed graph using react-force-graph-2d
       - Node size = influence level (HIGH=20, MEDIUM=12, LOW=6)
       - Node color = role (Champion=green, Neutral=gray, Blocker=red, Unknown=zinc)
       - Links from reporting relationships
       - Legend with all role colors
       - Click node to view contact details
   - **Contact org metadata**: department, role, influence, reportsToId, relationshipStrength fields
   - **View in Org Map button**: Quick navigation from contact detail to company org map
   - Companies persisted in localStorage (key: `carda_companies_v1`)
   - Data relationships: contacts link to companies via matching name or domain

## Project Structure

### Frontend (`/client/src/`)
- `App.tsx` - Main app with routing and theme provider
- `pages/home-page.tsx` - Main scanner page with tab navigation and view management
- `components/scan-tab.tsx` - Scan/paste modes, contact display, edit, vCard, View in Org Map
- `components/contacts-hub.tsx` - People/Companies split view with search and filtering
- `components/company-detail.tsx` - Company detail page with People/Org/Notes tabs
- `components/org-map.tsx` - Org Map with Org/Influence segmented control, icon buttons, bottom sheet
- `components/org-chart-canvas.tsx` - React Flow canvas with dagre layout, custom nodes, drag-drop
- `components/company-intel-card.tsx` - AI-generated intel display
- `lib/contactsStorage.ts` - Contact CRUD with localStorage persistence
- `lib/companiesStorage.ts` - Company CRUD with auto-generation from contacts
- `lib/imageUtils.ts` - Client-side image compression utility
- `hooks/use-theme.tsx` - Dark/light theme toggle

### Backend (`/server/`)
- `index.ts` - Express server entry point
- `routes.ts` - API endpoints (all public, no auth required)
- `ocrService.ts` - Modular OCR service (OCR.space provider)
- `parseService.ts` - Deterministic contact parser with email signature support
- `aiParseService.ts` - AI-powered contact parser using GPT-4o
- `intelService.ts` - OpenAI-powered company intel generation

## API Endpoints (All Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | POST | Upload image for OCR + deterministic parsing |
| `/api/scan-ai` | POST | Upload image for OCR + AI-powered parsing |
| `/api/parse` | POST | Parse contact from pasted text (deterministic) |
| `/api/parse-ai` | POST | Parse contact from pasted text (AI-powered) |
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
- **Website**: 
  - Validates against 100+ known TLDs plus 2-6 char fallback
  - Accepts labeled fields (w:, web:, website:)
  - Rejects name-like patterns (e.g., "francisco.guerrero")
  - Falls back to email domain when no website found
- **LinkedIn**: LinkedIn profile URL detection (/in/ and /company/)
- **Name**: First non-contact line, proper name pattern matching
- **Title**: Job title keyword matching
- **Company**: Company suffix detection (Pty Ltd, Inc, LLC, GmbH, etc.)
- **Address**: Lines between company and contact fields

### AI-Powered Parsing (server/aiParseService.ts)
Uses GPT-4o-mini (temperature 0) for fast, intelligent contact extraction:
- **Default parsing path**: All scans and pastes use AI first, with deterministic fallback
- **Expert business card parser prompt**: Trained to distinguish logos from names, handle OCR noise
- **Structured JSON output**: name, company, title, email, phone, mobile, fax, address, website
- **Logo detection**: Ignores common brand logos (EVE, CATL, BYD, etc.) when extracting names
- **OCR noise handling**: Reconstructs broken addresses, fixes obvious mistakes
- **Website validation**: Rejects websites without dots (prevents "www.Name.Surname" errors)
- **Never hallucinates**: Only extracts what's clearly visible on the card
- **LinkedIn search**: Frontend generates search URL from name + company (no AI lookup needed)

### Email Signature Parsing Features
- **preCleanText**: Strips salutations at start and disclaimer text at end
- **deriveCompanyFromDomain**: Extracts clean company names from email domains (flowpower.com.au → "Flow Power")
- **deriveWebsite**: Extracts website from email domain only (never local-part), checks for explicit URL lines first
- **fixCompanyIfAddress**: Uses space-insensitive domain matching, skips job title lines, requires suffix for validation
- **isSameAsName**: Detects when company matches contact's name (uses Unicode normalization for accented names)
- **extractGenericAddress**: Handles international addresses (French CEDEX, European postcodes, etc.)
- **Phone detection**: Handles multiple formats including "m:", "m.", "m-", "mobile:" patterns
- **Name extraction**: Supports ALL CAPS surnames (LADOUX) and accented names (Clément, José, François)

### Company Intel - Focused Sales Brief (server/intelService.ts)
- Uses OpenAI (gpt-4o) via Replit AI Integrations
- Caches intel for 24 hours per company domain
- **New Sales Brief Structure:**
  - `companySnapshot`: 2-3 sentence overview of what the company does
  - `whyTheyMatterToYou`: Reasons this company is relevant for B2B sales
  - `roleInsights`: What the contact's title typically cares about (KPIs, problems)
  - `highImpactQuestions`: Sharp questions for first meetings
  - `keyDevelopments`: Historical events (not live news) with approxDate and note
  - `risksOrSensitivities`: Potential landmines (only shown if non-empty)
- **Google News Button**: Opens Google News search for the company
- Fallback behavior when API fails:
  - Generates generic talking points
  - Shows warning banner in UI
  - Detailed error logging for debugging

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
