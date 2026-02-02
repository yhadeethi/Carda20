-- Migration 0003: User Events
-- Create tables for user-created events and event-contact associations

-- user_events: Stores user-created events (from scan mode, manual creation, or calendar import)
CREATE TABLE IF NOT EXISTS "user_events" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "title" text NOT NULL,
  "start_at" timestamp DEFAULT now() NOT NULL,
  "end_at" timestamp,
  "location_label" text,
  "lat" double precision,
  "lng" double precision,
  "tags" jsonb DEFAULT '[]',
  "notes" text,
  "source" varchar(50) DEFAULT 'manual' NOT NULL, -- 'manual', 'calendar_import', 'scan_draft'
  "is_draft" integer DEFAULT 0 NOT NULL, -- 0 = false, 1 = true (for scan event mode drafts)
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- user_event_contacts: Links contacts to events
CREATE TABLE IF NOT EXISTS "user_event_contacts" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "event_id" integer NOT NULL,
  "contact_id_v1" text, -- LocalStorage contact ID (v1 format)
  "contact_id_v2" integer, -- Database contact ID (v2 format)
  "created_at" timestamp DEFAULT now()
);

-- Foreign keys for user_events
DO $$ BEGIN
  ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Foreign keys for user_event_contacts
DO $$ BEGIN
  ALTER TABLE "user_event_contacts" ADD CONSTRAINT "user_event_contacts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_event_contacts" ADD CONSTRAINT "user_event_contacts_event_id_user_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "user_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for user_events
CREATE INDEX IF NOT EXISTS "user_events_user_idx" ON "user_events" ("user_id");
CREATE INDEX IF NOT EXISTS "user_events_start_at_idx" ON "user_events" ("start_at");
CREATE INDEX IF NOT EXISTS "user_events_is_draft_idx" ON "user_events" ("is_draft");

-- Indexes for user_event_contacts
CREATE INDEX IF NOT EXISTS "user_event_contacts_user_idx" ON "user_event_contacts" ("user_id");
CREATE INDEX IF NOT EXISTS "user_event_contacts_event_idx" ON "user_event_contacts" ("event_id");
CREATE INDEX IF NOT EXISTS "user_event_contacts_contact_v1_idx" ON "user_event_contacts" ("contact_id_v1");
CREATE INDEX IF NOT EXISTS "user_event_contacts_contact_v2_idx" ON "user_event_contacts" ("contact_id_v2");
