// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database, RunResult } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import type { QueryFragment } from '../util';
import type { PniString } from '../../types/ServiceId';

import { sql, sqlFragment } from '../util';
import { normalizePni } from '../../types/ServiceId';
import * as Errors from '../../types/errors';

export const version = 920;

export function updateToSchemaVersion920(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 920) {
    return;
  }

  db.transaction(() => {
    cleanKeys(
      db,
      logger,
      'updateToSchemaVersion920/kyberPreKeys',
      sqlFragment`kyberPreKeys`,
      sqlFragment`createdAt`,
      sqlFragment`ourServiceId`
    );
    cleanKeys(
      db,
      logger,
      'updateToSchemaVersion920/signedPreKeys',
      sqlFragment`signedPreKeys`,
      sqlFragment`created_at`,
      sqlFragment`ourServiceId`
    );

    logger.info('updateToSchemaVersion920: Done with deletions');

    db.pragma('user_version = 920');
  })();

  logger.info(
    'updateToSchemaVersion920: user_version set to 920. Starting vacuum...'
  );
  db.exec('VACUUM;');
  logger.info('updateToSchemaVersion920: Vacuum complete.');

  logger.info('updateToSchemaVersion920: success!');
}

export function cleanKeys(
  db: Database,
  logger: LoggerType,
  logId: string,
  tableName: QueryFragment,
  columnName: QueryFragment,
  idField: QueryFragment
): void {
  // Grab our PNI
  let pni: PniString;
  const pniJson = db
    .prepare("SELECT json FROM items WHERE id IS 'pni'")
    .pluck()
    .get();
  try {
    const pniData = JSON.parse(pniJson);
    pni = normalizePni(pniData.value, logId);
  } catch (error) {
    if (pniJson) {
      logger.warn(
        `${logId}: PNI found but did not parse`,
        Errors.toLogFormat(error)
      );
    } else {
      logger.info(`${logId}: Our PNI not found`);
    }
    return;
  }

  // Do overall count - if it's less than 1000, move on
  const totalKeys = db
    .prepare(sql`SELECT count(*) FROM ${tableName};`[0])
    .pluck(true)
    .get();
  logger.info(`${logId}: Found ${totalKeys} total keys`);
  if (totalKeys < 1000) {
    return;
  }

  // Grab PNI-specific count
  const [beforeQuery, beforeParams] =
    sql`SELECT count(*) from ${tableName} WHERE ${idField} = ${pni}`;
  const beforeKeys = db.prepare(beforeQuery).pluck(true).get(beforeParams);
  logger.info(`${logId}: Found ${beforeKeys} keys for PNI`);

  // Create index to help us with all these queries
  db.exec(
    sql`
      ALTER TABLE ${tableName}
        ADD COLUMN createdAt NUMBER
          GENERATED ALWAYS AS (json_extract(json, '$.${columnName}'));
      
      CREATE INDEX ${tableName}_date
        ON ${tableName} (${idField}, createdAt);
    `[0]
  );
  logger.info(`${logId}: Temporary index created`);

  // Fetch 500th-oldest timestamp for PNI
  const [oldQuery, oldParams] = sql`
    SELECT createdAt
    FROM ${tableName}
    WHERE 
      createdAt IS NOT NULL AND
      ${idField} = ${pni}
    ORDER BY createdAt ASC
    LIMIT 1
    OFFSET 499
  `;
  const oldBoundary = db.prepare(oldQuery).pluck(true).get(oldParams);
  logger.info(`${logId}: Found 500th-oldest timestamp: ${oldBoundary}`);

  // Fetch 500th-newest timestamp for PNI
  const [newQuery, newParams] = sql`
    SELECT createdAt
    FROM ${tableName}
    WHERE 
      createdAt IS NOT NULL AND
      ${idField} = ${pni}
    ORDER BY createdAt DESC
    LIMIT 1
    OFFSET 499
  `;
  const newBoundary = db.prepare(newQuery).pluck(true).get(newParams);
  logger.info(`${logId}: Found 500th-newest timestamp: ${newBoundary}`);

  // Delete everything in between for PNI
  let result: RunResult;
  const [deleteQuery, deleteParams] = sql`
    DELETE FROM ${tableName}
    WHERE
      createdAt IS NOT NULL AND
      createdAt > ${oldBoundary} AND 
      createdAt < ${newBoundary} AND
      ${idField} = ${pni}
    LIMIT 10000;
  `;
  const preparedQuery = db.prepare(deleteQuery);
  do {
    result = preparedQuery.run(deleteParams);
    logger.info(`${logId}: Deleted ${result.changes} keys`);
  } while (result.changes > 0);
  logger.info(`${logId}: Delete is complete!`);

  // Get updated count for PNI
  const [afterQuery, afterParams] = sql`
    SELECT count(*)
    FROM ${tableName}
    WHERE ${idField} = ${pni};
  `;
  const afterCount = db.prepare(afterQuery).pluck(true).get(afterParams);
  logger.info(`${logId}: Found ${afterCount} keys for PNI after delete`);

  db.exec(
    sql`
      DROP INDEX ${tableName}_date;
      ALTER TABLE ${tableName} DROP COLUMN createdAt;
    `[0]
  );
}
