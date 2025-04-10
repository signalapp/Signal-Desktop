// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1340;

export function updateToSchemaVersion1340(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1340) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      CREATE TABLE recentGifs (
        id TEXT NOT NULL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        previewMedia_url TEXT NOT NULL,
        previewMedia_width INTEGER NOT NULL,
        previewMedia_height INTEGER NOT NULL,
        attachmentMedia_url TEXT NOT NULL,
        attachmentMedia_width INTEGER NOT NULL,
        attachmentMedia_height INTEGER NOT NULL,
        lastUsedAt INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX recentGifs_order ON recentGifs (
        lastUsedAt DESC
      );
    `;

    db.exec(query);

    db.pragma('user_version = 1340');
  })();

  logger.info('updateToSchemaVersion1340: success!');
}
