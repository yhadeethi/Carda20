-- Migration: Add org chart fields to contacts table
-- Created: 2026-01-15
-- This enables cross-device sync for org map data (department, role, manager relationships)

-- Add org chart columns to contacts table
ALTER TABLE "contacts" ADD COLUMN "org_department" varchar(50);
ALTER TABLE "contacts" ADD COLUMN "org_role" varchar(50);
ALTER TABLE "contacts" ADD COLUMN "org_reports_to_id" integer;
ALTER TABLE "contacts" ADD COLUMN "org_influence" varchar(50);
ALTER TABLE "contacts" ADD COLUMN "org_relationship_strength" varchar(50);

-- Add index for reports_to queries (to find direct reports efficiently)
CREATE INDEX IF NOT EXISTS "contacts_org_reports_to_idx" ON "contacts" USING btree ("org_reports_to_id");

-- Add index for department queries
CREATE INDEX IF NOT EXISTS "contacts_org_department_idx" ON "contacts" USING btree ("org_department");

-- Note: We don't add a foreign key constraint for org_reports_to_id referencing contacts.id
-- because it would create a self-referencing constraint that complicates deletion.
-- The application layer will handle referential integrity for manager relationships.
