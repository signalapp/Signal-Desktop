// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { omit } from 'lodash';
import { assert } from 'chai';

import type { ReadableDB, WritableDB } from '../../sql/Interface';
import { jsonToObject, objectToJSON, sql, sqlJoin } from '../../sql/util';
import { createDB, updateToVersion } from './helpers';
import type { LegacyAttachmentDownloadJobType } from '../../sql/migrations/1040-undownloaded-backed-up-media';
import type { AttachmentType } from '../../types/Attachment';
import type { AttachmentDownloadJobType } from '../../types/AttachmentDownload';
import { IMAGE_JPEG } from '../../types/MIME';

function getAttachmentDownloadJobs(db: ReadableDB) {
  const [query] = sql`
    SELECT * FROM attachment_downloads ORDER BY receivedAt DESC;
  `;

  return db
    .prepare(query)
    .all()
    .map(job => ({
      ...omit(job, 'attachmentJson'),
      attachment: jsonToObject(job.attachmentJson),
    }));
}

type UnflattenedAttachmentDownloadJobType = Omit<
  AttachmentDownloadJobType,
  'digest' | 'contentType' | 'size' | 'source' | 'ciphertextSize'
>;
function insertNewJob(
  db: WritableDB,
  job: UnflattenedAttachmentDownloadJobType,
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
      ${job.attachment.digest},
      ${job.attachment.contentType},
      ${job.attachment.size},
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

describe('SQL/updateToSchemaVersion1040', () => {
  describe('Storing of new attachment jobs', () => {
    let db: WritableDB;

    beforeEach(() => {
      db = createDB();
      updateToVersion(db, 1040);
    });

    afterEach(() => {
      db.close();
    });

    it('allows storing of new backup attachment jobs', () => {
      insertNewJob(db, {
        messageId: 'message1',
        attachmentType: 'attachment',
        attachment: {
          digest: 'digest1',
          contentType: IMAGE_JPEG,
          size: 128,
        },
        receivedAt: 1970,
        sentAt: 2070,
        active: false,
        retryAfter: null,
        attempts: 0,
        lastAttemptTimestamp: null,
      });

      insertNewJob(db, {
        messageId: 'message2',
        attachmentType: 'attachment',
        attachment: {
          digest: 'digest2',
          contentType: IMAGE_JPEG,
          size: 128,
        },
        receivedAt: 1971,
        sentAt: 2071,
        active: false,
        retryAfter: 1204,
        attempts: 0,
        lastAttemptTimestamp: 1004,
      });

      const attachments = getAttachmentDownloadJobs(db);
      assert.strictEqual(attachments.length, 2);
      assert.deepEqual(attachments, [
        {
          messageId: 'message2',
          attachmentType: 'attachment',
          digest: 'digest2',
          contentType: IMAGE_JPEG,
          size: 128,
          receivedAt: 1971,
          sentAt: 2071,
          active: 0,
          retryAfter: 1204,
          attempts: 0,
          lastAttemptTimestamp: 1004,
          attachment: {
            digest: 'digest2',
            contentType: IMAGE_JPEG,
            size: 128,
          },
        },
        {
          messageId: 'message1',
          attachmentType: 'attachment',
          digest: 'digest1',
          contentType: IMAGE_JPEG,
          size: 128,
          receivedAt: 1970,
          sentAt: 2070,
          active: 0,
          retryAfter: null,
          attempts: 0,
          lastAttemptTimestamp: null,
          attachment: {
            digest: 'digest1',
            contentType: IMAGE_JPEG,
            size: 128,
          },
        },
      ]);
    });

    it('Respects primary key constraint', () => {
      const job: UnflattenedAttachmentDownloadJobType = {
        messageId: 'message1',
        attachmentType: 'attachment',
        attachment: {
          digest: 'digest1',
          contentType: IMAGE_JPEG,
          size: 128,
        },
        receivedAt: 1970,
        sentAt: 2070,
        active: false,
        retryAfter: null,
        attempts: 0,
        lastAttemptTimestamp: null,
      };
      insertNewJob(db, job);
      assert.throws(() => {
        insertNewJob(db, { ...job, attempts: 1 });
      });

      const attachments = getAttachmentDownloadJobs(db);
      assert.strictEqual(attachments.length, 1);
      assert.strictEqual(attachments[0].attempts, 0);
    });

    it('uses indices searching for next job', () => {
      const now = Date.now();

      const job: UnflattenedAttachmentDownloadJobType = {
        messageId: 'message1',
        attachmentType: 'attachment',
        attachment: {
          digest: 'digest1',
          contentType: IMAGE_JPEG,
          size: 128,
        },
        receivedAt: 101,
        sentAt: 101,
        attempts: 0,
        active: false,
        retryAfter: null,
        lastAttemptTimestamp: null,
      };
      insertNewJob(db, job);
      insertNewJob(db, {
        ...job,
        messageId: 'message2',
        receivedAt: 102,
        sentAt: 102,
        retryAfter: now + 1,
        lastAttemptTimestamp: now - 10,
      });
      insertNewJob(db, {
        ...job,
        messageId: 'message3',
        active: true,
        receivedAt: 103,
        sentAt: 103,
      });
      insertNewJob(db, {
        ...job,
        messageId: 'message4',
        attachmentType: 'contact',
        receivedAt: 104,
        sentAt: 104,
        retryAfter: now,
        lastAttemptTimestamp: now - 1000,
      });

      {
        const [query, params] = sql`
          SELECT * FROM attachment_downloads
          WHERE
            active = 0
          AND
            (retryAfter is NULL OR retryAfter <= ${now})
          ORDER BY receivedAt DESC
          LIMIT 5
        `;

        const result = db.prepare(query).all(params);
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(
          result.map(res => res.messageId),
          ['message4', 'message1']
        );

        const details = db
          .prepare(`EXPLAIN QUERY PLAN ${query}`)
          .all(params)
          .map(step => step.detail)
          .join(', ');
        assert.include(
          details,
          'USING INDEX attachment_downloads_active_receivedAt'
        );
        assert.notInclude(details, 'TEMP B-TREE');
        assert.notInclude(details, 'SCAN');
      }
      {
        const messageIds = ['message1', 'message2', 'message4'];
        const [query, params] = sql`
        SELECT * FROM attachment_downloads
        INDEXED BY attachment_downloads_active_messageId
        WHERE
          active = 0
        AND
          (lastAttemptTimestamp is NULL OR lastAttemptTimestamp <= ${now - 100})
        AND
          messageId IN (${sqlJoin(messageIds)})
        ORDER BY receivedAt ASC
        LIMIT 5
        `;

        const result = db.prepare(query).all(params);
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(
          result.map(res => res.messageId),
          ['message1', 'message4']
        );
        const details = db
          .prepare(`EXPLAIN QUERY PLAN ${query}`)
          .all(params)
          .map(step => step.detail)
          .join(', ');

        // This query _will_ use a temp b-tree for ordering, but the number of rows
        // should be quite low.
        assert.include(
          details,
          'USING INDEX attachment_downloads_active_messageId'
        );
      }
    });

    it('respects foreign key constraint on messageId', () => {
      const job: Omit<AttachmentDownloadJobType, 'source' | 'ciphertextSize'> =
        {
          messageId: 'message1',
          attachmentType: 'attachment',
          attachment: {
            digest: 'digest1',
            contentType: IMAGE_JPEG,
            size: 128,
          },
          receivedAt: 1970,
          digest: 'digest1',
          contentType: IMAGE_JPEG,
          size: 128,
          sentAt: 2070,
          active: false,
          retryAfter: null,
          attempts: 0,
          lastAttemptTimestamp: null,
        };
      // throws if we don't add the message first
      assert.throws(() => insertNewJob(db, job, false));
      insertNewJob(db, job, true);

      assert.strictEqual(getAttachmentDownloadJobs(db).length, 1);

      // Deletes the job when the message is deleted
      db.prepare('DELETE FROM messages WHERE id = $id').run({
        id: job.messageId,
      });
      assert.strictEqual(getAttachmentDownloadJobs(db).length, 0);
    });
  });

  describe('existing jobs are transferred', () => {
    let db: WritableDB;

    beforeEach(() => {
      db = createDB();
      updateToVersion(db, 1030);
    });

    afterEach(() => {
      db.close();
    });

    it('existing rows are retained; invalid existing rows are removed', () => {
      insertLegacyJob(db, {
        id: 'id-1',
        messageId: 'message-1',
        timestamp: 1000,
        attachment: {
          size: 100,
          contentType: 'image/png',
          digest: 'digest1',
          cdnKey: 'key1',
        } as AttachmentType,
        pending: 0,
        index: 0,
        type: 'attachment',
      });
      insertLegacyJob(db, {
        id: 'invalid-1',
      });
      insertLegacyJob(db, {
        id: 'id-2',
        messageId: 'message-2',
        timestamp: 1001,
        attachment: {
          size: 100,
          contentType: 'image/jpeg',
          digest: 'digest2',
          cdnKey: 'key2',
        } as AttachmentType,
        pending: 1,
        index: 2,
        type: 'attachment',
        attempts: 1,
      });
      insertLegacyJob(db, {
        id: 'invalid-2',
        timestamp: 1000,
        attachment: { size: 100, contentType: 'image/jpeg' } as AttachmentType,
        pending: 0,
        index: 0,
        type: 'attachment',
      });
      insertLegacyJob(db, {
        id: 'invalid-3-no-content-type',
        timestamp: 1000,
        attachment: { size: 100 } as AttachmentType,
        pending: 0,
        index: 0,
        type: 'attachment',
      });
      insertLegacyJob(db, {
        id: 'duplicate-1',
        messageId: 'message-1',
        timestamp: 1000,
        attachment: {
          size: 100,
          contentType: 'image/jpeg',
          digest: 'digest1',
        } as AttachmentType,
        pending: 0,
        index: 0,
        type: 'attachment',
      });

      const legacyJobs = db.prepare('SELECT * FROM attachment_downloads').all();
      assert.strictEqual(legacyJobs.length, 6);

      updateToVersion(db, 1040);

      const newJobs = getAttachmentDownloadJobs(db);
      assert.strictEqual(newJobs.length, 2);
      assert.deepEqual(newJobs[1], {
        messageId: 'message-1',
        receivedAt: 1000,
        sentAt: 1000,
        attachment: {
          size: 100,
          contentType: 'image/png',
          digest: 'digest1',
          cdnKey: 'key1',
        },
        size: 100,
        contentType: 'image/png',
        digest: 'digest1',
        active: 0,
        attempts: 0,
        attachmentType: 'attachment',
        lastAttemptTimestamp: null,
        retryAfter: null,
      });
      assert.deepEqual(newJobs[0], {
        messageId: 'message-2',
        receivedAt: 1001,
        sentAt: 1001,
        attachment: {
          size: 100,
          contentType: 'image/jpeg',
          digest: 'digest2',
          cdnKey: 'key2',
        },
        size: 100,
        contentType: 'image/jpeg',
        digest: 'digest2',
        active: 0,
        attempts: 1,
        attachmentType: 'attachment',
        lastAttemptTimestamp: null,
        retryAfter: null,
      });
    });
  });
});

function insertLegacyJob(
  db: WritableDB,
  job: Partial<LegacyAttachmentDownloadJobType>
): void {
  db.prepare('INSERT OR REPLACE INTO messages (id) VALUES ($id)').run({
    id: job.messageId,
  });
  const [query, params] = sql`
    INSERT INTO attachment_downloads
      (id, timestamp, pending, json)
    VALUES
      (
        ${job.id},
        ${job.timestamp},
        ${job.pending},
        ${objectToJSON(job)}
      );
  `;

  db.prepare(query).run(params);
}
