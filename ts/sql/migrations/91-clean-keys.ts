// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database, RunResult } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { PniString } from '../../types/ServiceId';
import { normalizePni } from '../../types/ServiceId';
import * as Errors from '../../types/errors';

export default function updateToSchemaVersion91(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 91) {
    return;
  }

  db.transaction(() => {
    // Fix the ourServiceId column so it's generated from the right JSON field

    db.exec(`
      --- First, prekeys
      DROP INDEX preKeys_ourServiceId;
      
      ALTER TABLE preKeys
        DROP COLUMN ourServiceId;
      ALTER TABLE preKeys
        ADD COLUMN ourServiceId NUMBER
        GENERATED ALWAYS AS (json_extract(json, '$.ourServiceId'));
      
      CREATE INDEX preKeys_ourServiceId ON preKeys (ourServiceId);    

      -- Second, kyber prekeys

      DROP INDEX kyberPreKeys_ourServiceId;
      
      ALTER TABLE kyberPreKeys
        DROP COLUMN ourServiceId;
      ALTER TABLE kyberPreKeys
        ADD COLUMN ourServiceId NUMBER
        GENERATED ALWAYS AS (json_extract(json, '$.ourServiceId'));
      
      CREATE INDEX kyberPreKeys_ourServiceId ON kyberPreKeys (ourServiceId); 

      -- Finally, signed prekeys

      DROP INDEX signedPreKeys_ourServiceId;
      
      ALTER TABLE signedPreKeys
        DROP COLUMN ourServiceId;
      ALTER TABLE signedPreKeys
        ADD COLUMN ourServiceId NUMBER
        GENERATED ALWAYS AS (json_extract(json, '$.ourServiceId'));
      
      CREATE INDEX signedPreKeys_ourServiceId ON signedPreKeys (ourServiceId); 
    `);

    // Do overall count - if it's less than 1000, move on

    const totalKeys = db
      .prepare('SELECT count(*) FROM preKeys;')
      .pluck(true)
      .get();
    logger.info(`updateToSchemaVersion91: Found ${totalKeys} keys`);
    if (totalKeys < 1000) {
      db.pragma('user_version = 91');
      return;
    }

    // Grab our PNI

    let pni: PniString;
    const pniJson = db
      .prepare("SELECT json FROM items WHERE id IS 'pni'")
      .pluck()
      .get();
    try {
      const pniData = JSON.parse(pniJson);
      pni = normalizePni(pniData.value, 'updateToSchemaVersion91');
    } catch (error) {
      db.pragma('user_version = 91');
      if (pniJson) {
        logger.warn(
          'updateToSchemaVersion91: PNI found but did not parse',
          Errors.toLogFormat(error)
        );
      } else {
        logger.info('updateToSchemaVersion91: Our PNI not found');
      }
      return;
    }

    // Grab PNI-specific count

    const [beforeQuery, beforeParams] =
      sql`SELECT count(*) from preKeys WHERE ourServiceId = ${pni}`;
    const beforeKeys = db.prepare(beforeQuery).pluck(true).get(beforeParams);
    logger.info(`updateToSchemaVersion91: Found ${beforeKeys} preKeys for PNI`);

    // Create index to help us with all these queries

    db.exec(`
      ALTER TABLE preKeys
        ADD COLUMN createdAt NUMBER
          GENERATED ALWAYS AS (json_extract(json, '$.createdAt'));
      
      CREATE INDEX preKeys_date
        ON preKeys (ourServiceId, createdAt);
    `);
    logger.info('updateToSchemaVersion91: Temporary index created');

    // Fetch 500th-oldest timestamp for PNI

    const [oldQuery, oldParams] = sql`
      SELECT createdAt
      FROM preKeys
      WHERE 
        createdAt IS NOT NULL AND
        ourServiceId = ${pni}
      ORDER BY createdAt ASC
      LIMIT 1
      OFFSET 499
    `;
    const oldBoundary = db.prepare(oldQuery).pluck(true).get(oldParams);
    logger.info(
      `updateToSchemaVersion91: Found 500th-oldest timestamp: ${oldBoundary}`
    );

    // Fetch 500th-newest timestamp for PNI

    const [newQuery, newParams] = sql`
      SELECT createdAt
      FROM preKeys
      WHERE 
        createdAt IS NOT NULL AND
        ourServiceId = ${pni}
      ORDER BY createdAt DESC
      LIMIT 1
      OFFSET 499
    `;
    const newBoundary = db.prepare(newQuery).pluck(true).get(newParams);
    logger.info(
      `updateToSchemaVersion91: Found 500th-newest timestamp: ${newBoundary}`
    );

    // Delete everything in between for PNI

    let result: RunResult;
    const [deleteQuery, deleteParams] = sql`
      DELETE FROM preKeys
      WHERE rowid IN (
        SELECT rowid FROM preKeys
        WHERE
          createdAt IS NOT NULL AND
          createdAt > ${oldBoundary} AND 
          createdAt < ${newBoundary} AND
          ourServiceId = ${pni}
        LIMIT 10000
      );
    `;
    const preparedQuery = db.prepare(deleteQuery);
    do {
      result = preparedQuery.run(deleteParams);
      logger.info(`updateToSchemaVersion91: Deleted ${result.changes} items`);
    } while (result.changes > 0);
    logger.info('updateToSchemaVersion91: Delete is complete!');

    // Get updated count for PNI

    const [afterQuery, afterParams] = sql`
      SELECT count(*)
      FROM preKeys
      WHERE ourServiceId = ${pni};
    `;
    const afterCount = db.prepare(afterQuery).pluck(true).get(afterParams);
    logger.info(
      `updateToSchemaVersion91: Found ${afterCount} preKeys for PNI after delete`
    );

    db.exec(`
      DROP INDEX preKeys_date;
      ALTER TABLE preKeys DROP COLUMN createdAt;
    `);

    db.pragma('user_version = 91');
  })();

  logger.info('updateToSchemaVersion91: success!');
}
