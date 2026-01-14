# Carda Timeline Data Migration to Neon PostgreSQL

## 📋 Overview

This document outlines the migration of timeline data (tasks, reminders, timeline events, event preferences, and merge history) from browser localStorage to Neon PostgreSQL database for cross-device sync and data persistence.

---

## ✅ COMPLETED WORK

### 1. Database Schema (shared/schema.ts)

**New Tables Added:**
- `contacts` - Added `notes` and `lastTouchedAt` columns
- `contact_tasks` - Tasks per contact with due dates
- `contact_reminders` - Reminders with scheduling
- `timeline_events` - Activity timeline (scan created, notes added, etc.)
- `event_preferences` - User preferences for calendar events
- `merge_history` - Contact merge operations for undo

**Key Features:**
- Foreign key constraints with CASCADE delete for data integrity
- Indexes on frequently queried columns for performance
- `clientId` field for offline sync and idempotency
- Integer boolean fields (0/1) for PostgreSQL compatibility

### 2. Database Migration (migrations/0001_add_timeline_tables.sql)

**Migration File Created:**
- SQL file ready to apply to production database
- Adds all new tables with proper constraints
- Creates all necessary indexes
- Safe to run (uses IF NOT EXISTS)

**To Apply Migration:**
```bash
# Option 1: Using psql
psql $DATABASE_URL < migrations/0001_add_timeline_tables.sql

# Option 2: Using Drizzle Kit (if DATABASE_URL is set)
npx drizzle-kit push

# Option 3: Manual execution via Neon dashboard
# Copy SQL from migration file and run in SQL editor
```

### 3. Server Storage Layer (server/storage.ts)

**New Methods Implemented:**

**Tasks:**
- `getContactTasks(contactId)` - Get all tasks for a contact
- `getContactTaskByClientId(clientId)` - Find task by client ID
- `createContactTask(task)` - Create new task
- `updateContactTask(id, updates)` - Update task
- `deleteContactTask(id)` - Delete task

**Reminders:**
- `getContactReminders(contactId)` - Get all reminders for a contact
- `getContactReminderByClientId(clientId)` - Find reminder by client ID
- `getUpcomingReminders(userId, limit)` - Get upcoming reminders across all contacts
- `createContactReminder(reminder)` - Create new reminder
- `updateContactReminder(id, updates)` - Update reminder
- `deleteContactReminder(id)` - Delete reminder

**Timeline Events:**
- `getTimelineEvents(contactId)` - Get all timeline events for a contact
- `getTimelineEventByClientId(clientId)` - Find event by client ID
- `createTimelineEvent(event)` - Create new timeline event
- `deleteTimelineEvent(id)` - Delete timeline event

**Event Preferences:**
- `getEventPreferences(userId, eventId)` - Get preferences for specific event
- `getAllEventPreferences(userId)` - Get all event preferences for user
- `upsertEventPreference(preference)` - Create or update event preference

**Merge History:**
- `getMergeHistory(userId, limit)` - Get merge history for user
- `createMergeHistory(history)` - Create new merge history entry
- `deleteMergeHistory(id)` - Delete merge history entry

### 4. API Endpoints (server/routes.ts)

**Tasks Endpoints:**
- `GET /api/contacts/:contactId/tasks` - List tasks
- `POST /api/contacts/:contactId/tasks` - Create task (idempotent via clientId)
- `PUT /api/contacts/:contactId/tasks/:taskId` - Update task
- `DELETE /api/contacts/:contactId/tasks/:taskId` - Delete task

**Reminders Endpoints:**
- `GET /api/contacts/:contactId/reminders` - List reminders
- `POST /api/contacts/:contactId/reminders` - Create reminder (idempotent)
- `PUT /api/contacts/:contactId/reminders/:reminderId` - Update reminder
- `DELETE /api/contacts/:contactId/reminders/:reminderId` - Delete reminder

**Timeline Endpoints:**
- `GET /api/contacts/:contactId/timeline` - List timeline events
- `POST /api/contacts/:contactId/timeline` - Create event (idempotent)

**Event Preferences Endpoints:**
- `GET /api/events/:eventId/preferences` - Get event preferences
- `GET /api/events/preferences` - Get all user event preferences
- `POST /api/events/:eventId/preferences` - Upsert event preferences

