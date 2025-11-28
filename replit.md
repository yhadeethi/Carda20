# Carda 2.0 - Contact Scanner & AI Intel Assistant

## Overview
Carda 2.0 is a mobile-first contact scanner and AI-powered company intelligence assistant. Users can scan business cards or paste email signatures to extract contact information, then receive AI-generated company insights including snapshots, recent news, and personalized talking points.

## Current State
- **Status**: MVP Complete
- **Stack**: React SPA (frontend) + Express.js (backend) + PostgreSQL (database)
- **AI**: OpenAI via Replit AI Integrations (no API key required)

## Project Structure

### Frontend (`/client/src/`)
- `App.tsx` - Main app with routing and providers
- `pages/`
  - `auth-page.tsx` - Login/register with two-column layout
  - `home-page.tsx` - Main app with bottom tab navigation
  - `public-profile-page.tsx` - Public profile view for QR code links
- `components/`
  - `scan-tab.tsx` - Scan Card & Paste Text modes with contact extraction
  - `my-card-tab.tsx` - Profile editing & QR code sharing
  - `contact-result-card.tsx` - Displays parsed/saved contact info
  - `company-intel-card.tsx` - AI-generated company intel display
  - `recent-contacts-list.tsx` - List of recent contacts with details
- `hooks/`
  - `use-auth.tsx` - Authentication context and mutations
  - `use-theme.tsx` - Dark/light theme toggle
- `lib/`
  - `protected-route.tsx` - Route protection for authenticated pages
  - `queryClient.ts` - React Query configuration

### Backend (`/server/`)
- `index.ts` - Express server entry point
- `routes.ts` - All API endpoints
- `auth.ts` - Passport.js authentication setup
- `storage.ts` - Database storage layer (Drizzle ORM)
- `db.ts` - PostgreSQL connection
- `intelService.ts` - OpenAI-powered contact parsing & company intel

### Shared (`/shared/`)
- `schema.ts` - Drizzle schemas, Zod validation, TypeScript types

## Key Features

### Authentication
- Email/password registration and login
- Session-based auth with PostgreSQL session store
- Auto-generated public profile slug on registration

### Scan Tab
- **Scan Card Mode**: Upload business card photo → OCR parsing via OpenAI Vision
- **Paste Text Mode**: Paste email signature → AI text parsing
- Contact preview with save functionality
- Automatic company intel generation after save

### My Card Tab
- Profile editing (name, company, title, contact info, industry, focus topics)
- QR code generation for public profile URL
- vCard export for user's own card
- Public profile link copy/share

### Company Intel
- AI-generated company snapshots (industry, size, HQ, key products)
- Recent news with summaries
- Personalized talking points based on user's industry, location, and focus topics
- 24-hour intel caching per company

### Public Profiles
- `/u/:slug` - Public profile page accessible without login
- vCard download for contact saving

## API Endpoints

### Auth
- `POST /api/register` - Register new user
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/user` - Get current user

### Profile
- `GET /api/profile` - Get user profile (auth required)
- `POST /api/profile` - Update profile (auth required)
- `GET /api/profile/vcard` - Download user's vCard

### Public Profile
- `GET /api/public_profile/:slug` - Get public profile
- `GET /api/public_profile/:slug/vcard` - Download public vCard

### Contacts
- `POST /api/scan_contact` - OCR scan business card image
- `POST /api/extract_contact_from_text` - Parse contact from text
- `POST /api/contacts` - Save contact
- `GET /api/contacts/recent` - Get recent contacts (last 10)
- `GET /api/contacts/:id` - Get contact details
- `GET /api/contacts/:id/vcard` - Download contact vCard

### Intel
- `POST /api/company_intel` - Generate/fetch company intel
- `GET /api/contacts/:id/intel` - Get intel for contact's company

## Database Schema

### Tables
- `users` - User accounts and profile data
- `contacts` - Saved contacts linked to users
- `companies` - Company records for intel caching
- `company_intel` - Cached AI-generated intel (JSON)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (auto-configured)

## Design System
- Apple HIG inspired with glassmorphism
- Mobile-first, responsive layout
- Bottom tab navigation (iOS style)
- System font stack for native feel
- Dark mode support

## Running the App
- `npm run dev` - Start development server (port 5000)
- `npm run db:push` - Push schema changes to database
