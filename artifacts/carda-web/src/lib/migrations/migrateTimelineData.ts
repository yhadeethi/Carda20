/**
 * One-time migration script to upload existing localStorage data to server
 *
 * This should be called on app initialization after the timeline migration is deployed.
 * It will upload all existing tasks, reminders, timeline events, event preferences,
 * and merge history to the server.
 */

import { loadContactsV2 } from '../contacts/storage';
import { getAllEventPrefs, type EventPrefsMap } from '../eventsStorage';
import { loadMergeHistory } from '../contacts/storage';
import type { MergeHistoryEntry } from '../contacts/types';

const MIGRATION_FLAG = 'timeline_data_migrated_v1';
const MIGRATION_IN_PROGRESS_FLAG = 'timeline_migration_in_progress';

interface MigrationResult {
  success: boolean;
  totalItems: number;
  uploaded: number;
  errors: string[];
  skipped?: boolean;
}

/**
 * Check if migration has already been completed
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === 'true';
}

/**
 * Check if migration is currently in progress
 */
export function isMigrationInProgress(): boolean {
  return localStorage.getItem(MIGRATION_IN_PROGRESS_FLAG) === 'true';
}

/**
 * Main migration function - uploads all localStorage data to server
 */
export async function migrateExistingDataToServer(userId: number): Promise<MigrationResult> {
  // Check if already migrated
  if (isMigrationComplete()) {
    console.log('[Migration] Already completed, skipping');
    return { success: true, totalItems: 0, uploaded: 0, errors: [], skipped: true };
  }

  // Check if migration is in progress (prevent concurrent runs)
  if (isMigrationInProgress()) {
    console.log('[Migration] Already in progress, skipping');
    return { success: false, totalItems: 0, uploaded: 0, errors: ['Migration already in progress'] };
  }

  console.log('[Migration] Starting timeline data migration to server...');

  // Mark migration as in progress
  localStorage.setItem(MIGRATION_IN_PROGRESS_FLAG, 'true');

  const errors: string[] = [];
  let totalItems = 0;
  let uploaded = 0;

  try {
    // Load all local data
    const contacts = loadContactsV2();
    const eventPrefs = getAllEventPrefs();
    const mergeHistory = loadMergeHistory();

    // Count total items to migrate
    contacts.forEach(contact => {
      totalItems += (contact.tasks || []).length;
      totalItems += (contact.reminders || []).length;
      totalItems += (contact.timeline || []).filter(e => e.type !== 'scan_created').length; // Skip auto-generated scan events
      // Count org data if present
      if (contact.org) totalItems += 1;
    });
    totalItems += Object.keys(eventPrefs).length;
    totalItems += mergeHistory.length;

    console.log(`[Migration] Found ${totalItems} items to migrate from ${contacts.length} contacts`);

    // Migrate contact-related data
    for (const contact of contacts) {
      // Upload tasks
      for (const task of contact.tasks || []) {
        try {
          await fetch(`/api/contacts/${contact.id}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: task.id,
              title: task.title,
              dueAt: task.dueAt,
              done: task.done ? 1 : 0,
              completedAt: task.completedAt,
            }),
            credentials: 'include',
          });
          uploaded++;
        } catch (error) {
          const msg = `Failed to upload task "${task.title}" for contact ${contact.name}: ${error}`;
          console.error('[Migration]', msg);
          errors.push(msg);
        }
      }

      // Upload reminders
      for (const reminder of contact.reminders || []) {
        try {
          await fetch(`/api/contacts/${contact.id}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: reminder.id,
              label: reminder.label,
              remindAt: reminder.remindAt,
              done: reminder.done ? 1 : 0,
              doneAt: reminder.doneAt,
            }),
            credentials: 'include',
          });
          uploaded++;
        } catch (error) {
          const msg = `Failed to upload reminder "${reminder.label}" for contact ${contact.name}: ${error}`;
          console.error('[Migration]', msg);
          errors.push(msg);
        }
      }

      // Upload timeline events (skip scan_created as it's auto-generated)
      for (const event of contact.timeline || []) {
        if (event.type === 'scan_created') continue; // Skip auto-generated events

        try {
          await fetch(`/api/contacts/${contact.id}/timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: event.id,
              type: event.type,
              summary: event.summary,
              meta: event.meta || {},
              eventAt: event.at,
            }),
            credentials: 'include',
          });
          uploaded++;
        } catch (error) {
          const msg = `Failed to upload timeline event for contact ${contact.name}: ${error}`;
          console.error('[Migration]', msg);
          errors.push(msg);
        }
      }

      // Upload org field data if present
      if (contact.org) {
        try {
          await fetch(`/api/contacts/${contact.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orgDepartment: contact.org.department || null,
              orgRole: contact.org.role || null,
              orgReportsToId: contact.org.reportsToId ? parseInt(contact.org.reportsToId) : null,
              orgInfluence: contact.org.influence || null,
              orgRelationshipStrength: contact.org.relationshipStrength || null,
            }),
            credentials: 'include',
          });
          uploaded++;
        } catch (error) {
          const msg = `Failed to upload org data for contact ${contact.name}: ${error}`;
          console.error('[Migration]', msg);
          errors.push(msg);
        }
      }
    }

    // Upload event preferences
    for (const [eventId, prefs] of Object.entries(eventPrefs)) {
      try {
        await fetch(`/api/events/${eventId}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pinned: prefs.pinned ? 1 : 0,
            attending: prefs.attending,
            note: prefs.note || '',
            reminderSet: prefs.reminderSet ? 1 : 0,
            reminderDismissed: prefs.reminderDismissed ? 1 : 0,
          }),
          credentials: 'include',
        });
        uploaded++;
      } catch (error) {
        const msg = `Failed to upload event preference for event ${eventId}: ${error}`;
        console.error('[Migration]', msg);
        errors.push(msg);
      }
    }

    // Upload merge history
    for (const entry of mergeHistory) {
      try {
        await fetch('/api/merge-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryContactId: entry.primaryContactId,
            mergedContactSnapshots: entry.mergedContactSnapshots,
            mergedAt: entry.mergedAt,
          }),
          credentials: 'include',
        });
        uploaded++;
      } catch (error) {
        const msg = `Failed to upload merge history entry: ${error}`;
        console.error('[Migration]', msg);
        errors.push(msg);
      }
    }

    // Mark migration as complete
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.removeItem(MIGRATION_IN_PROGRESS_FLAG);

    console.log(`[Migration] Complete! Uploaded ${uploaded}/${totalItems} items (${errors.length} errors)`);

    return {
      success: errors.length === 0,
      totalItems,
      uploaded,
      errors,
    };

  } catch (error) {
    // Critical error during migration
    localStorage.removeItem(MIGRATION_IN_PROGRESS_FLAG);
    const msg = `Critical migration error: ${error}`;
    console.error('[Migration]', msg);

    return {
      success: false,
      totalItems,
      uploaded,
      errors: [msg, ...errors],
    };
  }
}

/**
 * Reset migration flag (for testing or re-running migration)
 * WARNING: Only use this if you need to re-run the migration!
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG);
  localStorage.removeItem(MIGRATION_IN_PROGRESS_FLAG);
  console.log('[Migration] Migration flags cleared');
}

/**
 * Get migration status for UI display
 */
export function getMigrationStatus(): {
  completed: boolean;
  inProgress: boolean;
} {
  return {
    completed: isMigrationComplete(),
    inProgress: isMigrationInProgress(),
  };
}
