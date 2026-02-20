// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.js';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.js';

describe('SQL/updateToSchemaVersion1660', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1660);
  });

  afterEach(() => {
    db.close();
  });

  it('allows same path for different messageIds', () => {
    insertData(db, 'attachments_protected_from_deletion', [
      { path: 'shared', messageId: 'msg1' },
      { path: 'shared', messageId: 'msg2' },
    ]);

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [
        { path: 'shared', messageId: 'msg1' },
        { path: 'shared', messageId: 'msg2' },
      ]
    );
  });

  it('insert trigger only removes protection for matching messageId', () => {
    insertData(db, 'messages', [{ id: 'msg1', conversationId: 'convoId' }]);

    insertData(db, 'attachments_protected_from_deletion', [
      { path: 'a', messageId: 'msg1' },
      { path: 'a', messageId: 'msg2' },
    ]);

    insertData(db, 'message_attachments', [
      {
        messageId: 'msg1',
        editHistoryIndex: -1,
        orderInMessage: 0,
        attachmentType: 'attachment',
        receivedAt: 42,
        sentAt: 42,
        size: 128,
        contentType: 'image/png',
        conversationId: 'convoId',
        path: 'a',
      },
    ]);

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [{ path: 'a', messageId: 'msg2' }]
    );
  });

  it('insert trigger removes protection for all 4 path types', () => {
    insertData(db, 'messages', [{ id: 'msg1', conversationId: 'convoId' }]);

    insertData(db, 'attachments_protected_from_deletion', [
      { path: 'path', messageId: 'msg1' },
      { path: 'thumbnailPath', messageId: 'msg1' },
      { path: 'screenshotPath', messageId: 'msg1' },
      { path: 'backupThumbnailPath', messageId: 'msg1' },
      { path: 'unrelated', messageId: 'msg1' },
    ]);

    insertData(db, 'message_attachments', [
      {
        messageId: 'msg1',
        editHistoryIndex: -1,
        orderInMessage: 0,
        attachmentType: 'attachment',
        receivedAt: 42,
        sentAt: 42,
        size: 128,
        contentType: 'image/png',
        conversationId: 'convoId',
        path: 'path',
        thumbnailPath: 'thumbnailPath',
        screenshotPath: 'screenshotPath',
        backupThumbnailPath: 'backupThumbnailPath',
      },
    ]);

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [{ path: 'unrelated', messageId: 'msg1' }]
    );
  });

  it('update trigger only removes protection for matching messageId', () => {
    insertData(db, 'messages', [{ id: 'msg1', conversationId: 'convoId' }]);

    insertData(db, 'message_attachments', [
      {
        messageId: 'msg1',
        editHistoryIndex: -1,
        orderInMessage: 0,
        attachmentType: 'attachment',
        receivedAt: 42,
        sentAt: 42,
        size: 128,
        contentType: 'image/png',
        conversationId: 'convoId',
        path: 'old',
      },
    ]);

    insertData(db, 'attachments_protected_from_deletion', [
      { path: 'new', messageId: 'msg1' },
      { path: 'new', messageId: 'msg2' },
    ]);

    db.prepare("UPDATE message_attachments SET path='new'").run();

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [{ path: 'new', messageId: 'msg2' }]
    );
  });

  it('update trigger removes protection for all 4 path types', () => {
    insertData(db, 'messages', [{ id: 'msg1', conversationId: 'convoId' }]);

    insertData(db, 'message_attachments', [
      {
        messageId: 'msg1',
        editHistoryIndex: -1,
        orderInMessage: 0,
        attachmentType: 'attachment',
        receivedAt: 42,
        sentAt: 42,
        size: 128,
        contentType: 'image/png',
        conversationId: 'convoId',
        path: 'old',
      },
    ]);

    insertData(db, 'attachments_protected_from_deletion', [
      { path: 'path', messageId: 'msg1' },
      { path: 'thumbnailPath', messageId: 'msg1' },
      { path: 'screenshotPath', messageId: 'msg1' },
      { path: 'backupThumbnailPath', messageId: 'msg1' },
      { path: 'unrelated', messageId: 'msg1' },
    ]);

    db.prepare(
      `UPDATE message_attachments SET
        path='path',
        thumbnailPath='thumbnailPath',
        screenshotPath='screenshotPath',
        backupThumbnailPath='backupThumbnailPath'`
    ).run();

    assert.deepStrictEqual(
      getTableData(db, 'attachments_protected_from_deletion'),
      [{ path: 'unrelated', messageId: 'msg1' }]
    );
  });
});
