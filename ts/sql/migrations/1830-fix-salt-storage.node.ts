// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'node:buffer';
import z from 'zod';

import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';

const bufferSchema = z.object({
  type: z.literal('buffer'),
  data: z.array(z.number().min(0).max(255)),
});

export default function updateToSchemaVersion1830(
  db: WritableDB,
  log: LoggerType
): void {
  const json = db
    .prepare(
      `
    SELECT json ->> '$.value' FROM items WHERE id IS 'authCredentialSalt'
  `,
      {
        pluck: true,
      }
    )
    .get();

  if (json == null) {
    return;
  }

  let data: z.infer<typeof bufferSchema>;
  try {
    data = bufferSchema.parse(JSON.parse(String(json)));
  } catch (error) {
    log.error('Failed to migrate auth credential salt', error);
    return;
  }

  db.prepare(
    `
    UPDATE items SET json = $json WHERE id IS 'authCredentialSalt'
  `
  ).run({
    json: JSON.stringify({
      id: 'authCredentialSalt',
      value: Buffer.from(data.data).toString('base64'),
    }),
  });

  log.info('Migrated authCredentialSalt to base64');
}
