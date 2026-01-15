/**
 * Hook to setup timeline data sync and migration
 * Should be called once when the authenticated user loads the app
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { setupAutoSync } from '../lib/syncQueue';
import {
  migrateExistingDataToServer,
  isMigrationComplete,
  type MigrationResult
} from '../lib/migrations/migrateTimelineData';

export function useTimelineSetup() {
  const { user, isAuthenticated } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const hasSetup = useRef(false);

  useEffect(() => {
    // Only run once when user is authenticated
    if (!isAuthenticated || !user || hasSetup.current) {
      return;
    }

    hasSetup.current = true;

    console.log('[TimelineSetup] Initializing timeline sync and migration...');

    // 1. Setup automatic sync queue processing
    setupAutoSync();

    // 2. Run migration if needed
    if (!isMigrationComplete()) {
      setMigrationStatus('running');
      console.log('[TimelineSetup] Starting data migration...');

      migrateExistingDataToServer(user.id)
        .then((result) => {
          setMigrationResult(result);

          if (result.skipped) {
            setMigrationStatus('complete');
            console.log('[TimelineSetup] Migration was already complete');
          } else if (result.success) {
            setMigrationStatus('complete');
            console.log('[TimelineSetup] Migration completed successfully:', result);
          } else {
            setMigrationStatus('error');
            console.error('[TimelineSetup] Migration completed with errors:', result.errors);
          }
        })
        .catch((error) => {
          setMigrationStatus('error');
          console.error('[TimelineSetup] Migration failed:', error);
          setMigrationResult({
            success: false,
            totalItems: 0,
            uploaded: 0,
            errors: [error.message || 'Unknown error'],
          });
        });
    } else {
      setMigrationStatus('complete');
      console.log('[TimelineSetup] Migration already complete, skipping');
    }

  }, [isAuthenticated, user]);

  return {
    migrationStatus,
    migrationResult,
    isMigrating: migrationStatus === 'running',
    migrationComplete: migrationStatus === 'complete',
    migrationError: migrationStatus === 'error',
  };
}
