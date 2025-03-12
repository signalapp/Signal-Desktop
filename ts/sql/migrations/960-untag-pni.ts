// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';
import type {
  ServiceIdString,
  AciString,
  PniString,
} from '../../types/ServiceId';
import { normalizePni } from '../../types/ServiceId';
import { normalizeAci } from '../../util/normalizeAci';
import type { JSONWithUnknownFields } from '../../types/Util';

export const version = 960;

export function updateToSchemaVersion960(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 960) {
    return;
  }

  db.transaction(() => {
    const ourServiceIds = migratePni(db, logger);
    if (!ourServiceIds) {
      logger.info('updateToSchemaVersion960: not running, pni is normalized');
      return;
    }

    // Migrate JSON fields
    db.prepare(
      `
        UPDATE conversations
        SET json = json_set(json, '$.pni', $pni)
        WHERE serviceId IS $aci
      `
    ).run({
      aci: ourServiceIds.aci,
      pni: ourServiceIds.pni,
    });

    migratePreKeys(db, 'preKeys', ourServiceIds, logger);
    migratePreKeys(db, 'signedPreKeys', ourServiceIds, logger);
    migratePreKeys(db, 'kyberPreKeys', ourServiceIds, logger);

    db.pragma('user_version = 960');
  })();

  logger.info('updateToSchemaVersion960: success!');
}

//
// migratePni checks if `pni` needs normalization:
//
// * If yes - return legacy and updated pni
// * It no - return undefined
//

type OurServiceIds = Readonly<{
  aci: AciString;
  legacyPni: string;
  pni: PniString;
}>;

function migratePni(
  db: Database,
  logger: LoggerType
): OurServiceIds | undefined {
  // Get our ACI and PNI
  const uuidIdJson = db
    .prepare(
      `
    SELECT json
    FROM items
    WHERE id IS 'uuid_id'
  `,
      {
        pluck: true,
      }
    )
    .get<string>();
  const pniJson = db
    .prepare(
      `
    SELECT json
    FROM items
    WHERE id IS 'pni'
  `,
      {
        pluck: true,
      }
    )
    .get<string>();

  let aci: string | undefined;
  try {
    [aci] = JSON.parse(uuidIdJson ?? '').value.split('.', 2);
  } catch (error) {
    if (uuidIdJson) {
      logger.warn(
        'updateToSchemaVersion960: failed to parse uuid_id item',
        error
      );
    } else {
      logger.info('updateToSchemaVersion960: Our ACI not found');
    }
  }
  if (!aci) {
    return undefined;
  }

  let legacyPni: string | undefined;
  try {
    legacyPni = JSON.parse(pniJson ?? '').value;
  } catch (error) {
    if (pniJson) {
      logger.warn('updateToSchemaVersion960: failed to parse pni item', error);
    } else {
      logger.info('updateToSchemaVersion960: Our PNI not found');
    }
  }
  if (!legacyPni) {
    return undefined;
  }

  const pni = prefixPni(legacyPni, 'pni', logger);
  if (!pni || pni === legacyPni) {
    return undefined;
  }

  const maps: Array<{ id: string; json: string }> = db
    .prepare(
      `
      SELECT id, json
      FROM items
      WHERE id IN ('identityKeyMap', 'registrationIdMap');
    `
    )
    .all();

  const updateStmt = db.prepare(
    'UPDATE items SET json = $json WHERE id IS $id'
  );

  updateStmt.run({
    id: 'pni',
    json: JSON.stringify({ id: 'pni', value: pni }),
  });

  for (const { id, json } of maps) {
    try {
      const data: { id: string; value: Record<string, unknown> } =
        JSON.parse(json);

      const pniValue = data.value[legacyPni];
      if (pniValue) {
        delete data.value[legacyPni];
        data.value[pni] = pniValue;
      }

      updateStmt.run({ id, json: JSON.stringify(data) });
    } catch (error) {
      logger.warn(
        `updateToSchemaVersion960: failed to parse ${id} item`,
        error
      );
    }
  }
  return {
    aci: normalizeAci(aci, 'uuid_id', logger),
    pni,
    legacyPni,
  };
}

// migratePreKeys does the following:
//
// 1. Update `ourServiceId` to prefixed PNI
// 2. Update `id` to use new `ourServiceId` value
//    (the schema is `${ourServiceId}:${keyId}`)
//

function migratePreKeys(
  db: Database,
  table: string,
  { legacyPni, pni }: OurServiceIds,
  logger: LoggerType
): void {
  const preKeys = db
    .prepare(`SELECT id, json FROM ${table} WHERE ourServiceId IS $legacyPni`)
    .all<{ id: string; json: string }>({ legacyPni });

  const updateStmt = db.prepare(`
    UPDATE ${table}
    SET id = $newId, json = $newJson
    WHERE id = $id
  `);

  logger.info(`updateToSchemaVersion960: updating ${preKeys.length} ${table}`);
  for (const { id, json } of preKeys) {
    const match = id.match(/^(.*):(.*)$/);
    if (!match) {
      logger.warn(`updateToSchemaVersion960: invalid ${table} id ${id}`);
      continue;
    }

    let legacyData: JSONWithUnknownFields<Record<string, unknown>>;
    try {
      legacyData = JSON.parse(json);
    } catch (error) {
      logger.warn(
        `updateToSchemaVersion960: failed to parse ${table} ${id}`,
        error
      );
      continue;
    }

    const [, ourServiceId, keyId] = match;
    if (ourServiceId !== legacyPni) {
      logger.warn(
        'updateToSchemaVersion960: unexpected ourServiceId',
        ourServiceId,
        legacyPni
      );
      continue;
    }

    const newId = `${pni}:${keyId}`;

    const newData: JSONWithUnknownFields<{
      id: string;
      ourServiceId: ServiceIdString;
    }> = {
      ...legacyData,
      id: newId,
      ourServiceId: pni,
    };

    updateStmt.run({
      id,
      newId,
      newJson: JSON.stringify(newData),
    });
  }
}

//
// Various utility methods below.
//

function prefixPni(
  legacyPni: string | null | undefined,
  context: string,
  logger: LoggerType
): PniString | undefined {
  if (legacyPni == null) {
    return undefined;
  }

  if (legacyPni.toLowerCase().startsWith('pni:')) {
    return normalizePni(legacyPni, context, logger);
  }

  return normalizePni(`PNI:${legacyPni}`, context, logger);
}
