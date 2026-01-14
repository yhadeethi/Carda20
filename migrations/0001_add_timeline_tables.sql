-- Migration: Add timeline, tasks, reminders, events, and merge history tables
-- Created: 2026-01-14

-- Add notes and lastTouchedAt columns to contacts table
ALTER TABLE "contacts" ADD COLUMN "notes" text;
ALTER TABLE "contacts" ADD COLUMN "last_touched_at" timestamp;

-- Create contact_tasks table
CREATE TABLE IF NOT EXISTS "contact_tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contact_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"title" text NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

-- Create contact_reminders table
CREATE TABLE IF NOT EXISTS "contact_reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contact_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"label" text NOT NULL,
	"remind_at" timestamp NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

-- Create timeline_events table
CREATE TABLE IF NOT EXISTS "timeline_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timeline_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contact_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"summary" text NOT NULL,
	"meta" jsonb,
	"event_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Create event_preferences table
CREATE TABLE IF NOT EXISTS "event_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"event_id" text NOT NULL,
	"pinned" integer DEFAULT 0 NOT NULL,
	"attending" varchar(10),
	"note" text,
	"reminder_set" integer DEFAULT 0 NOT NULL,
	"reminder_dismissed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create merge_history table
CREATE TABLE IF NOT EXISTS "merge_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "merge_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"primary_contact_id" text NOT NULL,
	"merged_contact_snapshots" jsonb NOT NULL,
	"merged_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "contact_tasks" ADD CONSTRAINT "contact_tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contact_tasks" ADD CONSTRAINT "contact_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "contact_reminders" ADD CONSTRAINT "contact_reminders_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contact_reminders" ADD CONSTRAINT "contact_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "event_preferences" ADD CONSTRAINT "event_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "merge_history" ADD CONSTRAINT "merge_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "contact_tasks_contact_idx" ON "contact_tasks" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "contact_tasks_user_idx" ON "contact_tasks" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "contact_tasks_client_id_idx" ON "contact_tasks" USING btree ("client_id");

CREATE INDEX IF NOT EXISTS "contact_reminders_contact_idx" ON "contact_reminders" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "contact_reminders_user_idx" ON "contact_reminders" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "contact_reminders_client_id_idx" ON "contact_reminders" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "contact_reminders_remind_at_idx" ON "contact_reminders" USING btree ("remind_at");

CREATE INDEX IF NOT EXISTS "timeline_events_contact_idx" ON "timeline_events" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "timeline_events_user_idx" ON "timeline_events" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "timeline_events_client_id_idx" ON "timeline_events" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "timeline_events_event_at_idx" ON "timeline_events" USING btree ("event_at");

CREATE INDEX IF NOT EXISTS "event_preferences_user_idx" ON "event_preferences" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "event_preferences_event_idx" ON "event_preferences" USING btree ("event_id");

CREATE INDEX IF NOT EXISTS "merge_history_user_idx" ON "merge_history" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "merge_history_merged_at_idx" ON "merge_history" USING btree ("merged_at");
