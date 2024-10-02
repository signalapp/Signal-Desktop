// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import {
  attachmentDownloadJobSchema,
  type AttachmentDownloadJobType,
  type AttachmentDownloadJobTypeType,
} from '../../types/AttachmentDownload';
import type { AttachmentType } from '../../types/Attachment';
import { jsonToObject, objectToJSON, sql } from '../util';
import { AttachmentDownloadSource } from '../Interface';
import { parsePartial } from '../../util/schemas';

export const version = 1040;

export type LegacyAttachmentDownloadJobType = {
  attachment: AttachmentType;
  attempts: number;
  id: string;
  index: number;
  messageId: string;
  pending: number;
  timestamp: number;
  type: AttachmentDownloadJobTypeType;
};

export function updateToSchemaVersion1040(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1040) {
    return;
  }

  db.transaction(() => {
    // 1. Load all existing rows into memory (shouldn't be many)
    const existingJobs: Array<{
      id: string | null;
      timestamp: number | null;
      pending: number | null;
      json: string | null;
    }> = db
      .prepare(
        `
          SELECT id, timestamp, pending, json from attachment_downloads
        `
      )
      .all();
    logger.info(
      `updateToSchemaVersion1040: loaded ${existingJobs.length} existing jobs`
    );

    // 2. Create new temp table, with a couple new columns and stricter typing
    db.exec(`
        CREATE TABLE tmp_attachment_downloads (
          messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          attachmentType TEXT NOT NULL,
          digest TEXT NOT NULL,
          receivedAt INTEGER NOT NULL,
          sentAt INTEGER NOT NULL,
          contentType TEXT NOT NULL,
          size INTEGER NOT NULL,
          attachmentJson TEXT NOT NULL,
          active INTEGER NOT NULL,
          attempts INTEGER NOT NULL,
          retryAfter INTEGER,
          lastAttemptTimestamp INTEGER,

          PRIMARY KEY (messageId, attachmentType, digest)
        ) STRICT;
    `);

    // 3. Drop existing table
    db.exec('DROP TABLE attachment_downloads;');

    // 4. Rename temp table
    db.exec(
      'ALTER TABLE tmp_attachment_downloads RENAME TO attachment_downloads;'
    );

    // 5. Add new index on active & receivedAt. For most queries when there are lots of
    //    jobs (like during backup restore), many jobs will match the the WHERE clause, so
    //    the ORDER BY on receivedAt is probably the most expensive part.
    db.exec(`
      CREATE INDEX attachment_downloads_active_receivedAt
        ON attachment_downloads (
          active, receivedAt
      );
    `);

    // 6. Add new index on active & messageId. In order to prioritize visible messages,
    //    we'll also query for rows with a matching messageId. For these, the messageId
    //    matching is likely going to be the most expensive part.
    db.exec(`
      CREATE INDEX attachment_downloads_active_messageId
        ON attachment_downloads (
          active, messageId
      );
    `);

    // 7. Add new index just on messageId, for the ON DELETE CASCADE foreign key
    //    constraint
    db.exec(`
      CREATE INDEX attachment_downloads_messageId
        ON attachment_downloads (
          messageId
      );
    `);

    // 8. Rewrite old rows to match new schema
    const rowsToTransfer: Array<AttachmentDownloadJobType> = [];

    for (const existingJob of existingJobs) {
      try {
        // Type this as partial in case there is missing data
        const existingJobData: Partial<LegacyAttachmentDownloadJobType> =
          jsonToObject(existingJob.json ?? '');

        const updatedJob: Partial<AttachmentDownloadJobType> = {
          messageId: existingJobData.messageId,
          attachmentType: existingJobData.type,
          attachment: existingJobData.attachment,
          // The existing timestamp column works reasonably well in place of
          // actually retrieving the message's receivedAt
          receivedAt: existingJobData.timestamp ?? Date.now(),
          sentAt: existingJobData.timestamp ?? Date.now(),
          digest: existingJobData.attachment?.digest,
          contentType: existingJobData.attachment?.contentType,
          size: existingJobData.attachment?.size,
          active: false, // all jobs are inactive on app start
          attempts: existingJobData.attempts ?? 0,
          retryAfter: null,
          lastAttemptTimestamp: null,
          // adding due to changes in the schema
          source: AttachmentDownloadSource.STANDARD,
          ciphertextSize: 0,
        };

        const parsed = parsePartial(attachmentDownloadJobSchema, updatedJob);

        rowsToTransfer.push(parsed as AttachmentDownloadJobType);
      } catch {
        logger.warn(
          `updateToSchemaVersion1040: unable to transfer job ${existingJob.id} to new table; invalid data`
        );
      }
    }

    let numTransferred = 0;
    if (rowsToTransfer.length) {
      logger.info(
        `updateToSchemaVersion1040: transferring ${rowsToTransfer.length} rows`
      );
      for (const row of rowsToTransfer) {
        const [insertQuery, insertParams] = sql`
          INSERT INTO attachment_downloads
            (
              messageId,
              attachmentType,
              receivedAt,
              sentAt,
              digest,
              contentType,
              size,
              attachmentJson,
              active,
              attempts,
              retryAfter,
              lastAttemptTimestamp
            )
          VALUES
            (
              ${row.messageId},
              ${row.attachmentType},
              ${row.receivedAt},
              ${row.sentAt},
              ${row.digest},
              ${row.contentType},
              ${row.size},
              ${objectToJSON(row.attachment)},
              ${row.active ? 1 : 0},
              ${row.attempts},
              ${row.retryAfter},
              ${row.lastAttemptTimestamp}
            );
        `;
        try {
          db.prepare(insertQuery).run(insertParams);
          numTransferred += 1;
        } catch (error) {
          logger.error(
            'updateToSchemaVersion1040: error when transferring row',
            error
          );
        }
      }
    }

    logger.info(
      `updateToSchemaVersion1040: transferred ${numTransferred} rows, removed ${
        existingJobs.length - numTransferred
      }`
    );

    db.pragma('user_version = 1040');
  })();

  logger.info('updateToSchemaVersion1040: success!');
}
