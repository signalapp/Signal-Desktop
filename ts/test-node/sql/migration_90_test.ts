// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

describe('SQL/updateToSchemaVersion90', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
  });

  afterEach(() => {
    db.close();
  });

  it('should delete screenshot.data but leave remainder', () => {
    updateToVersion(db, 89);
    insertData(db, 'messages', [
      {
        id: 'message_with_screenshot_data',
        json: {
          id: 'message_with_screenshot_data',
          storyReplyContext: {
            attachment: {
              contentType: 'video/mp4',
              filename: 'filename',
              path: 'path',
              screenshot: {
                contentType: 'image/png',
                path: 'screenshotPath',
                width: 1920,
                height: 1080,
              },
              screenshotData: {
                '4389410': 144,
                '4389411': 255,
                '4389412': 75,
                '4389413': 168,
                '4389414': 81,
                '4389415': 142,
                '4389416': 120,
                '4389417': 150,
                '4389418': 14,
              },
              size: 100,
            },
            messageId: 'story_id',
          },
        },
        storyId: 'story_id',
      },
    ]);

    updateToVersion(db, 90);

    assert.deepStrictEqual(
      getTableData(db, 'messages').map(msg => msg.json),
      [
        {
          id: 'message_with_screenshot_data',
          storyReplyContext: {
            attachment: {
              contentType: 'video/mp4',
              filename: 'filename',
              path: 'path',
              screenshot: {
                contentType: 'image/png',
                path: 'screenshotPath',
                width: 1920,
                height: 1080,
              },
              size: 100,
            },
            messageId: 'story_id',
          },
        },
      ]
    );
  });

  it('should use storyId index', () => {
    updateToVersion(db, 90);

    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        UPDATE messages
        SET json = json_remove(json, '$.storyReplyContext.attachment.screenshotData')
        WHERE isStory = 0
        AND storyId > '0'
        AND json->'storyReplyContext.attachment.screenshotData' IS NOT NULL;
        `
      )
      .all()
      .map(({ detail }) => detail)
      .join('\n');

    assert.include(details, 'USING INDEX messages_by_storyId');
    assert.notInclude(details, 'SCAN');
  });
});
