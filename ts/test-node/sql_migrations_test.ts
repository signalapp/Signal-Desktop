// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import SQL, { Database } from 'better-sqlite3';
import { v4 as generateGuid } from 'uuid';

import { SCHEMA_VERSIONS } from '../sql/Server';

const OUR_UUID = generateGuid();

describe('SQL migrations test', () => {
  let db: Database;

  const updateToVersion = (version: number) => {
    const startVersion = db.pragma('user_version', { simple: true });

    for (const run of SCHEMA_VERSIONS) {
      run(startVersion, db);

      const currentVersion = db.pragma('user_version', { simple: true });

      if (currentVersion === version) {
        return;
      }
    }

    throw new Error(`Migration to ${version} not found`);
  };

  const addOurUuid = () => {
    const value = {
      id: 'uuid_id',
      value: `${OUR_UUID}.1`,
    };
    db.exec(
      `
      INSERT INTO items (id, json) VALUES
        ('uuid_id', '${JSON.stringify(value)}');
      `
    );
  };

  const parseItems = (
    items: ReadonlyArray<{ json: string }>
  ): Array<unknown> => {
    return items.map(item => {
      return {
        ...item,
        json: JSON.parse(item.json),
      };
    });
  };

  const insertSession = (
    conversationId: string,
    deviceId: number,
    data: Record<string, unknown> = {}
  ): void => {
    const id = `${conversationId}.${deviceId}`;
    db.prepare(
      `
        INSERT INTO sessions (id, conversationId, json)
        VALUES ($id, $conversationId, $json)
      `
    ).run({
      id,
      conversationId,
      json: JSON.stringify({
        ...data,
        id,
        conversationId,
      }),
    });
  };

  beforeEach(() => {
    db = new SQL(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('updateToSchemaVersion41', () => {
    const THEIR_UUID = generateGuid();
    const THEIR_CONVO = generateGuid();
    const ANOTHER_CONVO = generateGuid();
    const THIRD_CONVO = generateGuid();

    it('clears sessions and keys if UUID is not available', () => {
      updateToVersion(40);

      db.exec(
        `
        INSERT INTO senderKeys
          (id, senderId, distributionId, data, lastUpdatedDate)
          VALUES
          ('1', '1', '1', '1', 1);
        INSERT INTO sessions (id, conversationId, json) VALUES
          ('1', '1', '{}');
        INSERT INTO signedPreKeys (id, json) VALUES
          ('1', '{}');
        INSERT INTO preKeys (id, json) VALUES
          ('1', '{}');
        INSERT INTO items (id, json) VALUES
          ('identityKey', '{}'),
          ('registrationId', '{}');
        `
      );

      const senderKeyCount = db
        .prepare('SELECT COUNT(*) FROM senderKeys')
        .pluck();
      const sessionCount = db.prepare('SELECT COUNT(*) FROM sessions').pluck();
      const signedPreKeyCount = db
        .prepare('SELECT COUNT(*) FROM signedPreKeys')
        .pluck();
      const preKeyCount = db.prepare('SELECT COUNT(*) FROM preKeys').pluck();
      const itemCount = db.prepare('SELECT COUNT(*) FROM items').pluck();

      assert.strictEqual(senderKeyCount.get(), 1);
      assert.strictEqual(sessionCount.get(), 1);
      assert.strictEqual(signedPreKeyCount.get(), 1);
      assert.strictEqual(preKeyCount.get(), 1);
      assert.strictEqual(itemCount.get(), 2);

      updateToVersion(41);

      assert.strictEqual(senderKeyCount.get(), 0);
      assert.strictEqual(sessionCount.get(), 0);
      assert.strictEqual(signedPreKeyCount.get(), 0);
      assert.strictEqual(preKeyCount.get(), 0);
      assert.strictEqual(itemCount.get(), 0);
    });

    it('adds prefix to preKeys/signedPreKeys', () => {
      updateToVersion(40);

      addOurUuid();

      const signedKeyItem = { id: 1 };
      const preKeyItem = { id: 2 };

      db.exec(
        `
        INSERT INTO signedPreKeys (id, json) VALUES
          (1, '${JSON.stringify(signedKeyItem)}');
        INSERT INTO preKeys (id, json) VALUES
          (2, '${JSON.stringify(preKeyItem)}');
        `
      );

      updateToVersion(41);

      assert.deepStrictEqual(
        parseItems(db.prepare('SELECT * FROM signedPreKeys').all()),
        [
          {
            id: `${OUR_UUID}:1`,
            json: {
              id: `${OUR_UUID}:1`,
              keyId: 1,
              ourUuid: OUR_UUID,
            },
          },
        ]
      );
      assert.deepStrictEqual(
        parseItems(db.prepare('SELECT * FROM preKeys').all()),
        [
          {
            id: `${OUR_UUID}:2`,
            json: {
              id: `${OUR_UUID}:2`,
              keyId: 2,
              ourUuid: OUR_UUID,
            },
          },
        ]
      );
    });

    it('migrates senderKeys', () => {
      updateToVersion(40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id, uuid) VALUES
          ('${THEIR_CONVO}', '${THEIR_UUID}');

        INSERT INTO senderKeys
          (id, senderId, distributionId, data, lastUpdatedDate)
          VALUES
          ('${THEIR_CONVO}.1--234', '${THEIR_CONVO}.1', '234', '1', 1);
        `
      );

      updateToVersion(41);

      assert.deepStrictEqual(db.prepare('SELECT * FROM senderKeys').all(), [
        {
          id: `${OUR_UUID}:${THEIR_UUID}.1--234`,
          distributionId: '234',
          data: '1',
          lastUpdatedDate: 1,
          senderId: `${THEIR_UUID}.1`,
        },
      ]);
    });

    it('removes senderKeys that do not have conversation uuid', () => {
      updateToVersion(40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id) VALUES
          ('${THEIR_CONVO}');

        INSERT INTO senderKeys
          (id, senderId, distributionId, data, lastUpdatedDate)
          VALUES
          ('${THEIR_CONVO}.1--234', '${THEIR_CONVO}.1', '234', '1', 1),
          ('${ANOTHER_CONVO}.1--234', '${ANOTHER_CONVO}.1', '234', '1', 1);
        `
      );

      updateToVersion(41);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM senderKeys').pluck().get(),
        0
      );
    });

    it('correctly merges senderKeys for conflicting conversations', () => {
      updateToVersion(40);

      addOurUuid();

      const fullA = generateGuid();
      const fullB = generateGuid();
      const fullC = generateGuid();
      const partial = generateGuid();

      // When merging two keys for different conversations with the same uuid
      // only the most recent key would be kept in the database. We prefer keys
      // with either:
      //
      // 1. more recent lastUpdatedDate column
      // 2. conversation with both e164 and uuid
      // 3. conversation with more recent active_at
      db.exec(
        `
        INSERT INTO conversations (id, uuid, e164, active_at) VALUES
          ('${fullA}', '${THEIR_UUID}', '+12125555555', 1),
          ('${fullB}', '${THEIR_UUID}', '+12125555555', 2),
          ('${fullC}', '${THEIR_UUID}', '+12125555555', 3),
          ('${partial}', '${THEIR_UUID}', NULL, 3);

        INSERT INTO senderKeys
          (id, senderId, distributionId, data, lastUpdatedDate)
        VALUES
          ('${fullA}.1--234', '${fullA}.1', 'fullA', '1', 1),
          ('${fullC}.1--234', '${fullC}.1', 'fullC', '2', 2),
          ('${fullB}.1--234', '${fullB}.1', 'fullB', '3', 2),
          ('${partial}.1--234', '${partial}.1', 'partial', '4', 2);
        `
      );

      updateToVersion(41);

      assert.deepStrictEqual(db.prepare('SELECT * FROM senderKeys').all(), [
        {
          id: `${OUR_UUID}:${THEIR_UUID}.1--234`,
          senderId: `${THEIR_UUID}.1`,
          distributionId: 'fullC',
          lastUpdatedDate: 2,
          data: '2',
        },
      ]);
    });

    it('migrates sessions', () => {
      updateToVersion(40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id, uuid) VALUES
          ('${THEIR_CONVO}', '${THEIR_UUID}');
        `
      );

      insertSession(THEIR_CONVO, 1);

      updateToVersion(41);

      assert.deepStrictEqual(
        parseItems(db.prepare('SELECT * FROM sessions').all()),
        [
          {
            conversationId: THEIR_CONVO,
            id: `${OUR_UUID}:${THEIR_UUID}.1`,
            uuid: THEIR_UUID,
            ourUuid: OUR_UUID,
            json: {
              id: `${OUR_UUID}:${THEIR_UUID}.1`,
              conversationId: THEIR_CONVO,
              uuid: THEIR_UUID,
              ourUuid: OUR_UUID,
            },
          },
        ]
      );
    });

    it('removes sessions that do not have conversation id', () => {
      updateToVersion(40);

      addOurUuid();

      insertSession(THEIR_CONVO, 1);

      updateToVersion(41);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM sessions').pluck().get(),
        0
      );
    });

    it('removes sessions that do not have conversation uuid', () => {
      updateToVersion(40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id) VALUES ('${THEIR_CONVO}');
        `
      );

      insertSession(THEIR_CONVO, 1);

      updateToVersion(41);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM sessions').pluck().get(),
        0
      );
    });

    it('correctly merges sessions for conflicting conversations', () => {
      updateToVersion(40);

      addOurUuid();

      const fullA = generateGuid();
      const fullB = generateGuid();
      const partial = generateGuid();

      // Similar merging logic to senderkeys above. We prefer sessions with
      // either:
      //
      // 1. conversation with both e164 and uuid
      // 2. conversation with more recent active_at
      db.exec(
        `
        INSERT INTO conversations (id, uuid, e164, active_at) VALUES
          ('${fullA}', '${THEIR_UUID}', '+12125555555', 1),
          ('${fullB}', '${THEIR_UUID}', '+12125555555', 2),
          ('${partial}', '${THEIR_UUID}', NULL, 3);
        `
      );

      insertSession(fullA, 1, { name: 'A' });
      insertSession(fullB, 1, { name: 'B' });
      insertSession(partial, 1, { name: 'C' });

      updateToVersion(41);

      assert.deepStrictEqual(
        parseItems(db.prepare('SELECT * FROM sessions').all()),
        [
          {
            id: `${OUR_UUID}:${THEIR_UUID}.1`,
            conversationId: fullB,
            ourUuid: OUR_UUID,
            uuid: THEIR_UUID,
            json: {
              id: `${OUR_UUID}:${THEIR_UUID}.1`,
              conversationId: fullB,
              ourUuid: OUR_UUID,
              uuid: THEIR_UUID,
              name: 'B',
            },
          },
        ]
      );
    });

    it('moves identity key and registration id into a map', () => {
      updateToVersion(40);

      addOurUuid();

      const items = [
        { id: 'identityKey', value: 'secret' },
        { id: 'registrationId', value: 42 },
      ];

      for (const item of items) {
        db.prepare(
          `
          INSERT INTO items (id, json) VALUES ($id, $json);
          `
        ).run({
          id: item.id,
          json: JSON.stringify(item),
        });
      }

      updateToVersion(41);

      assert.deepStrictEqual(
        parseItems(db.prepare('SELECT * FROM items ORDER BY id').all()),
        [
          {
            id: 'identityKeyMap',
            json: {
              id: 'identityKeyMap',
              value: { [OUR_UUID]: 'secret' },
            },
          },
          {
            id: 'registrationIdMap',
            json: {
              id: 'registrationIdMap',
              value: { [OUR_UUID]: 42 },
            },
          },
          {
            id: 'uuid_id',
            json: {
              id: 'uuid_id',
              value: `${OUR_UUID}.1`,
            },
          },
        ]
      );
    });

    it("migrates other users' identity keys", () => {
      updateToVersion(40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id, uuid) VALUES
          ('${THEIR_CONVO}', '${THEIR_UUID}'),
          ('${ANOTHER_CONVO}', NULL);
        `
      );

      const identityKeys = [
        { id: THEIR_CONVO },
        { id: ANOTHER_CONVO },
        { id: THIRD_CONVO },
      ];
      for (const key of identityKeys) {
        db.prepare(
          `
            INSERT INTO identityKeys (id, json) VALUES ($id, $json);
          `
        ).run({
          id: key.id,
          json: JSON.stringify(key),
        });
      }

      updateToVersion(41);

      assert.deepStrictEqual(
        parseItems(db.prepare('SELECT * FROM identityKeys ORDER BY id').all()),
        [
          {
            id: THEIR_UUID,
            json: {
              id: THEIR_UUID,
            },
          },
          {
            id: `conversation:${ANOTHER_CONVO}`,
            json: {
              id: `conversation:${ANOTHER_CONVO}`,
            },
          },
          {
            id: `conversation:${THIRD_CONVO}`,
            json: {
              id: `conversation:${THIRD_CONVO}`,
            },
          },
        ].sort((a, b) => {
          if (a.id === b.id) {
            return 0;
          }
          if (a.id < b.id) {
            return -1;
          }
          return 1;
        })
      );
    });
  });

  describe('updateToSchemaVersion42', () => {
    const MESSAGE_ID_1 = generateGuid();
    const MESSAGE_ID_2 = generateGuid();
    const MESSAGE_ID_3 = generateGuid();
    const MESSAGE_ID_4 = generateGuid();
    const CONVERSATION_ID = generateGuid();

    it('deletes orphaned reactions', () => {
      updateToVersion(41);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, body)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'message number 1'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'message number 2');
        INSERT INTO reactions (messageId, conversationId) VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}'),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}');
        `
      );

      const reactionCount = db
        .prepare('SELECT COUNT(*) FROM reactions;')
        .pluck();
      const messageCount = db.prepare('SELECT COUNT(*) FROM messages;').pluck();

      assert.strictEqual(reactionCount.get(), 4);
      assert.strictEqual(messageCount.get(), 2);

      updateToVersion(42);

      assert.strictEqual(reactionCount.get(), 2);
      assert.strictEqual(messageCount.get(), 2);

      const reactionMessageIds = db
        .prepare('SELECT messageId FROM reactions;')
        .pluck()
        .all();

      assert.sameDeepMembers(reactionMessageIds, [MESSAGE_ID_1, MESSAGE_ID_2]);
    });

    it('new message delete trigger deletes reactions as well', () => {
      updateToVersion(41);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, body)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'message number 1'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'message number 2'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'message number 3');
        INSERT INTO reactions (messageId, conversationId) VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}');
        `
      );

      const reactionCount = db
        .prepare('SELECT COUNT(*) FROM reactions;')
        .pluck();
      const messageCount = db.prepare('SELECT COUNT(*) FROM messages;').pluck();

      assert.strictEqual(reactionCount.get(), 3);
      assert.strictEqual(messageCount.get(), 3);

      updateToVersion(42);

      assert.strictEqual(reactionCount.get(), 3);
      assert.strictEqual(messageCount.get(), 3);

      db.exec(
        `
        DELETE FROM messages WHERE id = '${MESSAGE_ID_1}';
        `
      );

      assert.strictEqual(reactionCount.get(), 2);
      assert.strictEqual(messageCount.get(), 2);

      const reactionMessageIds = db
        .prepare('SELECT messageId FROM reactions;')
        .pluck()
        .all();

      assert.sameDeepMembers(reactionMessageIds, [MESSAGE_ID_2, MESSAGE_ID_3]);
    });
  });
});