**Merge History Endpoints:**
- `GET /api/merge-history?limit=10` - Get merge history
- `POST /api/merge-history` - Create merge history entry

**All endpoints:**
- ✅ Require authentication (`isAuthenticated` middleware)
- ✅ Include error handling
- ✅ Support idempotency via `clientId`
- ✅ Validate input data

---

## 🚧 REMAINING WORK

### Phase 1: Client-Side Storage Updates (REQUIRED)

You need to update `client/src/lib/contacts/storage.ts` to use the new API endpoints instead of localStorage.

**Current State:**
- All timeline data stored in localStorage only
- Functions like `addTask()`, `addReminder()`, `addTimelineEvent()` write to localStorage

**Required Changes:**
1. Add API client functions to call the new endpoints
2. Update existing functions to call API first, then cache in localStorage
3. Implement offline queue for when network is unavailable
4. Add sync mechanism to upload queued changes when back online

**Example Implementation Pattern:**
```typescript
// Before (localStorage only)
export function addTask(contactId: string, title: string, dueAt?: string): ContactTask | null {
  const contact = getContactById(contactId);
  if (!contact) return null;

  const task: ContactTask = {
    id: generateId(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
    dueAt,
  };

  const tasks = [...(contact.tasks || []), task];
  updateContactV2(contactId, { tasks });
  return task;
}

// After (API + localStorage cache)
export async function addTask(contactId: string, title: string, dueAt?: string): Promise<ContactTask | null> {
  const clientId = generateId();

  // Create task in localStorage immediately (optimistic update)
  const task: ContactTask = {
    id: clientId,
    title,
    done: false,
    createdAt: new Date().toISOString(),
    dueAt,
  };

  const contact = getContactById(contactId);
  if (!contact) return null;

  const tasks = [...(contact.tasks || []), task];
  updateContactV2(contactId, { tasks });

  // Sync to server
  try {
    const response = await fetch(`/api/contacts/${contactId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, title, dueAt }),
    });

    if (response.ok) {
      const serverTask = await response.json();
      // Update localStorage with server ID
      const updatedTasks = tasks.map(t =>
        t.id === clientId ? { ...t, id: serverTask.id } : t
      );
      updateContactV2(contactId, { tasks: updatedTasks });
      return serverTask;
    } else {
      // Queue for retry if offline
      queueForSync('task', { contactId, clientId, title, dueAt });
    }
  } catch (error) {
    console.error('Failed to sync task:', error);
    queueForSync('task', { contactId, clientId, title, dueAt });
  }

  return task;
}
```

### Phase 2: Data Migration Script (REQUIRED)

Create a migration script to upload existing localStorage data to the server.

**Location:** `client/src/lib/migrations/migrateTimelineData.ts`

**What It Should Do:**
1. Check if migration has already run (flag in localStorage)
2. Read all contacts from localStorage V2
3. For each contact:
   - Upload tasks to `/api/contacts/:id/tasks`
   - Upload reminders to `/api/contacts/:id/reminders`
   - Upload timeline events to `/api/contacts/:id/timeline`
4. Upload merge history to `/api/merge-history`
5. Upload event preferences to `/api/events/:id/preferences`
6. Set migration flag to prevent re-running

**When to Run:**
- On first app load after deployment
- Check for `timeline_migration_completed` flag in localStorage
- Show progress indicator to user during migration

**Example Structure:**
```typescript
export async function migrateTimelineDataToServer(): Promise<{ success: boolean; errors: string[] }> {
  // Check if already migrated
  if (localStorage.getItem('timeline_migration_completed')) {
    return { success: true, errors: [] };
  }

  const errors: string[] = [];

  try {
    // 1. Migrate tasks
    const contacts = loadContactsV2();
    for (const contact of contacts) {
      for (const task of contact.tasks || []) {
        try {
          await fetch(`/api/contacts/${contact.id}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: task.id,
              title: task.title,
              done: task.done,
              dueAt: task.dueAt,
              completedAt: task.completedAt,
            }),
          });
        } catch (err) {
          errors.push(`Failed to migrate task: ${task.title}`);
        }
      }

      // Similar for reminders, timeline events...
    }

    // 2. Migrate event preferences
    // 3. Migrate merge history

    // Mark as completed
    localStorage.setItem('timeline_migration_completed', 'true');
    return { success: true, errors };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, errors: [...errors, error.message] };
  }
}
```

### Phase 3: Testing Checklist

**Before Deploying:**
- [ ] Run database migration on staging/dev database
- [ ] Test all API endpoints with Postman/Thunder Client
- [ ] Verify authentication works on all endpoints
- [ ] Test clientId idempotency (creating same item twice)
- [ ] Test error handling (invalid IDs, missing fields)

**After Client Updates:**
- [ ] Test task CRUD operations
- [ ] Test reminder CRUD operations
- [ ] Test timeline event creation
- [ ] Test event preferences save/load
- [ ] Test merge history save/load
- [ ] Test offline queue functionality
- [ ] Test migration script with sample data
- [ ] Test cross-device sync (login on two devices)

**User Acceptance:**
- [ ] Existing contacts still load correctly
- [ ] Scanning new business cards works
- [ ] Org Map functionality preserved
- [ ] No data loss during migration
- [ ] Timeline data persists after logout/login
- [ ] Timeline data syncs across devices

---

## 📊 Cost Impact

**Current Database Size (10K users):** ~7.5 GB

**After Migration:**
- Tasks: +65 MB
- Reminders: +50 MB
- Timeline events: +450 MB
- Event preferences: +10 MB
- Merge history: +25 MB

**New Total:** ~8.1 GB (still within $19/month Launch plan)

---

## 🔄 Deployment Strategy

### Option A: Gradual Rollout (RECOMMENDED)

1. **Deploy backend changes** (schema, API endpoints)
2. **Run migration** on production database
3. **Deploy client changes** with feature flag
4. **Enable for 10% of users**, monitor for issues
5. **Gradually increase** to 50%, then 100%
6. **Monitor** error logs and user feedback

### Option B: Big Bang (FASTER but RISKIER)

1. Deploy all changes at once
2. Run migration during low-traffic period
3. Monitor closely for 24-48 hours
4. Be ready to rollback if critical issues

---

## 🚨 Rollback Plan

If issues occur, you can rollback safely:

**Database Rollback:**
```sql
-- Remove new tables (data will be lost!)
DROP TABLE IF EXISTS contact_tasks CASCADE;
DROP TABLE IF EXISTS contact_reminders CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS event_preferences CASCADE;
DROP TABLE IF EXISTS merge_history CASCADE;

-- Remove new columns from contacts
ALTER TABLE contacts DROP COLUMN IF EXISTS notes;
ALTER TABLE contacts DROP COLUMN IF EXISTS last_touched_at;
```

**Client Rollback:**
- Revert to previous version
- localStorage data will still be there
- Users won't lose data if you act quickly

---

## 🎯 Next Steps

1. **Review this migration plan** - Make sure you understand all changes
2. **Test on staging** - Apply migration to test database first
3. **Update client code** - Implement Phase 1 (client-side storage updates)
4. **Create migration script** - Implement Phase 2 (data migration)
5. **Test thoroughly** - Run through all test scenarios
6. **Deploy to production** - Use gradual rollout strategy
7. **Monitor** - Watch for errors and user feedback

---

## 📞 Support

If you encounter issues during migration:

1. Check server logs for API errors
2. Check browser console for client errors
3. Verify database migration completed successfully
4. Ensure environment variables are set correctly
5. Test API endpoints manually with curl/Postman

---

## 📝 Files Modified

- `shared/schema.ts` - Added new tables and types
- `server/storage.ts` - Added storage methods
- `server/routes.ts` - Added API endpoints
- `migrations/0001_add_timeline_tables.sql` - Database migration

**Files to Create:**
- `client/src/lib/migrations/migrateTimelineData.ts` - Migration script
- `client/src/lib/api/timeline.ts` - API client functions (optional but recommended)

---

## ✨ Benefits After Migration

✅ **Cross-device sync** - Timeline data available on all devices
✅ **No data loss** - Data persists even if browser cache is cleared
✅ **Backup** - All data backed up in Neon PostgreSQL
✅ **Scalability** - Ready for thousands of users
✅ **Cost-effective** - Still fits in free/Launch tier
✅ **Professional** - Production-ready architecture

---

**Migration Status:** Backend Complete ✅ | Client Updates Pending ⏳ | Migration Script Pending ⏳
