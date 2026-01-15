# How to Check if Database Migration is Applied

## ✅ Quick Check (Run in Neon SQL Editor)

Copy and paste this SQL query into your Neon database SQL editor:

```sql
-- Check if all 5 new tables exist
SELECT
  table_name,
  CASE WHEN table_name IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  VALUES
    ('contact_tasks'),
    ('contact_reminders'),
    ('timeline_events'),
    ('event_preferences'),
    ('merge_history')
) AS expected_tables(table_name)
ORDER BY table_name;
```

### Expected Result:
If migration is applied, you should see:
```
table_name            | status
----------------------|------------
contact_reminders     | ✅ EXISTS
contact_tasks         | ✅ EXISTS
event_preferences     | ✅ EXISTS
merge_history         | ✅ EXISTS
timeline_events       | ✅ EXISTS
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

## ⚠️ If Migration is NOT Applied

If you see `❌ MISSING` for any tables, you need to apply the migration:

### Steps to Apply Migration:

1. **Open Neon SQL Editor** (see instructions above)

2. **Copy the entire migration file**:
   - The migration is in: `migrations/0001_add_timeline_tables.sql`

3. **Paste and Run**:
   - Paste the entire SQL script into the Neon SQL Editor
   - Click **"Run"**
   - Wait for all statements to execute (should take 1-2 seconds)

4. **Verify**:
   - Run the quick check query again
   - All tables should now show `✅ EXISTS`

---

## ✅ If Migration IS Applied

If all checks show `✅ EXISTS`, you're ready to deploy!

**Next steps:**
1. ✅ Database migration applied
2. ✅ Server-side code deployed (already committed)
3. ✅ Client-side code deployed (already committed)
4. 🚀 Deploy to production
5. 📊 Monitor first user load for migration logs

---

## 💡 Quick Reference

**Migration File Location:** `migrations/0001_add_timeline_tables.sql`

**Tables Created:**
- `contact_tasks` - Tasks for contacts
- `contact_reminders` - Reminders for contacts
- `timeline_events` - Activity timeline for contacts
- `event_preferences` - User preferences for calendar events
- `merge_history` - History of merged contacts

**Columns Added to `contacts`:**
- `notes` - Text notes for contacts
- `last_touched_at` - Timestamp of last interaction
