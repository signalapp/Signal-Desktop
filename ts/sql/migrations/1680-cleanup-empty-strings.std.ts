// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import z from 'zod';

import type { WritableDB } from '../Interface.std.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { safeParseUnknown } from '../../util/schemas.std.js';

const toNullable = z
  .string()
  .or(z.null())
  .optional()
  .transform(value => value || undefined);

const ConversationSchema = z
  .object({
    e164: toNullable,
    name: toNullable,
    profileName: toNullable,
    profileFamilyName: toNullable,
    systemGivenName: toNullable,
    systemFamilyName: toNullable,
    systemNickname: toNullable,
    nicknameGivenName: toNullable,
    nicknameFamilyName: toNullable,
    username: toNullable,
  })
  .passthrough();

export default function updateToSchemaVersion1680(
  db: WritableDB,
  logger: LoggerType
): void {
  const rows: Array<{
    id: string;
    json: string;
    e164?: string;
    name?: string;
    profileName?: string;
    profileFamilyName?: string;
  }> = db.prepare('SELECT * FROM conversations').all();

  const update = db.prepare(`
    UPDATE conversations
    SET
      json = $json,
      e164 = $e164,
      name = $name,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName
    WHERE
      id is $id
  `);

  let changes = 0;
  for (const row of rows) {
    const parse = safeParseUnknown(
      ConversationSchema,
      JSON.parse(row.json) as unknown
    );
    if (!parse.success) {
      logger.warn(`failed to parse conversation json ${row.id}`, parse.error);
      continue;
    }

    const json = JSON.stringify(parse.data);

    const e164 = row.e164 || null;
    const name = row.name || null;
    const profileName = row.profileName || null;
    const profileFamilyName = row.profileFamilyName || null;

    if (
      json === row.json &&
      e164 === row.e164 &&
      name === row.name &&
      profileName === row.profileName &&
      profileFamilyName === row.profileFamilyName
    ) {
      continue;
    }

    changes += 1;
    update.run({
      id: row.id,
      json,
      e164,
      name,
      profileName,
      profileFamilyName,
    });
  }

  if (changes !== 0) {
    logger.warn(`fixed ${changes} conversations`);
  }
}
