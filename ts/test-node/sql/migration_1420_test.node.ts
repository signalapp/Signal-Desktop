// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  AttachmentDownloadSource,
  type WritableDB,
} from '../../sql/Interface.std.js';
import { objectToJSON, sql } from '../../sql/util.std.js';
import { createDB, updateToVersion } from './helpers.node.js';
import type { AttachmentDownloadJobType } from '../../types/AttachmentDownload.std.js';
import { createAttachmentDownloadJob } from '../../test-helpers/attachmentDownloads.std.js';

function createJobAndEnsureMessage(
  db: WritableDB,
  index: number,
  overrides?: Partial<AttachmentDownloadJobType>
) {
  const job = createAttachmentDownloadJob(index, overrides);
  try {
    db.prepare('INSERT INTO messages (id) VALUES ($id)').run({
      id: job.messageId,
    });
  } catch (e) {
    // pass; message has already been inserted
  }
  return job;
}

function insertLegacyJob(
  db: WritableDB,
  index: number,
  overrides?: Partial<AttachmentDownloadJobType>
): void {
  const job = createJobAndEnsureMessage(db, index, overrides);
  const [query, params] = sql`
  INSERT INTO attachment_downloads
    (
      messageId,
      attachmentType,
      attachmentJson,
      attachmentSignature,
      ciphertextSize,
      contentType,
      size,
      receivedAt, 
      sentAt,
      active, 
      attempts,
      retryAfter,
      lastAttemptTimestamp,
      source
    )
  VALUES
    (
      ${job.messageId},
      ${job.attachmentType},
      ${objectToJSON(job.attachment)},
      ${job.attachmentSignature},
      ${job.ciphertextSize},
      ${job.attachment.contentType},
      ${job.attachment.size},
      ${job.receivedAt},
      ${job.sentAt},
      ${job.active ? 1 : 0},
      ${job.attempts},
      ${job.retryAfter},
      ${job.lastAttemptTimestamp},
      ${job.source}
    );
`;

  db.prepare(query).run(params);
}

describe('SQL/updateToSchemaVersion1410', () => {
  let db: WritableDB;

  afterEach(() => {
    db.close();
  });

  it('copies source to originalSource', () => {
    db = createDB();
    updateToVersion(db, 1410);
    db.transaction(() => {
      for (let i = 0; i < 15; i += 1) {
        insertLegacyJob(db, i, {
          source:
            i < 5
              ? AttachmentDownloadSource.STANDARD
              : AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
        });
      }
    })();

    updateToVersion(db, 1420);

    const numOriginalSourceStandardJobs = db
      .prepare(
        "SELECT COUNT(*) FROM attachment_downloads WHERE originalSource = 'standard'",
        { pluck: true }
      )
      .get();
    assert.strictEqual(numOriginalSourceStandardJobs, 5);

    const numOriginalSourceBackupJobs = db
      .prepare(
        "SELECT COUNT(*) FROM attachment_downloads WHERE originalSource = 'backup_import'",
        { pluck: true }
      )
      .get();
    assert.strictEqual(numOriginalSourceBackupJobs, 10);
  });
});
