# Carda - Contact Scanner & AI Intel Assistant

## Overview

Carda is a mobile-first web application that transforms business cards and email signatures into actionable contact intelligence. Users can scan physical cards, paste text, and receive AI-powered company insights and sales briefs. The app also provides personal QR code generation, contact management with organizational mapping, and industry event tracking.

**Core capabilities:**
- Business card OCR scanning with AI-powered parsing (GPT-4o-mini)
- Email signature text parsing
- Company intelligence generation with verified sources
- Contact storage with organizational hierarchy tracking
- Personal digital business card with QR code sharing
- Industry events hub (Renewables, Mining, Construction)
- HubSpot CRM integration

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight React router)
- **State Management:** TanStack Query for server state, React useState/useContext for local state
- **Styling:** TailwindCSS with shadcn/ui components (Radix UI primitives)
- **Animations:** Framer Motion for transitions and micro-interactions
- **Build Tool:** Vite

**UI Design Pattern:** Mobile-first, iOS-inspired "liquid glass" aesthetic with floating bottom navigation, backdrop blur effects, and smooth transitions. The app uses a three-tab bottom navigation (Scan, Contacts, Events) with morphing animations on scroll.

**Component Organization:**
- `/client/src/components/` - Reusable UI components
- `/client/src/components/contact/` - Contact-specific components (ContactHeroCard, ContactDetailView)
- `/client/src/components/ui/` - shadcn/ui base components
- `/client/src/pages/` - Page-level components
- `/client/src/hooks/` - Custom React hooks
- `/client/src/lib/` - Utilities, storage helpers, type definitions

### Backend Architecture
- **Runtime:** Node.js with Express
- **Language:** TypeScript
- **API Pattern:** RESTful endpoints under `/api/`

**Key Services:**
- `aiParseService.ts` - GPT-4o-mini powered business card text parsing
- `ocrService.ts` - OCR.space integration for image-to-text
- `intelService.ts` - Company intelligence generation (legacy)
- `intelV2Service.ts` - Enhanced company intel with verified sources, stock data, headcount
- `salesSignalsService.ts` - Sales-focused signal generation
- `hubspotService.ts` - HubSpot CRM sync via Replit connector
- `parseService.ts` - Deterministic text parsing (fallback/utilities)

**AI Integration Strategy:** The system uses AI as the primary parsing path (`/api/scan-ai`, `/api/parse-ai`) with legacy regex-based parsing as fallback. OpenAI calls go through Replit's AI Integrations service.

### Data Storage
- **Database:** PostgreSQL via Neon serverless with Drizzle ORM
- **Session Store:** PostgreSQL-backed sessions (connect-pg-simple) with memorystore fallback
- **Client Storage:** localStorage for contacts, events preferences, and recent accounts
- **Schema Location:** `/shared/schema.ts` using Drizzle schema definitions

**Contact Data Model:** Contacts include standard fields (name, email, phone, company) plus organizational metadata (department, reportsToId, role, influence level). Companies are derived from contacts and support org chart visualization.

### Authentication
- Passport.js with Local Strategy (email/password)
- Scrypt password hashing with timing-safe comparison
- Express sessions with 30-day cookie expiration
- Public profile URLs with generated slugs

### Build & Deployment
- Custom build script (`script/build.ts`) using esbuild for server bundling and Vite for client
- Server dependencies are bundled to reduce cold start times
- Health check endpoint at `/healthz` for container orchestration
- Static file serving for production builds

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations) - GPT-4o-mini for business card parsing and company intel generation. Access through `process.env.AI_INTEGRATIONS_OPENAI_BASE_URL`

### OCR Service
- **OCR.space** - Image-to-text extraction for business card scanning. Free tier has 1MB file size limit; client-side image compression is implemented

### CRM Integration
- **HubSpot** - Contact sync via Replit connector with OAuth. Uses `@hubspot/api-client` for API calls

### Database
- **Neon PostgreSQL** - Serverless Postgres with WebSocket connections. Connection string in `DATABASE_URL`

### External Data (Company Intel)
- Google Favicon API for company logos (`https://www.google.com/s2/favicons`)
- Stock data and company information fetched dynamically for Intel v2 feature

### Client Libraries
- `@xyflow/react` (React Flow) - Org chart visualization with dagre layout
- `react-icons` - Icon library (includes LinkedIn icon)
- `date-fns` - Date formatting utilities