// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database, RunResult } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { UUIDStringType } from '../../types/UUID';
import { normalizeUuid } from '../../util/normalizeUuid';
import * as Errors from '../../types/errors';

export default function updateToSchemaVersion87(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 87) {
    return;
  }

  db.transaction(() => {
    // Do overall count - if it's less than 1000, move on

    const totalKeys = db
      .prepare('SELECT count(*) FROM preKeys;')
      .pluck(true)
      .get();
    logger.info(`updateToSchemaVersion87: Found ${totalKeys} keys`);
    if (totalKeys < 1000) {
      db.pragma('user_version = 87');
      return;
    }

    // Grab our PNI

    let pni: UUIDStringType;
    const pniJson = db
      .prepare("SELECT json FROM items WHERE id IS 'pni'")
      .pluck()
      .get();
    try {
      const pniData = JSON.parse(pniJson);
      pni = normalizeUuid(pniData.value, 'updateToSchemaVersion87');
    } catch (error) {
      db.pragma('user_version = 87');
      if (pniJson) {
        logger.warn(
          'updateToSchemaVersion87: PNI found but did not parse',
          Errors.toLogFormat(error)
        );
      } else {
        logger.info('updateToSchemaVersion87: Our PNI not found');
      }
      return;
    }

    // Grab PNI-specific count - if it's less than 1000, move on

    const [
      beforeQuery,
      beforeParams,
    ] = sql`SELECT count(*) from preKeys WHERE ourUuid = ${pni}`;
    const beforeKeys = db.prepare(beforeQuery).pluck(true).get(beforeParams);
    logger.info(`updateToSchemaVersion87: Found ${beforeKeys} preKeys for PNI`);

    // Create index to help us with all these queries

    db.exec(`
      ALTER TABLE preKeys
      ADD COLUMN createdAt NUMBER
      GENERATED ALWAYS AS (json_extract(json, '$.createdAt'));
      
      CREATE INDEX preKeys_date
      ON preKeys (ourUuid, createdAt);
      `);
    logger.info('updateToSchemaVersion87: Temporary index created');

    // Fetch 500th-oldest timestamp for PNI

    const [oldQuery, oldParams] = sql`
      SELECT createdAt
      FROM preKeys
      WHERE 
        createdAt IS NOT NULL AND
        ourUuid = ${pni}
      ORDER BY createdAt ASC
      LIMIT 1
      OFFSET 499
    `;
    const oldBoundary = db.prepare(oldQuery).pluck(true).get(oldParams);
    logger.info(
      `updateToSchemaVersion87: Found 500th-oldest timestamp: ${oldBoundary}`
    );

    // Fetch 500th-newest timestamp for PNI

    const [newQuery, newParams] = sql`
      SELECT createdAt
      FROM preKeys
      WHERE 
        createdAt IS NOT NULL AND
        ourUuid = ${pni}
      ORDER BY createdAt DESC
      LIMIT 1
      OFFSET 499
    `;
    const newBoundary = db.prepare(newQuery).pluck(true).get(newParams);
    logger.info(
      `updateToSchemaVersion87: Found 500th-newest timestamp: ${newBoundary}`
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
          ourUuid = ${pni}
        LIMIT 10000
      );
    `;
    const preparedQuery = db.prepare(deleteQuery);
    do {
      result = preparedQuery.run(deleteParams);
      logger.info(`updateToSchemaVersion87: Deleted ${result.changes} items`);
    } while (result.changes > 0);
    logger.info('updateToSchemaVersion87: Delete is complete!');

    // Get updated count for PNI

    const [afterQuery, afterParams] = sql`
      SELECT count(*)
      FROM preKeys
      WHERE ourUuid = ${pni};
    `;
    const afterCount = db.prepare(afterQuery).pluck(true).get(afterParams);
    logger.info(
      `updateToSchemaVersion87: Found ${afterCount} preKeys for PNI after delete`
    );

    db.exec(`
      DROP INDEX preKeys_date;
      ALTER TABLE preKeys DROP COLUMN createdAt;
    `);

    db.pragma('user_version = 87');
  })();

  logger.info('updateToSchemaVersion87: success!');
}
