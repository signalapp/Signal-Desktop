// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';

const AudioDeviceLegacySchema = z.object({
  name: z.string(),
  index: z.number(),
  uniqueId: z.string(),
});

type AudioDevicePref =
  | {
      type: 'nonWindowsDefault' | 'windowsConsole' | 'windowsCommunications';
    }
  | {
      type: 'specificDevice';
      device: {
        name: string;
        uniqueId: string;
      };
    };

function legacyToNewPref(
  old: z.infer<typeof AudioDeviceLegacySchema>
): AudioDevicePref {
  if (old.index === 0) {
    if (process.platform !== 'win32') {
      return { type: 'nonWindowsDefault' };
    }
    // See https://github.com/signalapp/ringrtc/blob/384327a9b49f1cea75f5e378e0c04b96a01d5aee/src/rust/src/webrtc/peer_connection_factory.rs#L561-L572
    return { type: 'windowsCommunications' };
  } else if (process.platform === 'win32' && old.index === 1) {
    // In theory, this might be wrong: If there had only been 1 device, we
    // previously would have treated index 1 as invalid and searched by ID.
    // However, at this point, we have not enumerated devices, so we cannot know
    // whether that's true. Just assume the console was what was intended.
    return { type: 'windowsConsole' };
  }

  return {
    type: 'specificDevice',
    device: {
      name: old.name,
      uniqueId: old.uniqueId,
    },
  };
}

export default function updateToSchemaVersion1840(
  db: WritableDB,
  log: LoggerType
): void {
  const SETTING_IDS = [
    'preferred-audio-input-device',
    'preferred-audio-output-device',
  ];

  const getStmt = db.prepare(
    `
        SELECT json ->> '$.value' FROM items WHERE id IS $id
      `,
    {
      pluck: true,
    }
  );

  const updateStmt = db.prepare(
    `
        UPDATE items SET json = $json WHERE id IS $id
      `
  );

  for (const id of SETTING_IDS) {
    const json = getStmt.get({ id });
    if (json == null) {
      continue;
    }

    let legacy: z.infer<typeof AudioDeviceLegacySchema>;
    try {
      legacy = AudioDeviceLegacySchema.parse(JSON.parse(String(json)));
    } catch (error) {
      log.error(`Failed to parse ${id}`, error);
      continue;
    }

    updateStmt.run({
      id,
      json: JSON.stringify({
        id,
        value: legacyToNewPref(legacy),
      }),
    });
  }
}
