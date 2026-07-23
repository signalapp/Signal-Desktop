// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.ts';
import { sql } from '../../sql/util.std.ts';
import {
  createDB,
  updateToVersion,
  insertData,
  getTableData,
  explain,
} from './helpers.node.ts';

describe('SQL/updateToSchemaVersion1760', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
  });

  afterEach(() => {
    db.close();
  });

  it('removes the cached attachment but preserves the author', () => {
    updateToVersion(db, 1750);
    insertData(db, 'messages', [
      {
        id: 'story_reply',
        json: {
          id: 'story_reply',
          storyReplyContext: {
            attachment: {
              contentType: 'video/mp4',
              path: 'path',
              size: 100,
            },
            authorAci: 'author_aci',
          },
        },
        storyId: 'story_id',
      },
    ]);

    updateToVersion(db, 1760);

    assert.deepStrictEqual(
      getTableData(db, 'messages').map(msg => msg.json),
      [
        {
          id: 'story_reply',
          storyReplyContext: {
            authorAci: 'author_aci',
          },
        },
      ]
    );
  });

  it('should use storyId index', () => {
    updateToVersion(db, 1760);

    const details = explain(
      db,
      sql`
        UPDATE messages
        SET json = json_remove(json, '$.storyReplyContext.attachment')
        WHERE isStory = 0
        AND storyId > '0'
        AND json->'$.storyReplyContext.attachment' IS NOT NULL;
        `
    );

    assert.include(details, 'USING INDEX messages_by_storyId');
    assert.notInclude(details, 'SCAN');
  });
});
