#!/usr/bin/env node
/**
 * Script to apply database migrations
 * Uses the existing DATABASE_URL from environment
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set!');
  console.error('This should be set in Replit Secrets or your .env file');
  process.exit(1);
}

console.log('🔍 Checking database connection...\n');

const pool = new Pool({ connectionString: DATABASE_URL });

async function checkMigrationStatus() {
  try {
    // Check if timeline tables exist
    const timelineCheck = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM information_schema.tables
      WHERE table_name IN ('contact_tasks', 'contact_reminders', 'timeline_events', 'event_preferences', 'merge_history')
    `);

    const timelineTables = timelineCheck.rows[0].count;

    // Check if org fields exist
    const orgCheck = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM information_schema.columns
      WHERE table_name = 'contacts' AND column_name LIKE 'org_%'
    `);

    const orgFields = orgCheck.rows[0].count;

    console.log('📊 Current Migration Status:\n');
    console.log(`Timeline Tables (5 expected): ${timelineTables === 5 ? '✅' : '❌'} ${timelineTables}/5`);
    console.log(`Org Chart Fields (5 expected): ${orgFields === 5 ? '✅' : '❌'} ${orgFields}/5\n`);

    return { timelineTables, orgFields };
  } catch (error) {
    console.error('❌ Error checking migration status:', error.message);
    throw error;
  }
}

async function applyMigration(name, filePath) {
  try {
    console.log(`📝 Applying ${name}...`);
    const sql = readFileSync(filePath, 'utf8');

    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        await pool.query(statement);
      }
    }

    console.log(`✅ ${name} applied successfully!\n`);
  } catch (error) {
    // If error is "already exists", that's okay
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`⚠️  ${name} partially applied (some items already exist - this is okay)\n`);
    } else {
      console.error(`❌ Error applying ${name}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  try {
    console.log('🚀 Database Migration Tool\n');
    console.log('='.repeat(50) + '\n');

    // Check current status
    const { timelineTables, orgFields } = await checkMigrationStatus();

    // Apply Migration 0001 if needed
    if (timelineTables < 5) {
      console.log('🔧 Migration 0001 needed - applying timeline tables...\n');
      await applyMigration(
        'Migration 0001 (Timeline Tables)',
        join(__dirname, 'migrations', '0001_add_timeline_tables.sql')
      );
    } else {
      console.log('✅ Migration 0001 already applied (Timeline Tables)\n');
    }

    // Apply Migration 0002 if needed
    if (orgFields < 5) {
      console.log('🔧 Migration 0002 needed - applying org chart fields...\n');
      await applyMigration(
        'Migration 0002 (Org Chart Fields)',
        join(__dirname, 'migrations', '0002_add_org_fields_to_contacts.sql')
      );
    } else {
      console.log('✅ Migration 0002 already applied (Org Chart Fields)\n');
    }

    // Final verification
    console.log('='.repeat(50) + '\n');
    console.log('🔍 Final Verification:\n');
    const finalStatus = await checkMigrationStatus();

    if (finalStatus.timelineTables === 5 && finalStatus.orgFields === 5) {
      console.log('🎉 SUCCESS! All migrations applied successfully!');
      console.log('\n✨ Your database is ready! Timeline and org chart data will now sync to PostgreSQL.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some migrations may not have applied completely.');
      console.log('Please check the errors above or try running migrations manually via Neon console.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nYou may need to apply migrations manually via Neon SQL Editor.');
    console.error('See CHECK_MIGRATION.md for instructions.\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
