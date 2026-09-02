// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sql } from '../util.std.ts';

import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';

export default function updateToSchemaVersion1800(
  db: WritableDB,
  logger: LoggerType
): void {
  db.exec(`
    ALTER TABLE defunctCallLinks
    ADD COLUMN addedAt INTEGER;
  `);

  const [deleteQuery] = sql`
    DELETE FROM defunctCallLinks
    WHERE adminKey IS NULL AND storageID IS NULL;
  `;
  const deleteResult = db.prepare(deleteQuery).run();
  logger.info(
    `updateToSchemaVersion1800: Deleted ${deleteResult.changes} defunct call links`
  );

  const now = Date.now();
  const [updateQuery, updateParams] = sql`
    UPDATE defunctCallLinks
    SET addedAt = ${now}, storageNeedsSync = 1
  `;
  const updateResult = db.prepare(updateQuery).run(updateParams);
  logger.info(
    `updateToSchemaVersion1800: Updated ${updateResult.changes} defunct call links`
  );

  db.exec(`
    ALTER TABLE defunctCallLinks
    ALTER COLUMN addedAt SET NOT NULL;
  `);

  db.exec(`
    CREATE INDEX defunctCallLinks_expiring ON defunctCallLinks(addedAt);
  `);
  db.exec(`
    CREATE INDEX callLinks_expiring ON callLinks(deletedAt);
  `);
}
