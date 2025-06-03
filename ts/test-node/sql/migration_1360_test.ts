// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { sql, sqlJoin } from '../../sql/util';
import { createDB, explain, updateToVersion } from './helpers';
import type { WritableDB } from '../../sql/Interface';
import { DataWriter } from '../../sql/Server';

describe('SQL/updateToSchemaVersion1360', () => {
  let db: WritableDB;

  beforeEach(async () => {
    db = createDB();
    updateToVersion(db, 1360);
    await DataWriter.removeAll(db);
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
        'SEARCH message_attachments USING COVERING INDEX message_attachments_messageId (messageId=?)'
      );
    });

    it('uses index to select based on messageId', async () => {
      const details = explain(
        db,
        sql`SELECT * from message_attachments WHERE messageId IN (${sqlJoin(['id1', 'id2'])});`
      );
      assert.strictEqual(
        details,
        'SEARCH message_attachments USING INDEX message_attachments_messageId (messageId=?)'
      );
    });

    it('uses index find path with existing plaintextHash', async () => {
      const details = explain(
        db,
        sql`
          SELECT path, localKey 
          FROM message_attachments 
          WHERE plaintextHash = ${'plaintextHash'}
          LIMIT 1;
        `
      );
      assert.strictEqual(
        details,
        'SEARCH message_attachments USING INDEX message_attachments_plaintextHash (plaintextHash=?)'
      );
    });

    it('uses all path indices to find if path is being referenced', async () => {
      const path = 'path';
      const details = explain(
        db,
        sql`
           SELECT 1 FROM message_attachments 
            WHERE 
              path = ${path} OR 
              thumbnailPath = ${path} OR
              screenshotPath = ${path} OR
              backupThumbnailPath = ${path};
        `
      );
      assert.deepStrictEqual(details.split('\n'), [
        'MULTI-INDEX OR',
        'INDEX 1',
        'SEARCH message_attachments USING INDEX message_attachments_path (path=?)',
        'INDEX 2',
        'SEARCH message_attachments USING INDEX message_attachments_all_thumbnailPath (thumbnailPath=?)',
        'INDEX 3',
        'SEARCH message_attachments USING INDEX message_attachments_all_screenshotPath (screenshotPath=?)',
        'INDEX 4',
        'SEARCH message_attachments USING INDEX message_attachments_all_backupThumbnailPath (backupThumbnailPath=?)',
      ]);
    });
  });
});
