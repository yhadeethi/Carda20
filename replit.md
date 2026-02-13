# Carda 2.0 - Lean Contact Scanner

## Overview
Carda 2.0 is a mobile-first business card scanner that extracts contact information using AI, generates AI-powered company insights, and helps manage professional networks. It aims to streamline contact management, facilitate smart follow-ups, and provide organizational intelligence for B2B sales and networking.

## User Preferences
I prefer iterative development, so please break down tasks into smaller, manageable steps. Focus on high-level feature implementation and architectural decisions. I value clear, concise explanations and prefer that you ask for clarification if anything is unclear before proceeding with major changes. Ensure all changes are mobile-first and responsive.

## System Architecture

### UI/UX Decisions
-   **Mobile-first, Responsive Design**: Optimized for mobile experience with graceful degradation for larger screens.
-   **Glassmorphism**: Utilizes glassmorphism for card designs and the bottom navigation bar.
-   **Bottom Navigation**: Apple-style liquid glass bottom nav bar with smooth Framer Motion transitions and scroll-driven morph effects.
-   **System Font Stack**: Employs system fonts for a native look and feel.
-   **Dark Mode Support**: Provides a consistent experience across different lighting conditions.
-   **Company Detail Page**: Features a three-tab interface (People, Org, Notes).
-   **Org Map v3**: Hierarchy-first approach with a collapsible tree structure as the default view and an optional React Flow canvas diagram with drag-and-drop functionality for reporting lines.

### Technical Implementations
-   **Frontend**: React SPA using TypeScript.
-   **Backend**: Express.js server using TypeScript.
-   **Authentication**: Replit Auth (OpenID Connect) supporting Google, GitHub, Apple, X, and email/password login. Sessions stored in PostgreSQL with 7-day TTL.
-   **Contact Storage**: PostgreSQL database with user-specific contacts (authenticated) or `localStorage` (fallback for legacy features). User contacts are isolated per account.
-   **Client-Side Image Compression**: Resizes images and progressively compresses them to optimize for OCR services, staying under 1MB.
-   **Modular OCR**: Designed with a `OCRProvider` interface to allow easy swapping of OCR services (currently OCR.space).
-   **AI-Powered Parsing (gpt-4o-mini)**: Primary parsing mechanism with a robust prompt for business card and email signature extraction, providing structured JSON output. It includes logo detection, OCR noise handling, and validation.
-   **Deterministic Parsing**: Fallback mechanism using regex and heuristics for robust extraction of contact details, including AU-aware address extraction, email domain-derived company names, and sophisticated email signature parsing.
-   **Company Intel Generation (gpt-4o)**: Uses OpenAI via Replit AI Integrations to create detailed sales briefs, including company snapshots, relevance to sales, role insights, high-impact questions, key developments, **funding data** (stage, total raised, investors), **technology stack** (by category with key insights), and **competitive landscape** (direct/indirect competitors, market position), with a 24-hour caching mechanism.
-   **Org Intelligence v3**: Auto-generates companies from contact data, enables organizational mapping with departments, roles, and manager assignments, and provides an interactive Org Map.
-   **Smart Follow-Up**: AI-powered generation of personalized follow-up messages (email, LinkedIn) with tone and length selection, integrated with task and reminder management.
-   **Contact Timeline**: Comprehensive history of interactions with each contact, supporting various event types and filtering.
-   **ContactDetailView (iOS-style)**: Dedicated contact detail page with digital business card hero, sticky bottom bar with quick actions, timeline feed, and inline editing. Uses a callback pattern where `onContactUpdated(contactId)` fires only after confirmed persistence to localStorage.
-   **Duplicate Detection & Merge**: Fuzzy matching and scoring for contact deduplication, with a side-by-side merge UI and undo support.
-   **Calendar Integration**: Generates ICS files for meeting invites with customizable dates, times, and durations.
-   **Batch Scanning (Event Mode)**: Multi-photo capture mode that queues business cards for background processing. Users can snap multiple cards quickly, then process all at once with a review/approve workflow before saving.
-   **HubSpot CRM Integration**: Per-user OAuth connection with token auto-refresh. Accessible from the profile dropdown menu. Supports bulk contact export, event export (as HubSpot Notes), and selective timeline export. OAuth tokens stored in `hubspot_tokens` table. Required scopes: `oauth crm.objects.contacts.read crm.objects.contacts.write crm.objects.notes.write`.

### Feature Specifications
-   **Business Card OCR**: Upload/scan images to extract text.
-   **Contact Parsing**: Extracts name, title, company, email, phone, website, LinkedIn, and address.
-   **Editable Results**: Allows users to review and modify extracted fields.
-   **vCard Export**: Exports contacts as .vcf files.
-   **My QR**: Generates personal QR codes for quick contact sharing.
-   **Events (Capture Sessions)**: User-created networking events (e.g., "Tech Meetup Sydney 2026") that serve as containers for contact capture. Users start an event, then scan cards or add contacts manually within that event context. Events have active/ended states, tags, notes, GPS-detected location, and optional event links. Contacts are attached to events, organizing them by the occasion where they were met.
-   **Events Hub (Legacy)**: A curated directory of industry events across renewable energy, mining, and construction sectors with user preferences (pin, attendance, notes). Uses static/curated data from `eventsData.ts` with localStorage-based preferences.
-   **Org Intelligence**: Manages company and organizational data, including department filtering and auto-grouping based on job titles.
-   **Smart Follow-Up**: Creates personalized messages and manages tasks/reminders.
-   **Contact Timeline**: Logs all interactions and events for a contact.
-   **Duplicate Management**: Detects and helps merge duplicate contacts.
-   **Calendar Integration**: Facilitates meeting scheduling and ICS export.
-   **Batch Scanning**: In Event Mode, enables multi-photo capture with thumbnail previews, background OCR processing, and batch review/approve workflow for rapid networking events.
-   **HubSpot Export**: Users connect HubSpot from profile menu, then export contacts (bulk), events (as Notes attached to contacts), and selected timeline entries (as Notes) to their HubSpot CRM.

### Events Data Model (UserEvent)
-   Stored in PostgreSQL (`user_events` table), scoped per authenticated user.
-   Fields: `id`, `userId`, `title`, `tags` (text array), `notes`, `eventLink`, `locationLabel`, `latitude`, `longitude`, `isActive` (1=active, 0=ended), `startedAt`, `endedAt`, `createdAt`.
-   Contacts are associated to events via `eventId` foreign key or a join table (`user_event_contacts`).
-   API endpoints: `GET /api/user-events`, `GET /api/user-events/active`, `GET /api/user-events/:id`, `POST /api/user-events`, `PATCH /api/user-events/:id`, `GET /api/user-events/:id/contacts`, `POST /api/user-events/:id/attach-contacts`, `GET /api/user-events/:id/report`.

## External Dependencies
-   **OCR.space API**: For Optical Character Recognition.
-   **OpenAI API (via Replit AI Integrations)**: Used for AI-powered parsing (gpt-4o-mini) and company intelligence generation (gpt-4o).
-   **Framer Motion**: For UI animations, particularly in navigation and organizational hierarchy.
-   **React Flow**: For rendering interactive organizational diagram.
-   **Dagre**: For auto-layout of organizational charts.
-   **HubSpot API**: For CRM integration — OAuth, contacts, notes, and associations. Uses `@hubspot/api-client` SDK.