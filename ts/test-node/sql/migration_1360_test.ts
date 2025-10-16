// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { sql } from '../../sql/util.std.js';
import { createDB, explain, updateToVersion } from './helpers.node.js';
import type { WritableDB } from '../../sql/Interface.std.js';

describe('SQL/updateToSchemaVersion1360', () => {
  let db: WritableDB;

  beforeEach(async () => {
    db = createDB();
    updateToVersion(db, 1360);
  });

  afterEach(() => {
    db.close();
  });

  describe('message attachments', () => {
    it('uses covering index to delete based on messageId', async () => {
      const details = explain(
        db,
        sql`DELETE from message_attachments WHERE messageId = ${'messageId'}`
      );
      assert.strictEqual(
        details,
        'SEARCH message_attachments USING COVERING INDEX sqlite_autoindex_message_attachments_1 (messageId=?)'
      );
    });
  });
});
