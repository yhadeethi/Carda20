# Carda 2.0

A contact intelligence app for scanning, organizing, and enriching business contacts — with CRM sync (HubSpot & Salesforce), AI-powered intel, and event management.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/carda-web run dev` — run the frontend (PORT + BASE_PATH required, use workflows)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, use `--force` flag non-interactively)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `REPL_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v3 + wouter + Framer Motion
- API: Express 5 + Replit Auth (OIDC)
- DB: PostgreSQL + Drizzle ORM
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/carda-web/` — React frontend (Tailwind v3, glassmorphism theme)
- `artifacts/api-server/src/` — Express backend
  - `routes/routes.ts` — all API routes (registerRoutes pattern)
  - `storage.ts` — database access layer
  - `replitAuth.ts` — Replit OIDC auth + sessions
  - `hubspotService.ts`, `salesforceService.ts` — CRM integrations
  - `intelService.ts`, `intelV2Service.ts` — AI company intel
  - `ocrService.ts`, `aiParseService.ts` — card scanning/parsing
- `lib/db/src/schema/schema.ts` — DB schema (source of truth)

## Architecture decisions

- Backend uses `registerRoutes(httpServer, app)` pattern (not Router refactor) — kept for auth/session middleware complexity
- Frontend uses existing custom `queryClient.ts` fetch layer (not OpenAPI-generated hooks) — too large to rewrite safely for a port
- `lib/db` re-exports pool/db; `artifacts/api-server/src/db.ts` re-exports from `@workspace/db`
- Tailwind v3 (not v4) — preserved from original, uses postcss.config.js
- `SiLinkedin` from react-icons/si replaced with `FaLinkedin` from react-icons/fa (v5 naming change)

## Product

Business card scanner and contact intelligence app. Users scan cards (camera/OCR), add/edit contacts, get AI company intel, manage event attendance, sync to HubSpot/Salesforce, and share profiles via QR code.

## Gotchas

- `pnpm --filter @workspace/db run push` requires `--force` flag when running non-interactively (it prompts for destructive column removals)
- zod/v4 subpath must be used in server code — zod is in api-server dependencies
- `drizzle-zod`'s `createInsertSchema` already omits `generatedAlwaysAsIdentity` columns — do not call `.omit({ id: true })` on the result in zod v4
- Replit Auth redirects unauthenticated users; preview pane shows replit.com login (expected)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
