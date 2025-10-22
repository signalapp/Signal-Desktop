// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.js';
import type { WritableDB } from '../Interface.js';
import { sql } from '../util.js';

export default function updateToSchemaVersion1490(
  db: WritableDB,
  logger: LoggerType
): void {
  const [query, params] = sql`
    DELETE FROM notificationProfiles
    WHERE id != lower(id);
  `;
  const result = db.prepare(query).run(params);

  logger.info(
    `Removed ${result.changes} notification profiles with non-lowercase ids`
  );
}
