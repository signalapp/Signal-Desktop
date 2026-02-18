// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.js';
import {
  createDB,
  explain,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.js';
import { sql } from '../../sql/util.std.js';

describe('SQL/updateToSchemaVersion1650', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1650);
  });

  afterEach(() => {
    db.close();
  });

  it('uses indexes for isAttachmentSafeToDelete', () => {
    const details = explain(
      db,
      sql`SELECT EXISTS (
          SELECT 1 FROM attachments_protected_from_deletion 
            WHERE path = 'thepath'
          UNION ALL
            SELECT 1 FROM message_attachments 
            WHERE 
              path = 'thepath' OR
              thumbnailPath = 'thepath' OR
              screenshotPath = 'thepath'
        );`
    );

    assert.isTrue(
      details.includes(
        'USING COVERING INDEX sqlite_autoindex_attachments_protected_from_deletion'
      )
    );
    assert.isTrue(details.includes('MULTI-INDEX OR'));
    assert.isTrue(
      details.includes('USING INDEX message_attachments_path (path=?)')
    );
    assert.isTrue(
      details.includes(
        'USING INDEX message_attachments_thumbnailPath (thumbnailPath=?)'
      )
    );
    assert.isTrue(
      details.includes(
        'USING INDEX message_attachments_screenshotPath (screenshotPath=?)'
      )
    );
  });

  it('removes protected path when attachment is inserted or updated', () => {
    insertData(db, 'messages', [
      {
        id: 'messageId',
        conversationId: 'convoId',
      },
    ]);

    // Protect some paths
    insertData(db, 'attachments_protected_from_deletion', [
      {
        path: 'protected1',
      },
      {
        path: 'protected2',
      },
      {
        path: 'protected3',
      },
      {
        path: 'protected4',
      },
      {
        path: 'protected5',
      },
      {
        path: 'protected6',
      },
      {
        path: 'protected7',
      },
    ]);

    // Insert an attachment that uses a protected =path
    insertData(db, 'message_attachments', [
      {
        messageId: 'messageId',
        editHistoryIndex: -1,
        orderInMessage: 0,
        attachmentType: 'attachment',
        receivedAt: 42,
        sentAt: 42,
        size: 128,
        contentType: 'image/png',
        conversationId: 'convoId',
        path: 'protected1',
        thumbnailPath: 'protected2',
        screenshotPath: 'protected3',
      },
    ]);

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [
        { path: 'protected4' },
        { path: 'protected5' },
        { path: 'protected6' },
        { path: 'protected7' },
      ]
    );

    // Updates also remove protection
    db.prepare(
      `UPDATE message_attachments SET 
          path='protected4',
          screenshotPath='protected5',
          thumbnailPath='protected6';
      `
    ).run();

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [{ path: 'protected7' }]
    );
  });
});
