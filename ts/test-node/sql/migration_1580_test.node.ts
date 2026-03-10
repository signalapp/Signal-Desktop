// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface.std.js';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.js';

describe('SQL/updateToSchemaVersion1580', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1570);
  });
  afterEach(() => {
    db.close();
  });

  it('deletes any expired group story replies', () => {
    insertData(db, 'conversations', [
      {
        id: 'groupConvoId',
        type: 'group',
      },
      {
        id: 'directConvoId',
        type: 'private',
      },
    ]);

    insertData(db, 'messages', [
      {
        id: 'story-that-exists',
        type: 'story',
        conversationId: 'groupConvoId',
        timestamp: Date.now(),
      },
      {
        id: 'doe-story',
        type: 'story',
        conversationId: 'groupConvoId',
        timestamp: Date.now(),
        isErased: 1,
      },
      {
        id: 'group-reply-to-existing-story',
        conversationId: 'groupConvoId',
        timestamp: Date.now(),
        storyId: 'story-that-exists',
      },
      {
        id: 'group-reply-to-non-existing-story',
        conversationId: 'groupConvoId',
        timestamp: Date.now(),
        storyId: 'story-that-does-not-exist',
      },
      {
        id: 'group-reply-to-doe-story',
        conversationId: 'groupConvoId',
        timestamp: Date.now(),
        storyId: 'doe-story',
      },
      {
        id: 'direct-reply-to-existing-story',
        conversationId: 'directConvoId',
        timestamp: Date.now(),
        storyId: 'storyThatExists',
      },
      {
        id: 'direct-reply-to-non-existing-story',
        conversationId: 'directConvoId',
        timestamp: Date.now(),
        storyId: 'storyThatDoesNotExist',
      },
      {
        id: 'normal-group-message',
        conversationId: 'groupConvoId',
        timestamp: Date.now(),
      },
      {
        id: 'normal-direct-message',
        conversationId: 'directConvoId',
        timestamp: Date.now(),
      },
    ]);

    updateToVersion(db, 1580);
    assert.deepStrictEqual(
      getTableData(db, 'messages').map(row => row.id),
      [
        'story-that-exists',
        'doe-story',
        'group-reply-to-existing-story',
        // 'group-reply-to-non-existing-story', <-- DELETED!
        // 'group-reply-to-doe-story', <-- DELETED!
        'direct-reply-to-existing-story',
        'direct-reply-to-non-existing-story',
        'normal-group-message',
        'normal-direct-message',
      ]
    );
  });
});
