// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Database } from 'better-sqlite3';
import SQL from 'better-sqlite3';
import { v4 as generateGuid } from 'uuid';

import { SCHEMA_VERSIONS } from '../sql/migrations';
import { consoleLogger } from '../util/consoleLogger';

const OUR_UUID = generateGuid();

describe('SQL migrations test', () => {
  let db: Database;

  const updateToVersion = (version: number) => {
    const startVersion = db.pragma('user_version', { simple: true });

    for (const run of SCHEMA_VERSIONS) {
      run(startVersion, db, consoleLogger);

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

  describe('updateToSchemaVersion43', () => {
    it('remaps conversation ids to UUIDs in groups and messages', () => {
      updateToVersion(42);

      const UUID_A = generateGuid();
      const UUID_B = generateGuid();
      const UUID_C = generateGuid();

      const rawConvoA = { id: 'a', groupId: 'gv2a', uuid: UUID_A };
      const rawConvoB = { id: 'b', groupId: 'gv2b', uuid: UUID_B };

      const rawConvoC = {
        id: 'c',
        groupId: 'gv2c',
        uuid: UUID_C,
        membersV2: [
          { conversationId: 'a', joinedAtVersion: 1 },
          { conversationId: 'b', joinedAtVersion: 2 },
          { conversationId: 'z', joinedAtVersion: 3 },
        ],
        pendingMembersV2: [
          { conversationId: 'a', addedByUserId: 'b', timestamp: 4 },
          { conversationId: 'b', addedByUserId: UUID_A, timestamp: 5 },
          { conversationId: 'z', timestamp: 6 },
        ],
        pendingAdminApprovalV2: [
          { conversationId: 'a', timestamp: 6 },
          { conversationId: 'b', timestamp: 7 },
          { conversationId: 'z', timestamp: 8 },
        ],
      };

      const CHANGE_TYPES = [
        'member-add',
        'member-add-from-link',
        'member-add-from-admin-approval',
        'member-privilege',
        'member-remove',
        'pending-add-one',
        'admin-approval-add-one',
      ];

      const CHANGE_TYPES_WITH_INVITER = [
        'member-add-from-invite',
        'pending-remove-one',
        'pending-remove-many',
        'admin-approval-remove-one',
      ];

      db.exec(
        `
        INSERT INTO conversations
          (id, uuid, json)
          VALUES
          ('a', '${UUID_A}', '${JSON.stringify(rawConvoA)}'),
          ('b', '${UUID_B}', '${JSON.stringify(rawConvoB)}'),
          ('c', '${UUID_C}', '${JSON.stringify(rawConvoC)}');

        INSERT INTO messages
          (id, json)
          VALUES
          ('m', '${JSON.stringify({
            id: 'm',
            groupV2Change: {
              from: 'a',
              details: [
                ...CHANGE_TYPES.map(type => ({ type, conversationId: 'b' })),
                ...CHANGE_TYPES_WITH_INVITER.map(type => {
                  return { type, conversationId: 'c', inviter: 'a' };
                }),
              ],
            },
            sourceUuid: 'a',
            invitedGV2Members: [
              {
                conversationId: 'b',
                addedByUserId: 'c',
              },
            ],
          })}'),
          ('n', '${JSON.stringify({
            id: 'n',
            groupV2Change: {
              from: 'not-found',
              details: [],
            },
            sourceUuid: 'a',
          })}');
        `
      );

      updateToVersion(43);

      const { members, json: convoJSON } = db
        .prepare('SELECT members, json FROM conversations WHERE id = "c"')
        .get();

      assert.strictEqual(members, `${UUID_A} ${UUID_B}`);
      assert.deepStrictEqual(JSON.parse(convoJSON), {
        id: 'c',
        groupId: 'gv2c',
        uuid: UUID_C,
        membersV2: [
          { uuid: UUID_A, joinedAtVersion: 1 },
          { uuid: UUID_B, joinedAtVersion: 2 },
        ],
        pendingMembersV2: [
          { uuid: UUID_A, addedByUserId: UUID_B, timestamp: 4 },
          { uuid: UUID_B, addedByUserId: UUID_A, timestamp: 5 },
        ],
        pendingAdminApprovalV2: [
          { uuid: UUID_A, timestamp: 6 },
          { uuid: UUID_B, timestamp: 7 },
        ],
      });

      const { json: messageMJSON } = db
        .prepare('SELECT  json FROM messages WHERE id = "m"')
        .get();

      assert.deepStrictEqual(JSON.parse(messageMJSON), {
        id: 'm',
        groupV2Change: {
          from: UUID_A,
          details: [
            ...CHANGE_TYPES.map(type => ({ type, uuid: UUID_B })),
            ...CHANGE_TYPES_WITH_INVITER.map(type => {
              return {
                type,
                uuid: UUID_C,
                inviter: UUID_A,
              };
            }),
          ],
        },
        sourceUuid: UUID_A,
        invitedGV2Members: [
          {
            uuid: UUID_B,
            addedByUserId: UUID_C,
          },
        ],
      });

      const { json: messageNJSON } = db
        .prepare('SELECT  json FROM messages WHERE id = "n"')
        .get();

      assert.deepStrictEqual(JSON.parse(messageNJSON), {
        id: 'n',
        groupV2Change: {
          details: [],
        },
        sourceUuid: UUID_A,
      });
    });

    it('should not fail on invalid UUIDs', () => {
      updateToVersion(42);

      db.exec(
        `
        INSERT INTO messages
          (id, json)
          VALUES
          ('m', '${JSON.stringify({
            id: 'm',
            sourceUuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          })}');
        `
      );

      updateToVersion(43);

      const { json: messageMJSON } = db
        .prepare('SELECT json FROM messages WHERE id = "m"')
        .get();

      assert.deepStrictEqual(JSON.parse(messageMJSON), {
        id: 'm',
        sourceUuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      });
    });
  });

  describe('updateToSchemaVersion45', () => {
    it('creates new storyId field and delete trigger for storyReads', () => {
      const AUTHOR_ID = generateGuid();
      const STORY_ID_1 = generateGuid();
      const STORY_ID_2 = generateGuid();
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const MESSAGE_ID_5 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(45);

      db.exec(
        `
        INSERT INTO messages
          (id, storyId, conversationId, type, body)
          VALUES
          ('${MESSAGE_ID_1}', '${STORY_ID_1}', '${CONVERSATION_ID}', 'story', 'story 1'),
          ('${MESSAGE_ID_2}', '${STORY_ID_2}', '${CONVERSATION_ID}', 'story', 'story 2'),
          ('${MESSAGE_ID_3}', '${STORY_ID_1}', '${CONVERSATION_ID}', 'outgoing', 'reply to story 1'),
          ('${MESSAGE_ID_4}', '${STORY_ID_1}', '${CONVERSATION_ID}', 'incoming', 'reply to story 1'),
          ('${MESSAGE_ID_5}', '${STORY_ID_2}', '${CONVERSATION_ID}', 'outgoing', 'reply to story 2');

        INSERT INTO storyReads (authorId, conversationId, storyId, storyReadDate) VALUES
          ('${AUTHOR_ID}', '${CONVERSATION_ID}', '${STORY_ID_1}', ${Date.now()}),
          ('${AUTHOR_ID}', '${CONVERSATION_ID}', '${STORY_ID_2}', ${Date.now()});     `
      );

      const storyReadCount = db
        .prepare('SELECT COUNT(*) FROM storyReads;')
        .pluck();
      const messageCount = db.prepare('SELECT COUNT(*) FROM messages;').pluck();

      assert.strictEqual(storyReadCount.get(), 2);
      assert.strictEqual(messageCount.get(), 5);

      db.exec(`DELETE FROM messages WHERE id = '${MESSAGE_ID_1}';`);

      assert.strictEqual(storyReadCount.get(), 1);
      assert.strictEqual(messageCount.get(), 4);

      db.exec(`DELETE FROM messages WHERE storyId = '${STORY_ID_1}';`);

      assert.strictEqual(storyReadCount.get(), 1);
      assert.strictEqual(messageCount.get(), 2);

      const storyReadIds = db
        .prepare('SELECT storyId FROM storyReads;')
        .pluck()
        .all();
      assert.sameDeepMembers(storyReadIds, [STORY_ID_2]);
    });

    it('creates new storyDistributions/Members with cascade delete', () => {
      const LIST_ID_1 = generateGuid();
      const LIST_ID_2 = generateGuid();
      const UUID_1 = generateGuid();
      const UUID_2 = generateGuid();
      const UUID_3 = generateGuid();
      const UUID_4 = generateGuid();

      updateToVersion(45);

      db.exec(
        `
        INSERT INTO storyDistributions
          (id, name)
          VALUES
          ('${LIST_ID_1}', 'distribution list 1'),
          ('${LIST_ID_2}', 'distrubution list 2');

        INSERT INTO storyDistributionMembers (listId, uuid) VALUES
          ('${LIST_ID_1}', '${UUID_1}'),
          ('${LIST_ID_1}', '${UUID_2}'),
          ('${LIST_ID_1}', '${UUID_3}'),
          ('${LIST_ID_1}', '${UUID_4}'),
          ('${LIST_ID_2}', '${UUID_1}'),
          ('${LIST_ID_2}', '${UUID_2}');
        `
      );

      const listCount = db
        .prepare('SELECT COUNT(*) FROM storyDistributions;')
        .pluck();
      const memberCount = db
        .prepare('SELECT COUNT(*) FROM storyDistributionMembers;')
        .pluck();

      assert.strictEqual(listCount.get(), 2);
      assert.strictEqual(memberCount.get(), 6);

      db.exec(`DELETE FROM storyDistributions WHERE id = '${LIST_ID_1}';`);

      assert.strictEqual(listCount.get(), 1);
      assert.strictEqual(memberCount.get(), 2);

      const members = db
        .prepare('SELECT uuid FROM storyDistributionMembers;')
        .pluck()
        .all();

      assert.sameDeepMembers(members, [UUID_1, UUID_2]);
    });
  });

  describe('updateToSchemaVersion47', () => {
    it('creates and pre-populates new isChangeCreatedByUs field', () => {
      const OTHER_UUID = generateGuid();
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(46);

      const uuidItem = JSON.stringify({
        value: `${OUR_UUID}.4`,
      });
      const changeFromUs = JSON.stringify({
        groupV2Change: {
          from: OUR_UUID,
          details: [
            {
              type: 'member-remove',
              uuid: OTHER_UUID,
            },
          ],
        },
      });
      const changeFromOther = JSON.stringify({
        groupV2Change: {
          from: OTHER_UUID,
          details: [
            {
              type: 'member-remove',
              uuid: OUR_UUID,
            },
          ],
        },
      });

      db.exec(
        `
        INSERT INTO items (id, json) VALUES ('uuid_id', '${uuidItem}');
        INSERT INTO messages
          (id, conversationId, type, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'outgoing', '${changeFromUs}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'outgoing', '${changeFromOther}');
        `
      );

      updateToVersion(47);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        2
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isChangeCreatedByUs IS 0;'
          )
          .pluck()
          .get(),
        1,
        'zero'
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isChangeCreatedByUs IS 1;'
          )
          .pluck()
          .get(),
        1,
        'one'
      );
    });

    it('creates new auto-generated isStory field', () => {
      const STORY_ID_1 = generateGuid();
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(47);

      db.exec(
        `
        INSERT INTO messages
          (id, storyId, conversationId, type, body)
          VALUES
          ('${MESSAGE_ID_1}', '${STORY_ID_1}', '${CONVERSATION_ID}', 'story', 'story 1'),
          ('${MESSAGE_ID_2}', null, '${CONVERSATION_ID}', 'outgoing', 'reply to story 1'),
          ('${MESSAGE_ID_3}', null, '${CONVERSATION_ID}', null, 'null type!');
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        3
      );
      assert.strictEqual(
        db
          .prepare('SELECT COUNT(*) FROM messages WHERE isStory IS 0;')
          .pluck()
          .get(),
        2
      );
      assert.strictEqual(
        db
          .prepare('SELECT COUNT(*) FROM messages WHERE isStory IS 1;')
          .pluck()
          .get(),
        1
      );
    });

    it('creates new auto-generated shouldAffectActivity/shouldAffectPreview/isUserInitiatedMessage fields', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(47);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'story'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'keychange'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'outgoing'),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}', 'group-v2-change');
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        4
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE shouldAffectPreview IS 1;'
          )
          .pluck()
          .get(),
        3
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE shouldAffectActivity IS 1;'
          )
          .pluck()
          .get(),
        2
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isUserInitiatedMessage IS 1;'
          )
          .pluck()
          .get(),
        1
      );
    });

    it('creates new auto-generated isTimerChangeFromSync fields', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(47);

      const timerUpdate = JSON.stringify({
        expirationTimerUpdate: {
          expireTimer: 30,
          fromSync: false,
        },
      });
      const timerUpdateFromSync = JSON.stringify({
        expirationTimerUpdate: {
          expireTimer: 30,
          fromSync: true,
        },
      });

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'outgoing', '${timerUpdate}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'outgoing', '${timerUpdateFromSync}'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'outgoing', '{}');
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        3
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isTimerChangeFromSync IS 1;'
          )
          .pluck()
          .get(),
        1
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isTimerChangeFromSync IS 0;'
          )
          .pluck()
          .get(),
        2
      );
    });

    it('creates new auto-generated isGroupLeaveEvent fields', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const MESSAGE_ID_5 = generateGuid();
      const CONVERSATION_ID = generateGuid();
      const FIRST_UUID = generateGuid();
      const SECOND_UUID = generateGuid();
      const THIRD_UUID = generateGuid();

      updateToVersion(47);

      const memberRemoveByOther = JSON.stringify({
        groupV2Change: {
          from: FIRST_UUID,
          details: [
            {
              type: 'member-remove',
              uuid: SECOND_UUID,
            },
          ],
        },
      });
      const memberLeave = JSON.stringify({
        groupV2Change: {
          from: FIRST_UUID,
          details: [
            {
              type: 'member-remove',
              uuid: FIRST_UUID,
            },
          ],
        },
      });
      const multipleRemoves = JSON.stringify({
        groupV2Change: {
          from: FIRST_UUID,
          details: [
            {
              type: 'member-remove',
              uuid: SECOND_UUID,
            },
            {
              type: 'member-remove',
              uuid: THIRD_UUID,
            },
          ],
        },
      });
      const memberAdd = JSON.stringify({
        groupV2Change: {
          from: FIRST_UUID,
          details: [
            {
              type: 'member-add',
              uuid: FIRST_UUID,
            },
          ],
        },
      });

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'outgoing', '${memberLeave}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'group-v2-change', '${memberRemoveByOther}'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'group-v2-change', '${memberLeave}'),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}', 'group-v2-change', '${multipleRemoves}'),
          ('${MESSAGE_ID_5}', '${CONVERSATION_ID}', 'group-v2-change', '${memberAdd}');
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        5
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isGroupLeaveEvent IS 1;'
          )
          .pluck()
          .get(),
        1
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isGroupLeaveEvent IS 0;'
          )
          .pluck()
          .get(),
        4
      );
    });

    it('ensures that index is used for getOlderMessagesByConversation', () => {
      updateToVersion(47);

      const { detail } = db
        .prepare(
          `
        EXPLAIN QUERY PLAN
        SELECT json FROM messages WHERE
          conversationId = 'd8b05bb1-36b3-4478-841b-600af62321eb' AND
          (NULL IS NULL OR id IS NOT NULL) AND
          isStory IS 0 AND
          storyId IS NULL AND
          (
            (received_at = 17976931348623157 AND sent_at < NULL) OR
            received_at < 17976931348623157
          )
        ORDER BY received_at DESC, sent_at DESC
        LIMIT 10;
        `
        )
        .get();

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_conversation (conversationId=? AND isStory=? AND storyId=? AND received_at<?)'
      );
    });
  });

  describe('updateToSchemaVersion48', () => {
    it('creates usable index for hasUserInitiatedMessages', () => {
      updateToVersion(48);

      const details = db
        .prepare(
          `
        EXPLAIN QUERY PLAN
        SELECT COUNT(*) as count FROM
          (
            SELECT 1 FROM messages
            WHERE
              conversationId = 'convo' AND
              isUserInitiatedMessage = 1
            LIMIT 1
          );
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(
        details,
        'SEARCH messages USING INDEX message_user_initiated (conversationId=? AND isUserInitiatedMessage=?)'
      );
    });
  });
});
