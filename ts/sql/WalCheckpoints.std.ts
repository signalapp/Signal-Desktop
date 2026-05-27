// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../types/Logging.std.ts';
import type { ReadableDB, WritableDB } from './Interface.std.ts';
import * as Errors from '../types/errors.std.ts';
import { sql } from './util.std.ts';

/**
 * The default automatic checkpointing behavior of sqlite only checkpoints every 1000 pages
 * and on database close. Which means that changes can sit in the log for potentially a long time.
 *
 * To make sure that the WAL is flushed soon after every commit, we call `sqlite3_wal_hook()`
 * (which replaces the automatic checkpointing behavior) with our own callback.
 *
 * We will still run a checkpoint every 1000 pages using TRUNCATE instead of PASSIVE.
 *
 * But we will also run a checkpoint after every commit, throttled to every 30 seconds.
 *
 * We also setup TEMP trigger's AFTER DELETE on every table, which reschedules
 * the next checkpoint to every 5 seconds.
 */
export namespace WalCheckpoints {
  const PAGE_THRESHOLD = 1000;
  const THROTTLE_MS_AFTER_COMMIT = 30_000; // 30s
  const THROTTLE_MS_AFTER_DELETE = 5_000; // 5s

  let onCheckpointNeeded: ((reason: string) => void) | null = null;

  let lastRunAt = 0;
  let pendingRunWhenIdle = false;
  let hasDeletesSinceLastRun = false;
  let scheduledTimer: ReturnType<typeof setTimeout> | null = null;

  export function setOnCheckpointNeeded(
    callback: (reason: string) => void
  ): void {
    onCheckpointNeeded = callback;
  }

  /** @testexport */
  export function _reset(): void {
    onCheckpointNeeded = null;
    if (scheduledTimer != null) {
      clearTimeout(scheduledTimer);
      scheduledTimer = null;
    }
    lastRunAt = 0;
    pendingRunWhenIdle = false;
    hasDeletesSinceLastRun = false;
  }

  function run(
    db: WritableDB,
    logger: LoggerType,
    attempts: number,
    reason: string,
    callback: () => void
  ) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      callback();
    } catch (error) {
      if (error.code !== 'SQLITE_LOCKED') {
        logger.error(
          `WalCheckpoints.run: Unexpected error (attempts: ${attempts}, reason: ${reason})`,
          Errors.toLogFormat(error)
        );
        return;
      }

      // TODO: Are there any errors that we shouldn't retry?
      logger.warn(
        `WalCheckpoints.run: Database is locked, retrying (attempts: ${attempts}, reason: ${reason})`,
        Errors.toLogFormat(error)
      );

      // TODO: This should probably try again faster with backoff or something
      setTimeout(() => {
        run(db, logger, attempts + 1, reason, callback);
      }, 1000);
    }
  }

  export function runImmediately(
    db: WritableDB,
    logger: LoggerType,
    reason: string
  ): void {
    if (scheduledTimer != null) {
      clearTimeout(scheduledTimer);
      scheduledTimer = null;
    }

    run(db, logger, 0, reason, () => {
      lastRunAt = Date.now();
      pendingRunWhenIdle = false;
      hasDeletesSinceLastRun = false;
    });
  }

  function runWhenIdle(logger: LoggerType, reason: string): void {
    if (onCheckpointNeeded == null) {
      logger.error(
        'WalCheckpoints.runWhenIdle: setOnCheckpointNeeded has not been called'
      );
      return;
    }

    if (pendingRunWhenIdle) {
      return;
    }
    pendingRunWhenIdle = true;
    onCheckpointNeeded(reason);
  }

  /** @testexport */
  export function _scheduleRun(
    event: 'commit' | 'delete',
    logger: LoggerType
  ): void {
    if (pendingRunWhenIdle) {
      return;
    }

    const prevScheduledForDelete = hasDeletesSinceLastRun;
    const needScheduledForDelete = event === 'delete';

    if (event === 'delete') {
      hasDeletesSinceLastRun = true;
    }

    const elapsedMs = Date.now() - lastRunAt;
    const throttleMs = hasDeletesSinceLastRun
      ? THROTTLE_MS_AFTER_DELETE
      : THROTTLE_MS_AFTER_COMMIT;

    if (elapsedMs >= throttleMs) {
      if (scheduledTimer != null) {
        clearTimeout(scheduledTimer);
        scheduledTimer = null;
      }
      runWhenIdle(logger, event);
      return;
    }

    if (scheduledTimer != null) {
      if (prevScheduledForDelete || !needScheduledForDelete) {
        return;
      }
      clearTimeout(scheduledTimer);
    }

    scheduledTimer = setTimeout(() => {
      scheduledTimer = null;
      runWhenIdle(logger, event);
    }, throttleMs - elapsedMs);
  }

  export function setupCommitHook(db: WritableDB, logger: LoggerType): void {
    db.setWalHook((_dbName, pageCount) => {
      if (pageCount >= PAGE_THRESHOLD) {
        // TODO: Should we run `PRAGMA wal_checkpoint(PASSIVE)` here like automatic checkpoints do?
        // We could still call runWhenIdle() to get a TRUNCATE?
        runWhenIdle(logger, 'page-threshold');
      } else {
        _scheduleRun('commit', logger);
      }
    });
  }

  function getAllTableNames(db: ReadableDB): ReadonlyArray<string> {
    const [query, params] = sql`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'messages_fts_%'
        AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'
    `;
    return db.prepare(query, { pluck: true }).all(params);
  }

  export function setupDeleteTriggers(
    db: WritableDB,
    logger: LoggerType
  ): void {
    db.createFunction('_wal_checkpoint_on_delete', () => {
      _scheduleRun('delete', logger);
    });

    const tableNames = getAllTableNames(db);

    for (const tableName of tableNames) {
      db.exec(`
        CREATE TEMP TRIGGER IF NOT EXISTS _wal_checkpoint_${tableName}_after_delete
        AFTER DELETE ON "${tableName}"
        BEGIN
          SELECT _wal_checkpoint_on_delete();
        END;
      `);
    }
  }
}
