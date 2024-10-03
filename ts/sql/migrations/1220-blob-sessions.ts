// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'assert';
import z from 'zod';
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import * as Errors from '../../types/errors';
import {
  sessionRecordToProtobuf,
  sessionStructureToBytes,
} from '../../util/sessionTranslation';
import { getOwn } from '../../util/getOwn';
import { missingCaseError } from '../../util/missingCaseError';

export const version = 1220;

const identityKeyMapSchema = z.record(
  z.string(),
  z.object({
    privKey: z.string().transform(x => Buffer.from(x, 'base64')),
    pubKey: z.string().transform(x => Buffer.from(x, 'base64')),
  })
);

const registrationIdMapSchema = z.record(z.string(), z.number());

type PreviousSessionRowType = Readonly<{
  id: string;
  conversationId: string;
  ourServiceId: string;
  serviceId: string;
  json: string;
}>;

const previousSessionJsonSchema = z.object({
  id: z.string(),
  ourServiceId: z.string(),
  serviceId: z.string(),
  conversationId: z.string(),
  deviceId: z.number(),
  record: z.string(),
  version: z.literal(1).or(z.literal(2)),
});

type NextSessionRowType = Readonly<{
  id: string;
  conversationId: string;
  ourServiceId: string;
  serviceId: string;
  deviceId: number;
  record: Buffer;
}>;

function migrateSession(
  row: PreviousSessionRowType,
  identityKeyMap: z.infer<typeof identityKeyMapSchema>,
  registrationIdMap: z.infer<typeof registrationIdMapSchema>,
  logger: LoggerType
): NextSessionRowType {
  const { id, conversationId, ourServiceId, serviceId, json } = row;
  const session = previousSessionJsonSchema.parse(JSON.parse(json));

  assert.strictEqual(session.id, id, 'Invalid id');
  assert.strictEqual(
    session.conversationId,
    conversationId,
    'Invalid conversationId'
  );
  assert.strictEqual(
    session.ourServiceId,
    ourServiceId,
    'Invalid ourServiceId,'
  );
  assert.strictEqual(session.serviceId, serviceId, 'Invalid serviceId');

  // Previously migrated session
  if (session.version === 2) {
    return {
      id,
      conversationId,
      ourServiceId,
      serviceId,
      deviceId: session.deviceId,
      record: Buffer.from(session.record, 'base64'),
    };
  }

  if (session.version === 1) {
    const keyPair = getOwn(identityKeyMap, ourServiceId);
    if (!keyPair) {
      throw new Error('migrateSession: No identity key for ourself!');
    }

    const localRegistrationId = getOwn(registrationIdMap, ourServiceId);
    if (localRegistrationId == null) {
      throw new Error('_maybeMigrateSession: No registration id for ourself!');
    }

    const localUserData = {
      identityKeyPublic: keyPair.pubKey,
      registrationId: localRegistrationId,
    };

    logger.info(`migrateSession: Migrating session with id ${id}`);
    const sessionProto = sessionRecordToProtobuf(
      JSON.parse(session.record),
      localUserData
    );

    return {
      id,
      conversationId,
      ourServiceId,
      serviceId,
      deviceId: session.deviceId,
      record: Buffer.from(sessionStructureToBytes(sessionProto)),
    };
  }

  throw missingCaseError(session.version);
}

export function updateToSchemaVersion1220(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1220) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE sessions
        RENAME TO old_sessions;

      CREATE TABLE sessions (
        id TEXT NOT NULL PRIMARY KEY,
        ourServiceId TEXT NOT NULL,
        serviceId TEXT NOT NULL,
        conversationId TEXT NOT NULL,
        deviceId INTEGER NOT NULL,
        record BLOB NOT NULL
      ) STRICT;
    `);

    const getItem = db
      .prepare(
        `
          SELECT json -> '$.value' FROM items WHERE id IS ?
        `
      )
      .pluck();

    const identityKeyMapJson = getItem.get('identityKeyMap');
    const registrationIdMapJson = getItem.get('registrationIdMap');

    // If we don't have private keys - the sessions cannot be used anyway
    if (!identityKeyMapJson || !registrationIdMapJson) {
      logger.info('updateToSchemaVersion1220: no identity/registration id');
      db.exec('DROP TABLE old_sessions');
      db.pragma('user_version = 1220');
      return;
    }

    const identityKeyMap = identityKeyMapSchema.parse(
      JSON.parse(identityKeyMapJson)
    );
    const registrationIdMap = registrationIdMapSchema.parse(
      JSON.parse(registrationIdMapJson)
    );

    const getSessionsPage = db.prepare(
      'DELETE FROM old_sessions RETURNING * LIMIT 1000'
    );
    const insertSession = db.prepare(`
      INSERT INTO sessions
      (id, ourServiceId, serviceId, conversationId, deviceId, record)
      VALUES
      ($id, $ourServiceId, $serviceId, $conversationId, $deviceId, $record)
    `);

    let migrated = 0;
    let failed = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows: Array<PreviousSessionRowType> = getSessionsPage.all();
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        try {
          insertSession.run(
            migrateSession(row, identityKeyMap, registrationIdMap, logger)
          );
          migrated += 1;
        } catch (error) {
          failed += 1;
          logger.error(
            'updateToSchemaVersion1220: failed to migrate session',
            Errors.toLogFormat(error)
          );
        }
      }
    }

    logger.info(
      `updateToSchemaVersion1220: migrated ${migrated} sessions, ` +
        `${failed} failed`
    );

    db.exec('DROP TABLE old_sessions');
    db.pragma('user_version = 1220');
  })();
  logger.info('updateToSchemaVersion1220: success!');
}
