// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { isValidUuid } from '../../util/isValidUuid';
import Helpers from '../../textsecure/Helpers';
import { createOrUpdate, getById, removeById } from '../util';
import type { EmptyQuery, Query } from '../util';
import type { ItemKeyType, ReadableDB, WritableDB } from '../Interface';

export function getOurUuid(db: ReadableDB): string | undefined {
  const UUID_ID: ItemKeyType = 'uuid_id';

  const row: { json: string } | undefined = db
    .prepare<Query>('SELECT json FROM items WHERE id = $id;')
    .get({ id: UUID_ID });

  if (!row) {
    return undefined;
  }

  const { value } = JSON.parse(row.json);

  const [ourUuid] = Helpers.unencodeNumber(String(value).toLowerCase());
  return ourUuid;
}

export default function updateToSchemaVersion41(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 41) {
    return;
  }

  const getConversationUuid = db
    .prepare<Query>(
      `
      SELECT uuid
      FROM
        conversations
      WHERE
        id = $conversationId
      `
    )
    .pluck();

  const getConversationStats = db.prepare<Query>(
    `
      SELECT uuid, e164, active_at
      FROM
        conversations
      WHERE
        id = $conversationId
    `
  );

  const compareConvoRecency = (a: string, b: string): number => {
    const aStats = getConversationStats.get({ conversationId: a });
    const bStats = getConversationStats.get({ conversationId: b });

    const isAComplete = Boolean(aStats?.uuid && aStats?.e164);
    const isBComplete = Boolean(bStats?.uuid && bStats?.e164);

    if (!isAComplete && !isBComplete) {
      return 0;
    }
    if (!isAComplete) {
      return -1;
    }
    if (!isBComplete) {
      return 1;
    }

    return aStats.active_at - bStats.active_at;
  };

  const clearSessionsAndKeys = (): number => {
    // ts/background.ts will ask user to relink so all that matters here is
    // to maintain an invariant:
    //
    // After this migration all sessions and keys are prefixed by
    // "uuid:".
    const keyCount = [
      db.prepare('DELETE FROM senderKeys').run().changes,
      db.prepare('DELETE FROM sessions').run().changes,
      db.prepare('DELETE FROM signedPreKeys').run().changes,
      db.prepare('DELETE FROM preKeys').run().changes,
    ].reduce((a: number, b: number): number => a + b);

    removeById<string>(db, 'items', 'identityKey');
    removeById<string>(db, 'items', 'registrationId');

    return keyCount;
  };

  const moveIdentityKeyToMap = (ourUuid: string) => {
    type IdentityKeyType = {
      privKey: string;
      publicKey: string;
    };

    const identityKey = getById<string, { value: IdentityKeyType }>(
      db,
      'items',
      'identityKey'
    );
    type RegistrationId = number;

    const registrationId = getById<string, { value: RegistrationId }>(
      db,
      'items',
      'registrationId'
    );
    if (identityKey) {
      createOrUpdate<ItemKeyType>(db, 'items', {
        id: 'identityKeyMap',
        value: {
          [ourUuid]: identityKey.value,
        },
      });
    }

    if (registrationId) {
      createOrUpdate<ItemKeyType>(db, 'items', {
        id: 'registrationIdMap',
        value: {
          [ourUuid]: registrationId.value,
        },
      });
    }

    db.exec(
      `
      DELETE FROM items WHERE id = 'identityKey' OR id = 'registrationId';
      `
    );
  };

  const prefixKeys = (ourUuid: string) => {
    for (const table of ['signedPreKeys', 'preKeys']) {
      // Update id to include suffix, add `ourUuid` and `keyId` fields.
      db.prepare<Query>(
        `
        UPDATE ${table}
        SET
          id = $ourUuid || ':' || id,
          json = json_set(
            json,
            '$.id',
            $ourUuid || ':' || json_extract(json, '$.id'),
            '$.keyId',
            json_extract(json, '$.id'),
            '$.ourUuid',
            $ourUuid
          )
        `
      ).run({ ourUuid });
    }
  };

  const updateSenderKeys = (ourUuid: string) => {
    const senderKeys: ReadonlyArray<{
      id: string;
      senderId: string;
      lastUpdatedDate: number;
    }> = db
      .prepare<EmptyQuery>(
        'SELECT id, senderId, lastUpdatedDate FROM senderKeys'
      )
      .all();

    logger.info(`Updating ${senderKeys.length} sender keys`);

    const updateSenderKey = db.prepare<Query>(
      `
      UPDATE senderKeys
      SET
        id = $newId,
        senderId = $newSenderId
      WHERE
        id = $id
      `
    );

    const deleteSenderKey = db.prepare<Query>(
      'DELETE FROM senderKeys WHERE id = $id'
    );

    const pastKeys = new Map<
      string,
      {
        conversationId: string;
        lastUpdatedDate: number;
      }
    >();

    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    for (const { id, senderId, lastUpdatedDate } of senderKeys) {
      const [conversationId] = Helpers.unencodeNumber(senderId);
      const uuid = getConversationUuid.get({ conversationId });

      if (!uuid) {
        deleted += 1;
        deleteSenderKey.run({ id });
        continue;
      }

      const newId = `${ourUuid}:${id.replace(conversationId, uuid)}`;

      const existing = pastKeys.get(newId);

      // We are going to delete on of the keys anyway
      if (existing) {
        skipped += 1;
      } else {
        updated += 1;
      }

      const isOlder =
        existing &&
        (lastUpdatedDate < existing.lastUpdatedDate ||
          compareConvoRecency(conversationId, existing.conversationId) < 0);
      if (isOlder) {
        deleteSenderKey.run({ id });
        continue;
      } else if (existing) {
        deleteSenderKey.run({ id: newId });
      }

      pastKeys.set(newId, { conversationId, lastUpdatedDate });

      updateSenderKey.run({
        id,
        newId,
        newSenderId: `${senderId.replace(conversationId, uuid)}`,
      });
    }

    logger.info(
      `Updated ${senderKeys.length} sender keys: ` +
        `updated: ${updated}, deleted: ${deleted}, skipped: ${skipped}`
    );
  };

  const updateSessions = (ourUuid: string) => {
    // Use uuid instead of conversation id in existing sessions and prefix id
    // with ourUuid.
    //
    // Set ourUuid column and field in json
    const allSessions = db
      .prepare<EmptyQuery>('SELECT id, conversationId FROM SESSIONS')
      .all();

    logger.info(`Updating ${allSessions.length} sessions`);

    const updateSession = db.prepare<Query>(
      `
      UPDATE sessions
      SET
        id = $newId,
        ourUuid = $ourUuid,
        uuid = $uuid,
        json = json_set(
          sessions.json,
          '$.id',
          $newId,
          '$.uuid',
          $uuid,
          '$.ourUuid',
          $ourUuid
        )
      WHERE
        id = $id
      `
    );

    const deleteSession = db.prepare<Query>(
      'DELETE FROM sessions WHERE id = $id'
    );

    const pastSessions = new Map<
      string,
      {
        conversationId: string;
      }
    >();

    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    for (const { id, conversationId } of allSessions) {
      const uuid = getConversationUuid.get({ conversationId });
      if (!uuid) {
        deleted += 1;
        deleteSession.run({ id });
        continue;
      }

      const newId = `${ourUuid}:${id.replace(conversationId, uuid)}`;

      const existing = pastSessions.get(newId);

      // We are going to delete on of the keys anyway
      if (existing) {
        skipped += 1;
      } else {
        updated += 1;
      }

      const isOlder =
        existing &&
        compareConvoRecency(conversationId, existing.conversationId) < 0;
      if (isOlder) {
        deleteSession.run({ id });
        continue;
      } else if (existing) {
        deleteSession.run({ id: newId });
      }

      pastSessions.set(newId, { conversationId });

      updateSession.run({
        id,
        newId,
        uuid,
        ourUuid,
      });
    }

    logger.info(
      `Updated ${allSessions.length} sessions: ` +
        `updated: ${updated}, deleted: ${deleted}, skipped: ${skipped}`
    );
  };

  const updateIdentityKeys = () => {
    const identityKeys: ReadonlyArray<{
      id: string;
    }> = db.prepare<EmptyQuery>('SELECT id FROM identityKeys').all();

    logger.info(`Updating ${identityKeys.length} identity keys`);

    const updateIdentityKey = db.prepare<Query>(
      `
      UPDATE OR REPLACE identityKeys
      SET
        id = $newId,
        json = json_set(
          identityKeys.json,
          '$.id',
          $newId
        )
      WHERE
        id = $id
      `
    );

    let migrated = 0;
    for (const { id } of identityKeys) {
      const uuid = getConversationUuid.get({ conversationId: id });

      let newId: string;
      if (uuid) {
        migrated += 1;
        newId = uuid;
      } else {
        newId = `conversation:${id}`;
      }

      updateIdentityKey.run({ id, newId });
    }

    logger.info(`Migrated ${migrated} identity keys`);
  };

  db.transaction(() => {
    db.exec(
      `
      -- Change type of 'id' column from INTEGER to STRING

      ALTER TABLE preKeys
      RENAME TO old_preKeys;

      ALTER TABLE signedPreKeys
      RENAME TO old_signedPreKeys;

      CREATE TABLE preKeys(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );
      CREATE TABLE signedPreKeys(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );

      -- sqlite handles the type conversion
      INSERT INTO preKeys SELECT * FROM old_preKeys;
      INSERT INTO signedPreKeys SELECT * FROM old_signedPreKeys;

      DROP TABLE old_preKeys;
      DROP TABLE old_signedPreKeys;

      -- Alter sessions

      ALTER TABLE sessions
        ADD COLUMN ourUuid STRING;

      ALTER TABLE sessions
        ADD COLUMN uuid STRING;
      `
    );

    const ourUuid = getOurUuid(db);

    if (!isValidUuid(ourUuid)) {
      const deleteCount = clearSessionsAndKeys();

      if (deleteCount > 0) {
        logger.error(
          'updateToSchemaVersion41: no uuid is available, ' +
            `erased ${deleteCount} sessions/keys`
        );
      }

      db.pragma('user_version = 41');
      return;
    }

    prefixKeys(ourUuid);

    updateSenderKeys(ourUuid);

    updateSessions(ourUuid);

    moveIdentityKeyToMap(ourUuid);

    updateIdentityKeys();

    db.pragma('user_version = 41');
  })();
  logger.info('updateToSchemaVersion41: success!');
}
