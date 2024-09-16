// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { AttachmentDownloadSource, type WritableDB } from '../../sql/Interface';
import { objectToJSON, sql } from '../../sql/util';
import { createDB, updateToVersion } from './helpers';
import type { AttachmentDownloadJobType } from '../../types/AttachmentDownload';
import { IMAGE_JPEG } from '../../types/MIME';

type UnflattenedAttachmentDownloadJobType = Omit<
  AttachmentDownloadJobType,
  'digest' | 'contentType' | 'size' | 'ciphertextSize'
>;

function createJob(
  index: number,
  overrides?: Partial<UnflattenedAttachmentDownloadJobType>
): UnflattenedAttachmentDownloadJobType {
  return {
    messageId: `message${index}`,
    attachmentType: 'attachment',
    attachment: {
      digest: `digest${index}`,
      contentType: IMAGE_JPEG,
      size: 128,
    },
    receivedAt: 100 + index,
    sentAt: 100 + index,
    attempts: 0,
    active: false,
    retryAfter: null,
    lastAttemptTimestamp: null,
    source: AttachmentDownloadSource.STANDARD,
    ...overrides,
  };
}
function insertJob(
  db: WritableDB,
  index: number,
  overrides?: Partial<UnflattenedAttachmentDownloadJobType>
): void {
  const job = createJob(index, overrides);
  try {
    db.prepare('INSERT INTO messages (id) VALUES ($id)').run({
      id: job.messageId,
    });
  } catch (e) {
    // pass; message has already been inserted
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
      lastAttemptTimestamp,
      source
    )
  VALUES
    (
      ${job.messageId},
      ${job.attachmentType},
      ${objectToJSON(job.attachment)},
      ${job.attachment.digest},
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

const NUM_STANDARD_JOBS = 100;

describe('SQL/updateToSchemaVersion1200', () => {
  let db: WritableDB;

  after(() => {
    db.close();
  });

  before(() => {
    db = createDB();
    updateToVersion(db, 1200);
    db.transaction(() => {
      for (let i = 0; i < 10_000; i += 1) {
        insertJob(db, i, {
          source:
            i < NUM_STANDARD_JOBS
              ? AttachmentDownloadSource.STANDARD
              : AttachmentDownloadSource.BACKUP_IMPORT,
        });
      }
    })();
  });

  it('uses correct index for standard query', () => {
    const now = Date.now();
    const [query, params] = sql`
        SELECT * FROM attachment_downloads
        WHERE
         active = 0
        AND
         (retryAfter is NULL OR retryAfter <= ${now})
        ORDER BY receivedAt DESC
        LIMIT 3
    `;
    const details = db
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all(params)
      .map(step => step.detail)
      .join(', ');
    assert.equal(
      details,
      'SEARCH attachment_downloads USING INDEX attachment_downloads_active_receivedAt (active=?)'
    );
  });

  it('uses correct index for standard query with sources', () => {
    const now = Date.now();
    // query with sources (e.g. when backup-import is paused)
    const [query, params] = sql`
        SELECT * FROM attachment_downloads
        WHERE
            active IS 0
        AND 
            source IN ('standard')
        AND
            (retryAfter is NULL OR retryAfter <= ${now})
        ORDER BY receivedAt DESC
        LIMIT 3
    `;
    const details = db
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all(params)
      .map(step => step.detail)
      .join(', ');
    assert.equal(
      details,
      'SEARCH attachment_downloads USING INDEX attachment_downloads_active_source_receivedAt (active=? AND source=?)'
    );
  });

  it('uses provided index for prioritized query with sources', () => {
    // prioritize visible messages with sources (e.g. when backup-import is paused)
    const [query, params] = sql`
        SELECT * FROM attachment_downloads
        INDEXED BY attachment_downloads_active_messageId
        WHERE
            active IS 0
        AND 
            messageId IN ('message12', 'message101')
        AND
            (lastAttemptTimestamp is NULL OR lastAttemptTimestamp <= ${Date.now()})
        AND 
            source IN ('standard')
        ORDER BY receivedAt ASC
        LIMIT 3
    `;
    const result = db.prepare(query).all(params);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].messageId, 'message12');
    const details = db
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all(params)
      .map(step => step.detail)
      .join(', ');
    assert.equal(
      details,
      'SEARCH attachment_downloads USING INDEX attachment_downloads_active_messageId (active=? AND messageId=?), USE TEMP B-TREE FOR ORDER BY'
    );
  });

  it('uses existing index to remove all backup jobs ', () => {
    // prioritize visible messages with sources (e.g. when backup-import is paused)
    const [query, params] = sql`
        DELETE FROM attachment_downloads 
        WHERE source = 'backup_import';
    `;

    const details = db
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all(params)
      .map(step => step.detail)
      .join(', ');
    assert.equal(
      details,
      'SEARCH attachment_downloads USING COVERING INDEX attachment_downloads_source_ciphertextSize (source=?)'
    );
    db.prepare(query).run(params);
    assert.equal(
      db.prepare('SELECT * FROM attachment_downloads').all().length,
      NUM_STANDARD_JOBS
    );
  });
});
