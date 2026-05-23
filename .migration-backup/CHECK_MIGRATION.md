# How to Check if Database Migrations are Applied

## 🎯 Two Migrations Required

You need to apply **TWO** migrations for full functionality:

1. **Migration 0001**: Timeline tables (tasks, reminders, events, preferences, merge history)
2. **Migration 0002**: Org chart fields (department, role, manager relationships)

---

## ✅ Quick Check - All Migrations (Run in Neon SQL Editor)

Copy and paste this SQL query into your Neon database SQL editor:

```sql
-- Check if timeline tables exist
SELECT 'Timeline Tables' as migration,
       CASE WHEN (
         SELECT COUNT(*)
         FROM information_schema.tables
         WHERE table_name IN ('contact_tasks', 'contact_reminders', 'timeline_events', 'event_preferences', 'merge_history')
       ) = 5 THEN '✅ COMPLETE' ELSE '❌ MISSING' END as status
UNION ALL
-- Check if org chart fields exist
SELECT 'Org Chart Fields' as migration,
       CASE WHEN (
         SELECT COUNT(*)
         FROM information_schema.columns
         WHERE table_name = 'contacts' AND column_name LIKE 'org_%'
       ) = 5 THEN '✅ COMPLETE' ELSE '❌ MISSING' END as status;
```

### Expected Result:
Both migrations should show ✅ COMPLETE:
```
migration              | status
-----------------------|---------------
Timeline Tables        | ✅ COMPLETE
Org Chart Fields       | ✅ COMPLETE
```

---

## 📋 Migration 0001: Timeline Tables

### Quick Check:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
  'contact_tasks',
  'contact_reminders',
  'timeline_events',
  'event_preferences',
  'merge_history'
)
ORDER BY table_name;
```

### Expected Result (5 tables):
```
contact_reminders
contact_tasks
event_preferences
merge_history
timeline_events
```

---

## 📋 Migration 0002: Org Chart Fields

### Quick Check:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND column_name LIKE 'org_%'
ORDER BY column_name;
```

### Expected Result (5 columns):
```
org_department
org_influence
org_relationship_strength
org_reports_to_id
org_role
```

---

## 🔍 Detailed Check (Optional)

This checks tables + new columns on contacts table:

```sql
-- Check all tables and columns
SELECT 'Table: contact_tasks' as check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'contact_tasks'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 'Table: contact_reminders',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'contact_reminders'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'Table: timeline_events',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'timeline_events'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'Table: event_preferences',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'event_preferences'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'Table: merge_history',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'merge_history'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'Column: contacts.notes',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'contacts' AND column_name = 'notes'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'Column: contacts.last_touched_at',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'contacts' AND column_name = 'last_touched_at'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END;
```

---

## 🚀 How to Access Neon SQL Editor

### Option 1: Neon Dashboard (Recommended)
1. Go to https://console.neon.tech/
2. Select your project (Carda database)
3. Click **"SQL Editor"** in the left sidebar
4. Paste the SQL query above
5. Click **"Run"** or press `Cmd+Enter` / `Ctrl+Enter`

### Option 2: Using psql Command Line
If you prefer the terminal:

```bash
# Get your DATABASE_URL from .env file
# Then run:
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('contact_tasks', 'contact_reminders', 'timeline_events', 'event_preferences', 'merge_history') ORDER BY table_name;"
```

---

## ⚠️ If Migrations are NOT Applied

If you see `❌ MISSING` for any migrations, you need to apply them:

### Steps to Apply Migrations:

**Apply in order:** Migration 0001 first, then Migration 0002

#### **Migration 0001: Timeline Tables**

1. **Open Neon SQL Editor** (see instructions above)

2. **Copy the entire migration file**:
   - File: `migrations/0001_add_timeline_tables.sql`

3. **Paste and Run**:
   - Paste the entire SQL script into the Neon SQL Editor
   - Click **"Run"**
   - Wait for all statements to execute (~1-2 seconds)

4. **Verify**:
   - Run the timeline tables check query
   - Should show 5 tables

#### **Migration 0002: Org Chart Fields**

1. **Open Neon SQL Editor**

2. **Copy the entire migration file**:
   - File: `migrations/0002_add_org_fields_to_contacts.sql`

3. **Paste and Run**:
   - Paste the entire SQL script into the Neon SQL Editor
   - Click **"Run"**
   - Wait for execution (~1 second)

4. **Verify**:
   - Run the org fields check query
   - Should show 5 columns (org_department, org_role, etc.)

---

## ✅ If All Migrations ARE Applied

If both checks show `✅ COMPLETE`, you're ready to deploy!

**Next steps:**
1. ✅ Database migrations applied
2. ✅ Server-side code deployed (already committed)
3. ✅ Client-side code deployed (already committed)
4. 🚀 Deploy to production
5. 📊 Monitor first user load for migration logs

---

## 💡 Quick Reference

### **Migration 0001: Timeline Tables**

**File:** `migrations/0001_add_timeline_tables.sql`

**Tables Created:**
- `contact_tasks` - Tasks for contacts
- `contact_reminders` - Reminders for contacts
- `timeline_events` - Activity timeline for contacts
- `event_preferences` - User preferences for calendar events
- `merge_history` - History of merged contacts

**Columns Added to `contacts`:**
- `notes` - Text notes for contacts
- `last_touched_at` - Timestamp of last interaction

### **Migration 0002: Org Chart Fields**

**File:** `migrations/0002_add_org_fields_to_contacts.sql`

**Columns Added to `contacts`:**
- `org_department` - Department (EXEC, LEGAL, SALES, etc.)
- `org_role` - Role (CHAMPION, NEUTRAL, BLOCKER)
- `org_reports_to_id` - Manager's contact ID
- `org_influence` - Influence level
- `org_relationship_strength` - Relationship strength

**What Syncs:**
- ✅ Tasks & Reminders
- ✅ Timeline Events
- ✅ Event Preferences
- ✅ Merge History
- ✅ **Org Chart Data** (NEW!)

**Documentation:**
- See `ORG_CHART_SYNC_SUMMARY.md` for full org chart sync details
- See `CLIENT_MIGRATION_SUMMARY.md` for timeline migration details
