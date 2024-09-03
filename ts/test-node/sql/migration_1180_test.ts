// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { omit } from 'lodash';
import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion } from './helpers';
import type { AttachmentDownloadJobType } from '../../types/AttachmentDownload';
import { jsonToObject, objectToJSON, sql } from '../../sql/util';
import { IMAGE_BMP } from '../../types/MIME';

function insertOldJob(
  db: WritableDB,
  job: Omit<AttachmentDownloadJobType, 'source' | 'ciphertextSize'>,
  addMessageFirst: boolean = true
): void {
  if (addMessageFirst) {
    try {
      db.prepare('INSERT INTO messages (id) VALUES ($id)').run({
        id: job.messageId,
      });
    } catch (e) {
      // pass; message has already been inserted
    }
  }
  const [query, params] = sql`
    INSERT INTO attachment_downloads
      (
        messageId,
        attachmentType,
        attachmentJson,
        digest,
        contentType,
        size,
        receivedAt, 
        sentAt,
        active, 
        attempts,
        retryAfter,
        lastAttemptTimestamp
      )
    VALUES
      (
        ${job.messageId},
        ${job.attachmentType},
        ${objectToJSON(job.attachment)},
        ${job.digest},
        ${job.contentType},
        ${job.size},
        ${job.receivedAt},
        ${job.sentAt},
        ${job.active ? 1 : 0},
        ${job.attempts},
        ${job.retryAfter},
        ${job.lastAttemptTimestamp}
      );
  `;

  db.prepare(query).run(params);
}

function getAttachmentDownloadJobs(db: WritableDB) {
  const [query] = sql`
      SELECT * FROM attachment_downloads ORDER BY receivedAt DESC;
    `;

  return db
    .prepare(query)
    .all()
    .map(job => ({
      ...omit(job, 'attachmentJson'),
      active: job.active === 1,
      attachment: jsonToObject(job.attachmentJson),
    }));
}

describe('SQL/updateToSchemaVersion1180', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1170);
  });

  afterEach(() => {
    db.close();
  });

  it('adds source column with default standard to any existing jobs', async () => {
    const job: Omit<AttachmentDownloadJobType, 'source' | 'ciphertextSize'> = {
      messageId: '123',
      digest: 'digest',
      attachmentType: 'attachment',
      attachment: { size: 128, contentType: IMAGE_BMP },
      size: 128,
      contentType: IMAGE_BMP,
      receivedAt: 120,
      sentAt: 120,
      active: false,
      attempts: 0,
      retryAfter: null,
      lastAttemptTimestamp: null,
    };
    insertOldJob(db, job);
    updateToVersion(db, 1180);
    assert.deepEqual(getAttachmentDownloadJobs(db), [
      { ...job, source: 'standard', ciphertextSize: 0 },
    ]);
  });
  it('uses convering index for summing all pending backup jobs', async () => {
    updateToVersion(db, 1180);
    const details = db
      .prepare(
        `
            EXPLAIN QUERY PLAN 
            SELECT SUM(ciphertextSize) FROM attachment_downloads 
            WHERE source = 'backup_import';
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(
      details,
      'SEARCH attachment_downloads USING COVERING INDEX attachment_downloads_source_ciphertextSize (source=?)'
    );
  });
  it('uses index for deleting all backup jobs', async () => {
    updateToVersion(db, 1180);
    const details = db
      .prepare(
        `
            EXPLAIN QUERY PLAN 
            DELETE FROM attachment_downloads 
            WHERE source = 'backup_import'; 
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(
      details,
      'SEARCH attachment_downloads USING COVERING INDEX attachment_downloads_source_ciphertextSize (source=?)'
    );
  });
});
