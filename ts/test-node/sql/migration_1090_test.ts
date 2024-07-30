// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion } from './helpers';

describe('SQL/updateToSchemaVersion1090', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1090);
  });

  afterEach(() => {
    db.close();
  });

  describe('Additional messages_on_delete indexes', () => {
    it('uses index for selecting reactions by messageId', () => {
      const details = db
        .prepare(
          `EXPLAIN QUERY PLAN 
            SELECT rowid FROM reactions
            WHERE messageId = '123';
           `
        )
        .all()
        .map(step => step.detail)
        .join(', ');

      assert.strictEqual(
        details,
        'SEARCH reactions USING COVERING INDEX reactions_messageId (messageId=?)'
      );
    });

    it('uses index for selecting storyReads by storyId', () => {
      const details = db
        .prepare(
          `EXPLAIN QUERY PLAN 
            DELETE FROM storyReads WHERE storyId = '123';
          `
        )
        .all()
        .map(step => step.detail)
        .join(', ');

      assert.strictEqual(
        details,
        'SEARCH storyReads USING INDEX storyReads_storyId (storyId=?)'
      );
    });
  });
});
