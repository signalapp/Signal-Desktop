// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion61(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 61) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE storyDistributions DROP COLUMN avatarKey;
      ALTER TABLE storyDistributions DROP COLUMN avatarUrlPath;

      ALTER TABLE storyDistributions ADD COLUMN deletedAtTimestamp INTEGER;
      ALTER TABLE storyDistributions ADD COLUMN allowsReplies INTEGER;
      ALTER TABLE storyDistributions ADD COLUMN isBlockList INTEGER;

      ALTER TABLE storyDistributions ADD COLUMN storageID STRING;
      ALTER TABLE storyDistributions ADD COLUMN storageVersion INTEGER;
      ALTER TABLE storyDistributions ADD COLUMN storageUnknownFields BLOB;
      ALTER TABLE storyDistributions ADD COLUMN storageNeedsSync INTEGER;

      ALTER TABLE messages ADD COLUMN storyDistributionListId STRING;

      CREATE INDEX messages_by_distribution_list
        ON messages(storyDistributionListId, received_at)
        WHERE storyDistributionListId IS NOT NULL;
      `
    );

    db.pragma('user_version = 61');
  })();

  logger.info('updateToSchemaVersion61: success!');
}
