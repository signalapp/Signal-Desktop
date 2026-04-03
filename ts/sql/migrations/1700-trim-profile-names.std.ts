// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import z from 'zod';

import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';
import { safeParseUnknown } from '../../util/schemas.std.ts';

function normalizeProfileName(
  profileName: string | undefined | null
): string | undefined {
  return profileName?.trim() || undefined;
}

const toNormalizedProfileName = z
  .string()
  .nullish()
  .transform(normalizeProfileName);

const ConversationJSONSchema = z
  .object({
    profileName: toNormalizedProfileName,
    profileFamilyName: toNormalizedProfileName,
  })
  .passthrough();

export default function updateToSchemaVersion1700(
  db: WritableDB,
  logger: LoggerType
): void {
  const rows: Array<{
    id: string;
    json: string;
    profileName: string | null;
    profileFamilyName: string | null;
  }> = db.prepare('SELECT * FROM conversations').all();

  const update = db.prepare(`
    UPDATE conversations
    SET
      json = $json,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName
    WHERE
      id is $id
  `);

  let changes = 0;
  for (const row of rows) {
    const parseResult = safeParseUnknown(
      ConversationJSONSchema,
      JSON.parse(row.json) as unknown
    );
    if (!parseResult.success) {
      logger.warn(
        `failed to parse conversation json ${row.id}`,
        parseResult.error
      );
      continue;
    }

    const { profileName, profileFamilyName } = parseResult.data;

    if (
      profileName === (row.profileName ?? undefined) &&
      profileFamilyName === (row.profileFamilyName ?? undefined)
    ) {
      continue;
    }

    const json = JSON.stringify(parseResult.data);

    changes += 1;
    update.run({
      id: row.id,
      json,
      profileName: profileName ?? null,
      profileFamilyName: profileFamilyName ?? null,
    });
  }

  if (changes > 0) {
    logger.warn(`fixed ${changes} conversation(s)`);
  }
}
