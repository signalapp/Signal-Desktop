// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import { _storyIdPredicate, getJobsInQueue, insertJob } from '../../sql/Server';
import type { WritableDB } from '../../sql/Interface';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { objectToJSON, sql, sqlJoin } from '../../sql/util';
import { BodyRange } from '../../types/BodyRange';
import type { AciString } from '../../types/ServiceId';
import { generateAci } from '../../types/ServiceId';
import { createDB, updateToVersion } from './helpers';

const OUR_UUID = generateGuid();

describe('SQL migrations test', () => {
  let db: WritableDB;

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
    db = createDB();
  });

  afterEach(() => {
    db.close();
  });

  describe('updateToSchemaVersion41', () => {
    const THEIR_UUID = generateAci();
    const THEIR_CONVO = generateGuid();
    const ANOTHER_CONVO = generateGuid();
    const THIRD_CONVO = generateGuid();

    it('clears sessions and keys if UUID is not available', () => {
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

      assert.strictEqual(senderKeyCount.get(), 0);
      assert.strictEqual(sessionCount.get(), 0);
      assert.strictEqual(signedPreKeyCount.get(), 0);
      assert.strictEqual(preKeyCount.get(), 0);
      assert.strictEqual(itemCount.get(), 0);
    });

    it('adds prefix to preKeys/signedPreKeys', () => {
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

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
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

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
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM senderKeys').pluck().get(),
        0
      );
    });

    it('correctly merges senderKeys for conflicting conversations', () => {
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

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
      updateToVersion(db, 40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id, uuid) VALUES
          ('${THEIR_CONVO}', '${THEIR_UUID}');
        `
      );

      insertSession(THEIR_CONVO, 1);

      updateToVersion(db, 41);

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
      updateToVersion(db, 40);

      addOurUuid();

      insertSession(THEIR_CONVO, 1);

      updateToVersion(db, 41);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM sessions').pluck().get(),
        0
      );
    });

    it('removes sessions that do not have conversation uuid', () => {
      updateToVersion(db, 40);

      addOurUuid();

      db.exec(
        `
        INSERT INTO conversations (id) VALUES ('${THEIR_CONVO}');
        `
      );

      insertSession(THEIR_CONVO, 1);

      updateToVersion(db, 41);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM sessions').pluck().get(),
        0
      );
    });

    it('correctly merges sessions for conflicting conversations', () => {
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

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
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

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
      updateToVersion(db, 40);

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

      updateToVersion(db, 41);

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
      updateToVersion(db, 41);

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

      updateToVersion(db, 42);

      assert.strictEqual(reactionCount.get(), 2);
      assert.strictEqual(messageCount.get(), 2);

      const reactionMessageIds = db
        .prepare('SELECT messageId FROM reactions;')
        .pluck()
        .all();

      assert.sameDeepMembers(reactionMessageIds, [MESSAGE_ID_1, MESSAGE_ID_2]);
    });

    it('new message delete trigger deletes reactions as well', () => {
      updateToVersion(db, 41);

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

      updateToVersion(db, 42);

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
      updateToVersion(db, 42);

      const UUID_A = generateAci();
      const UUID_B = generateAci();
      const UUID_C = generateAci();

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

      updateToVersion(db, 43);

      const { members, json: convoJSON } = db
        .prepare("SELECT members, json FROM conversations WHERE id = 'c'")
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
        .prepare("SELECT  json FROM messages WHERE id = 'm'")
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
        .prepare("SELECT  json FROM messages WHERE id = 'n'")
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
      updateToVersion(db, 42);

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

      updateToVersion(db, 43);

      const { json: messageMJSON } = db
        .prepare("SELECT json FROM messages WHERE id = 'm'")
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

      updateToVersion(db, 45);

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
      const UUID_1 = generateAci();
      const UUID_2 = generateAci();
      const UUID_3 = generateAci();
      const UUID_4 = generateAci();

      updateToVersion(db, 45);

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
      const OTHER_UUID = generateAci();
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(db, 46);

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

      updateToVersion(db, 47);

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

      updateToVersion(db, 47);

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

      updateToVersion(db, 47);

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

      updateToVersion(db, 47);

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
      const FIRST_UUID = generateAci();
      const SECOND_UUID = generateAci();
      const THIRD_UUID = generateAci();

      updateToVersion(db, 47);

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
      updateToVersion(db, 47);

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
      updateToVersion(db, 48);

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

  describe('updateToSchemaVersion49', () => {
    it('creates usable index for messages preview', () => {
      updateToVersion(db, 49);

      const details = db
        .prepare(
          `
        EXPLAIN QUERY PLAN
        SELECT json FROM messages
        WHERE
          conversationId = 'convo' AND
          shouldAffectPreview IS 1 AND
          isGroupLeaveEventFromOther IS 0 AND
          (
            expiresAt IS NULL
            OR
            expiresAt > 123
          )
        ORDER BY received_at DESC, sent_at DESC
        LIMIT 1;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(details, 'USING INDEX messages_preview');
      assert.notInclude(details, 'TEMP B-TREE');
      assert.notInclude(details, 'SCAN');
    });
  });

  describe('updateToSchemaVersion50', () => {
    it('creates usable index for messages_unread', () => {
      updateToVersion(db, 50);

      const details = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT * FROM messages WHERE
            conversationId = 'conversation' AND
            readStatus = 'something' AND
            isStory IS 0 AND
            storyId IS NULL
          ORDER BY received_at ASC, sent_at ASC
          LIMIT 1;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(details, 'USING INDEX messages_unread');
      assert.notInclude(details, 'TEMP B-TREE');
      assert.notInclude(details, 'SCAN');
    });
  });

  describe('updateToSchemaVersion51', () => {
    it('moves reactions/normal send jobs over to conversation queue', () => {
      updateToVersion(db, 50);

      const MESSAGE_ID_1 = generateGuid();
      const CONVERSATION_ID_1 = generateGuid();

      db.exec(
        `
        INSERT INTO messages
        (id, conversationId)
        VALUES ('${MESSAGE_ID_1}', '${CONVERSATION_ID_1}');
        `
      );

      db.exec(
        `
        INSERT INTO jobs
          (id, timestamp, queueType, data)
          VALUES
          ('id-1', 1, 'random job', '{}'),
          ('id-2', 2, 'normal send', '{}'),
          ('id-3', 3, 'reactions', '{"messageId":"${MESSAGE_ID_1}"}'),
          ('id-4', 4, 'conversation', '{}');
        `
      );

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const normalSendJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'normal send';")
        .pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();
      const reactionJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'reactions';")
        .pluck();

      assert.strictEqual(totalJobs.get(), 4, 'before total');
      assert.strictEqual(normalSendJobs.get(), 1, 'before normal');
      assert.strictEqual(conversationJobs.get(), 1, 'before conversation');
      assert.strictEqual(reactionJobs.get(), 1, 'before reaction');

      updateToVersion(db, 51);

      assert.strictEqual(totalJobs.get(), 4, 'after total');
      assert.strictEqual(normalSendJobs.get(), 0, 'after normal');
      assert.strictEqual(conversationJobs.get(), 3, 'after conversation');
      assert.strictEqual(reactionJobs.get(), 0, 'after reaction');
    });

    it('updates reactions jobs with their conversationId', () => {
      updateToVersion(db, 50);

      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();

      const CONVERSATION_ID_1 = generateGuid();
      const CONVERSATION_ID_2 = generateGuid();

      insertJob(db, {
        id: 'id-1',
        timestamp: 1,
        queueType: 'reactions',
        data: {
          messageId: MESSAGE_ID_1,
        },
      });
      insertJob(db, {
        id: 'id-2',
        timestamp: 2,
        queueType: 'reactions',
        data: {
          messageId: MESSAGE_ID_2,
        },
      });
      insertJob(db, {
        id: 'id-3-missing-data',
        timestamp: 3,
        queueType: 'reactions',
      });
      insertJob(db, {
        id: 'id-4-non-string-messageId',
        timestamp: 1,
        queueType: 'reactions',
        data: {
          messageId: 4,
        },
      });
      insertJob(db, {
        id: 'id-5-missing-message',
        timestamp: 5,
        queueType: 'reactions',
        data: {
          messageId: 'missing',
        },
      });
      insertJob(db, {
        id: 'id-6-missing-conversation',
        timestamp: 6,
        queueType: 'reactions',
        data: {
          messageId: MESSAGE_ID_3,
        },
      });

      const messageJson1 = JSON.stringify({
        conversationId: CONVERSATION_ID_1,
      });
      const messageJson2 = JSON.stringify({
        conversationId: CONVERSATION_ID_2,
      });
      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID_1}', '${messageJson1}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID_2}', '${messageJson2}'),
          ('${MESSAGE_ID_3}', null, '{}');
        `
      );

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const reactionJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'reactions';")
        .pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();

      assert.strictEqual(totalJobs.get(), 6, 'total jobs before');
      assert.strictEqual(reactionJobs.get(), 6, 'reaction jobs before');
      assert.strictEqual(conversationJobs.get(), 0, 'conversation jobs before');

      updateToVersion(db, 51);

      assert.strictEqual(totalJobs.get(), 2, 'total jobs after');
      assert.strictEqual(reactionJobs.get(), 0, 'reaction jobs after');
      assert.strictEqual(conversationJobs.get(), 2, 'conversation jobs after');

      const jobs = getJobsInQueue(db, 'conversation');

      assert.deepEqual(jobs, [
        {
          id: 'id-1',
          timestamp: 1,
          queueType: 'conversation',
          data: {
            type: 'Reaction',
            conversationId: CONVERSATION_ID_1,
            messageId: MESSAGE_ID_1,
          },
        },
        {
          id: 'id-2',
          timestamp: 2,
          queueType: 'conversation',
          data: {
            type: 'Reaction',
            conversationId: CONVERSATION_ID_2,
            messageId: MESSAGE_ID_2,
          },
        },
      ]);
    });

    it('updates normal send jobs with their conversationId', () => {
      updateToVersion(db, 50);

      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();

      const CONVERSATION_ID_1 = generateGuid();
      const CONVERSATION_ID_2 = generateGuid();

      insertJob(db, {
        id: 'id-1',
        timestamp: 1,
        queueType: 'normal send',
        data: {
          conversationId: CONVERSATION_ID_1,
          messageId: MESSAGE_ID_1,
        },
      });
      insertJob(db, {
        id: 'id-2',
        timestamp: 2,
        queueType: 'normal send',
        data: {
          conversationId: CONVERSATION_ID_2,
          messageId: MESSAGE_ID_2,
        },
      });
      insertJob(db, {
        id: 'id-3-missing-data',
        timestamp: 3,
        queueType: 'normal send',
      });

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const normalSend = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'normal send';")
        .pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();

      assert.strictEqual(totalJobs.get(), 3, 'total jobs before');
      assert.strictEqual(normalSend.get(), 3, 'normal send jobs before');
      assert.strictEqual(conversationJobs.get(), 0, 'conversation jobs before');

      updateToVersion(db, 51);

      assert.strictEqual(totalJobs.get(), 2, 'total jobs after');
      assert.strictEqual(normalSend.get(), 0, 'normal send jobs after');
      assert.strictEqual(conversationJobs.get(), 2, 'conversation jobs after');

      const jobs = getJobsInQueue(db, 'conversation');

      assert.deepEqual(jobs, [
        {
          id: 'id-1',
          timestamp: 1,
          queueType: 'conversation',
          data: {
            type: 'NormalMessage',
            conversationId: CONVERSATION_ID_1,
            messageId: MESSAGE_ID_1,
          },
        },
        {
          id: 'id-2',
          timestamp: 2,
          queueType: 'conversation',
          data: {
            type: 'NormalMessage',
            conversationId: CONVERSATION_ID_2,
            messageId: MESSAGE_ID_2,
          },
        },
      ]);
    });
  });

  describe('updateToSchemaVersion52', () => {
    function getQueries(
      storyId: string | undefined,
      includeStoryReplies: boolean
    ) {
      return [
        {
          template: sql`
            EXPLAIN QUERY PLAN
            SELECT * FROM messages WHERE
              conversationId = 'conversation' AND
              readStatus = 'something' AND
              isStory IS 0 AND
              ${_storyIdPredicate(storyId, includeStoryReplies)}
            ORDER BY received_at ASC, sent_at ASC
            LIMIT 1;
          `,
          index: 'messages_unread',
        },
        {
          template: sql`
            EXPLAIN QUERY PLAN
            SELECT json FROM messages WHERE
              conversationId = 'd8b05bb1-36b3-4478-841b-600af62321eb' AND
              (NULL IS NULL OR id IS NOT NULL) AND
              isStory IS 0 AND
              ${_storyIdPredicate(storyId, includeStoryReplies)} AND
              (
                (received_at = 17976931348623157 AND sent_at < NULL) OR
                received_at < 17976931348623157
              )
            ORDER BY received_at DESC, sent_at DESC
            LIMIT 10;
          `,
          index: 'messages_conversation',
        },
      ];
    }

    it('produces optimizable queries for present and absent storyId', () => {
      updateToVersion(db, 52);

      for (const storyId of ['123', undefined]) {
        for (const { template, index } of getQueries(storyId, true)) {
          const [query, params] = template;
          const details = db
            .prepare(query)
            .all(params)
            .map(({ detail }) => detail)
            .join('\n');

          const postfixedIndex = index + (storyId ? '' : '_no_story_id');

          // Intentional trailing whitespace
          assert.include(details, `USING INDEX ${postfixedIndex} `);
          assert.notInclude(details, 'TEMP B-TREE');
          assert.notInclude(details, 'SCAN');
        }
      }
    });
  });

  describe('updateToSchemaVersion53', () => {
    it('remaps bannedMembersV2 to array of objects', () => {
      updateToVersion(db, 52);

      const UUID_A = generateAci();
      const UUID_B = generateAci();
      const UUID_C = generateAci();

      const noMembers = { id: 'a', groupId: 'gv2a' };
      const emptyMembers = {
        id: 'b',
        groupId: 'gv2b',
        bannedMembersV2: [],
      };

      const nonEmptyMembers = {
        id: 'c',
        groupId: 'gv2c',
        bannedMembersV2: [UUID_A, UUID_B],
      };

      db.exec(
        `
        INSERT INTO conversations
          (id, type, uuid, json)
          VALUES
          ('a', 'group', '${UUID_A}', '${JSON.stringify(noMembers)}'),
          ('b', 'group', '${UUID_B}', '${JSON.stringify(emptyMembers)}'),
          ('c', 'group', '${UUID_C}', '${JSON.stringify(nonEmptyMembers)}');
        `
      );

      updateToVersion(db, 53);

      const entries: Array<{ id: string; json: string }> = db
        .prepare('SELECT id, json FROM conversations ORDER BY id')
        .all();

      assert.deepStrictEqual(
        entries.map(({ id, json }) => ({ id, ...JSON.parse(json) })),
        [
          { id: 'a', groupId: 'gv2a' },
          { id: 'b', groupId: 'gv2b', bannedMembersV2: [] },
          {
            id: 'c',
            groupId: 'gv2c',
            bannedMembersV2: [
              { uuid: UUID_A, timestamp: 0 },
              { uuid: UUID_B, timestamp: 0 },
            ],
          },
        ]
      );
    });
  });

  describe('updateToSchemaVersion55', () => {
    it('moves existing report spam jobs to new schema', () => {
      updateToVersion(db, 54);

      const E164_1 = '+12125550155';
      const MESSAGE_ID_1 = generateGuid();

      db.exec(
        `
          INSERT INTO jobs
            (id, timestamp, queueType, data)
            VALUES
            ('id-1', 1, 'random job', '{}'),
            ('id-2', 2, 'report spam', '{"serverGuids": ["${MESSAGE_ID_1}"], "e164": "${E164_1}"}');
          `
      );

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const reportSpamJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'report spam';")
        .pluck();

      assert.strictEqual(totalJobs.get(), 2, 'before total');
      assert.strictEqual(reportSpamJobs.get(), 1, 'before report spam');

      updateToVersion(db, 55);

      assert.strictEqual(totalJobs.get(), 2, 'after total');
      assert.strictEqual(reportSpamJobs.get(), 1, 'after report spam');

      const jobs = getJobsInQueue(db, 'report spam');

      assert.deepEqual(jobs, [
        {
          id: 'id-2',
          queueType: 'report spam',
          timestamp: 2,
          data: {
            serverGuids: [`${MESSAGE_ID_1}`],
            uuid: `${E164_1}`,
          },
        },
      ]);
    });
  });

  describe('updateToSchemaVersion56', () => {
    it('updates unseenStatus for previously-unread messages', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const MESSAGE_ID_5 = generateGuid();
      const MESSAGE_ID_6 = generateGuid();
      const MESSAGE_ID_7 = generateGuid();
      const MESSAGE_ID_8 = generateGuid();
      const MESSAGE_ID_9 = generateGuid();
      const MESSAGE_ID_10 = generateGuid();
      const MESSAGE_ID_11 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(db, 55);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type, readStatus)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'call-history', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'change-number-notification', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'chat-session-refreshed', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}', 'delivery-issue', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_5}', '${CONVERSATION_ID}', 'group', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_6}', '${CONVERSATION_ID}', 'incoming', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_7}', '${CONVERSATION_ID}', 'keychange', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_8}', '${CONVERSATION_ID}', 'timer-notification', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_9}', '${CONVERSATION_ID}', 'verified-change', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_10}', '${CONVERSATION_ID}', NULL, ${ReadStatus.Unread}),
          ('${MESSAGE_ID_11}', '${CONVERSATION_ID}', 'other', ${ReadStatus.Unread});
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        11,
        'starting total'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE readStatus = ${ReadStatus.Unread};`
          )
          .pluck()
          .get(),
        11,
        'starting unread count'
      );

      updateToVersion(db, 56);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        11,
        'ending total'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE readStatus = ${ReadStatus.Unread};`
          )
          .pluck()
          .get(),
        10,
        'ending unread count'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE seenStatus = ${SeenStatus.Unseen};`
          )
          .pluck()
          .get(),
        10,
        'ending unseen count'
      );

      assert.strictEqual(
        db
          .prepare(
            "SELECT readStatus FROM messages WHERE type = 'other' LIMIT 1;"
          )
          .pluck()
          .get(),
        ReadStatus.Read,
        "checking read status for lone 'other' message"
      );
    });

    it('creates usable index for getOldestUnseenMessageForConversation', () => {
      updateToVersion(db, 56);

      const first = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT * FROM messages WHERE
            conversationId = 'id-conversation-4' AND
            seenStatus = ${SeenStatus.Unseen} AND
            isStory IS 0 AND
            NULL IS NULL
          ORDER BY received_at ASC, sent_at ASC
          LIMIT 1;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(first, 'USING INDEX messages_unseen_no_story', 'first');
      assert.notInclude(first, 'TEMP B-TREE', 'first');
      assert.notInclude(first, 'SCAN', 'first');

      const second = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT * FROM messages WHERE
            conversationId = 'id-conversation-4' AND
            seenStatus = ${SeenStatus.Unseen} AND
            isStory IS 0 AND
            storyId IS 'id-story-4'
          ORDER BY received_at ASC, sent_at ASC
          LIMIT 1;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(
        second,
        'USING INDEX messages_unseen_with_story',
        'second'
      );
      assert.notInclude(second, 'TEMP B-TREE', 'second');
      assert.notInclude(second, 'SCAN', 'second');
    });

    it('creates usable index for getUnreadByConversationAndMarkRead', () => {
      updateToVersion(db, 56);

      const first = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          UPDATE messages
          SET
            readStatus = ${ReadStatus.Read},
            seenStatus = ${SeenStatus.Seen},
            json = json_patch(json, '{ something: "one" }')
          WHERE
            conversationId = 'id-conversation-4' AND
            seenStatus = ${SeenStatus.Unseen} AND
            isStory = 0 AND
            NULL IS NULL AND
            received_at <= 2343233;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(first, 'USING INDEX messages_unseen_no_story', 'first');
      assert.notInclude(first, 'TEMP B-TREE', 'first');
      assert.notInclude(first, 'SCAN', 'first');

      const second = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          UPDATE messages
          SET
            readStatus = ${ReadStatus.Read},
            seenStatus = ${SeenStatus.Seen},
            json = json_patch(json, '{ something: "one" }')
          WHERE
            conversationId = 'id-conversation-4' AND
            seenStatus = ${SeenStatus.Unseen} AND
            isStory = 0 AND
            storyId IS 'id-story-4' AND
            received_at <= 2343233;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(
        second,
        'USING INDEX messages_unseen_with_story',
        'second'
      );
      assert.notInclude(second, 'TEMP B-TREE', 'second');
      assert.notInclude(second, 'SCAN', 'second');
    });

    it('creates usable index for getTotalUnseenForConversationSync', () => {
      updateToVersion(db, 56);

      const first = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT count(id)
          FROM messages
          WHERE
            conversationId = 'id-conversation-4' AND
            seenStatus = ${SeenStatus.Unseen} AND
            isStory IS 0 AND
            NULL IS NULL;
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      // Weird, but we don't included received_at so it doesn't really matter
      assert.include(first, 'USING INDEX messages_unseen_with_story', 'first');
      assert.notInclude(first, 'TEMP B-TREE', 'first');
      assert.notInclude(first, 'SCAN', 'first');

      const second = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT count(id)
          FROM messages
          WHERE
            conversationId = 'id-conversation-4' AND
            seenStatus = ${SeenStatus.Unseen} AND
            isStory IS 0 AND
            storyId IS 'id-story-4';
        `
        )
        .all()
        .map(({ detail }) => detail)
        .join('\n');

      assert.include(
        second,
        'USING INDEX messages_unseen_with_story',
        'second'
      );
      assert.notInclude(second, 'TEMP B-TREE', 'second');
      assert.notInclude(second, 'SCAN', 'second');
    });
  });

  describe('updateToSchemaVersion58', () => {
    it('updates unseenStatus for previously-unread messages', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const MESSAGE_ID_5 = generateGuid();
      const MESSAGE_ID_6 = generateGuid();
      const MESSAGE_ID_7 = generateGuid();
      const MESSAGE_ID_8 = generateGuid();
      const MESSAGE_ID_9 = generateGuid();
      const MESSAGE_ID_10 = generateGuid();
      const MESSAGE_ID_11 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(db, 55);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type, readStatus)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'call-history', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'change-number-notification', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'chat-session-refreshed', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}', 'delivery-issue', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_5}', '${CONVERSATION_ID}', 'group', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_6}', '${CONVERSATION_ID}', 'incoming', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_7}', '${CONVERSATION_ID}', 'keychange', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_8}', '${CONVERSATION_ID}', 'timer-notification', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_9}', '${CONVERSATION_ID}', 'verified-change', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_10}', '${CONVERSATION_ID}', NULL, ${ReadStatus.Unread}),
          ('${MESSAGE_ID_11}', '${CONVERSATION_ID}', 'other', ${ReadStatus.Unread});
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        11,
        'starting total'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE readStatus = ${ReadStatus.Unread};`
          )
          .pluck()
          .get(),
        11,
        'starting unread count'
      );

      updateToVersion(db, 56);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        11,
        'ending total'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE readStatus = ${ReadStatus.Unread};`
          )
          .pluck()
          .get(),
        10,
        'ending unread count'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE seenStatus = ${SeenStatus.Unseen};`
          )
          .pluck()
          .get(),
        10,
        'ending unseen count'
      );

      assert.strictEqual(
        db
          .prepare(
            "SELECT readStatus FROM messages WHERE type = 'other' LIMIT 1;"
          )
          .pluck()
          .get(),
        ReadStatus.Read,
        "checking read status for 'other' message"
      );
    });

    it('Sets readStatus=Read for keychange and change-number-notification messages', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(db, 57);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type, readStatus)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'incoming', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'change-number-notification', ${ReadStatus.Unread}),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'keychange', ${ReadStatus.Unread});
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        3,
        'starting total'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE readStatus = ${ReadStatus.Unread};`
          )
          .pluck()
          .get(),
        3,
        'starting unread count'
      );

      updateToVersion(db, 58);

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        3,
        'ending total'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT COUNT(*) FROM messages WHERE readStatus = ${ReadStatus.Unread};`
          )
          .pluck()
          .get(),
        1,
        'ending unread count'
      );

      assert.strictEqual(
        db
          .prepare(
            "SELECT readStatus FROM messages WHERE type = 'keychange' LIMIT 1;"
          )
          .pluck()
          .get(),
        ReadStatus.Read,
        "checking read status for 'keychange' message"
      );
      assert.strictEqual(
        db
          .prepare(
            "SELECT seenStatus FROM messages WHERE type = 'keychange' LIMIT 1;"
          )
          .pluck()
          .get(),
        SeenStatus.Unseen,
        "checking seen status for 'keychange' message"
      );
    });

    it('updates readStatus/seenStatus for messages with unread: true/1 in JSON', () => {
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(db, 57);

      // prettier-ignore
      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type, readStatus, seenStatus, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'incoming', ${ReadStatus.Unread}, NULL, '${JSON.stringify(
            { body: 'message1' }
          )}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'incoming', ${ReadStatus.Read}, NULL, '${JSON.stringify(
            { body: 'message2' }
          )}'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'incoming', NULL, ${SeenStatus.Unseen}, '${JSON.stringify(
            { body: 'message3' }
           )}'),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}', 'incoming', NULL, ${SeenStatus.Seen}, '${JSON.stringify(
            { body: 'message4' }
          )}');
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        4,
        'starting total'
      );

      updateToVersion(db, 58);

      assert.strictEqual(
        db
          .prepare(
            `SELECT json FROM messages WHERE id = '${MESSAGE_ID_1}' LIMIT 1;`
          )
          .pluck()
          .get(),
        JSON.stringify({
          body: 'message1',
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
        }),
        'checking JSON for message1'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT json FROM messages WHERE id = '${MESSAGE_ID_2}' LIMIT 1;`
          )
          .pluck()
          .get(),
        JSON.stringify({ body: 'message2', readStatus: ReadStatus.Read }),
        'checking JSON for message2'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT json FROM messages WHERE id = '${MESSAGE_ID_3}' LIMIT 1;`
          )
          .pluck()
          .get(),
        JSON.stringify({
          body: 'message3',
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Unseen,
        }),
        'checking JSON for message3'
      );
      assert.strictEqual(
        db
          .prepare(
            `SELECT json FROM messages WHERE id = '${MESSAGE_ID_4}' LIMIT 1;`
          )
          .pluck()
          .get(),
        JSON.stringify({
          body: 'message4',
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Seen,
        }),
        'checking JSON for message4'
      );
    });
  });

  describe('updateToSchemaVersion60', () => {
    it('updates index to make query efficient', () => {
      updateToVersion(db, 60);

      const items = db
        .prepare(
          `
        EXPLAIN QUERY PLAN
        UPDATE messages
        INDEXED BY expiring_message_by_conversation_and_received_at
        SET
          expirationStartTimestamp = 342342,
          json = json_patch(json, '{ "something": true }')
        WHERE
          conversationId = 'conversationId' AND
          storyId IS NULL AND
          isStory IS 0 AND
          type IS 'incoming' AND
          (
            expirationStartTimestamp IS NULL OR
            expirationStartTimestamp > 23423423
          ) AND
          expireTimer > 0 AND
          received_at <= 234234;
        `
        )
        .all();
      const detail = items.map(item => item.detail).join('\n');

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX ' +
          'expiring_message_by_conversation_and_received_at ' +
          '(conversationId=? AND storyId=?)'
      );
    });
  });

  describe('updateToSchemaVersion62', () => {
    it('adds new urgent field to sendLogPayloads', () => {
      updateToVersion(db, 62);

      const timestamp = Date.now();
      db.exec(
        `
        INSERT INTO sendLogPayloads
          (contentHint, timestamp, proto, urgent)
          VALUES
          (1, ${timestamp}, X'0123456789ABCDEF', 1);
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM sendLogPayloads;').pluck().get(),
        1,
        'starting total'
      );

      const payload = db
        .prepare('SELECT * FROM sendLogPayloads LIMIT 1;')
        .get();

      assert.strictEqual(payload.contentHint, 1);
      assert.strictEqual(payload.timestamp, timestamp);
      assert.strictEqual(payload.proto.length, 8);
      assert.strictEqual(payload.urgent, 1);
    });
  });

  describe('updateToSchemaVersion65', () => {
    it('initializes sticker pack positions', () => {
      updateToVersion(db, 64);

      db.exec(
        `
        INSERT INTO sticker_packs
          (id, key, lastUsed)
          VALUES
          ('a', 'key-1', 1),
          ('b', 'key-2', 2),
          ('c', 'key-3', 3);
        `
      );

      updateToVersion(db, 65);

      assert.deepStrictEqual(
        db
          .prepare(
            'SELECT id, position FROM sticker_packs ORDER BY position DESC'
          )
          .all(),
        [
          { id: 'a', position: 2 },
          { id: 'b', position: 1 },
          { id: 'c', position: 0 },
        ]
      );
    });
  });

  describe('updateToSchemaVersion69', () => {
    beforeEach(() => {
      updateToVersion(db, 69);
    });

    it('removes the legacy groupCallRings table', () => {
      const tableCount = db
        .prepare(
          `
          SELECT COUNT(*) FROM sqlite_schema
          WHERE type = 'table'
          AND name = 'groupCallRings'
          `
        )
        .pluck();

      assert.strictEqual(tableCount.get(), 0);
    });

    it('adds the groupCallRingCancellations table', () => {
      assert.doesNotThrow(() => {
        db.exec(
          `
          INSERT INTO groupCallRingCancellations
          (ringId, createdAt)
          VALUES (1, 2);
          `
        );
      });
    });
  });

  describe('updateToSchemaVersion71', () => {
    it('deletes and re-creates auto-generated shouldAffectActivity/shouldAffectPreview/isUserInitiatedMessage fields', () => {
      const MESSAGE_ID_0 = generateGuid();
      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();
      const MESSAGE_ID_4 = generateGuid();
      const MESSAGE_ID_5 = generateGuid();
      const MESSAGE_ID_6 = generateGuid();
      const MESSAGE_ID_7 = generateGuid();
      const CONVERSATION_ID = generateGuid();

      updateToVersion(db, 71);

      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, type)
          VALUES
          ('${MESSAGE_ID_0}', '${CONVERSATION_ID}', NULL),
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID}', 'story'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID}', 'keychange'),
          ('${MESSAGE_ID_3}', '${CONVERSATION_ID}', 'outgoing'),
          ('${MESSAGE_ID_4}', '${CONVERSATION_ID}', 'group-v2-change'),
          ('${MESSAGE_ID_5}', '${CONVERSATION_ID}', 'phone-number-discovery'),
          ('${MESSAGE_ID_6}', '${CONVERSATION_ID}', 'conversation-merge'),
          ('${MESSAGE_ID_7}', '${CONVERSATION_ID}', 'incoming');
        `
      );

      assert.strictEqual(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        8,
        'total'
      );

      // Four: NULL, incoming, outgoing, and group-v2-change
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE shouldAffectPreview IS 1;'
          )
          .pluck()
          .get(),
        4,
        'shouldAffectPreview'
      );
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE shouldAffectActivity IS 1;'
          )
          .pluck()
          .get(),
        4,
        'shouldAffectActivity'
      );

      // Three: NULL, incoming, outgoing
      assert.strictEqual(
        db
          .prepare(
            'SELECT COUNT(*) FROM messages WHERE isUserInitiatedMessage IS 1;'
          )
          .pluck()
          .get(),
        3,
        'isUserInitiatedMessage'
      );
    });
  });

  describe('updateToSchemaVersion78', () => {
    it('moves receipt jobs over to conversation queue', () => {
      updateToVersion(db, 77);

      const MESSAGE_ID_1 = generateGuid();
      const CONVERSATION_ID_1 = generateGuid();

      db.exec(
        `
        INSERT INTO messages
        (id, conversationId)
        VALUES ('${MESSAGE_ID_1}', '${CONVERSATION_ID_1}');
        `
      );

      insertJob(db, {
        id: 'id-1',
        timestamp: 1,
        queueType: 'random job',
        data: {},
      });
      insertJob(db, {
        id: 'id-2',
        timestamp: 2,
        queueType: 'delivery receipts',
        data: {
          messageId: MESSAGE_ID_1,
          deliveryReceipts: [],
        },
      });
      insertJob(db, {
        id: 'id-3',
        timestamp: 3,
        queueType: 'read receipts',
        data: {
          messageId: MESSAGE_ID_1,
          readReceipts: [],
        },
      });
      insertJob(db, {
        id: 'id-4',
        timestamp: 4,
        queueType: 'viewed receipts',
        data: {
          messageId: MESSAGE_ID_1,
          viewedReceipt: {},
        },
      });
      insertJob(db, {
        id: 'id-5',
        timestamp: 5,
        queueType: 'conversation',
        data: {},
      });

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();
      const deliveryJobs = db
        .prepare(
          "SELECT COUNT(*) FROM jobs WHERE queueType = 'delivery receipts';"
        )
        .pluck();
      const readJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'read receipts';")
        .pluck();
      const viewedJobs = db
        .prepare(
          "SELECT COUNT(*) FROM jobs WHERE queueType = 'viewed receipts';"
        )
        .pluck();

      assert.strictEqual(totalJobs.get(), 5, 'before total');
      assert.strictEqual(conversationJobs.get(), 1, 'before conversation');
      assert.strictEqual(deliveryJobs.get(), 1, 'before delivery');
      assert.strictEqual(readJobs.get(), 1, 'before read');
      assert.strictEqual(viewedJobs.get(), 1, 'before viewed');

      updateToVersion(db, 78);

      assert.strictEqual(totalJobs.get(), 5, 'after total');
      assert.strictEqual(conversationJobs.get(), 4, 'after conversation');
      assert.strictEqual(deliveryJobs.get(), 0, 'after delivery');
      assert.strictEqual(readJobs.get(), 0, 'after read');
      assert.strictEqual(viewedJobs.get(), 0, 'after viewed');
    });

    it('updates delivery jobs with their conversationId', () => {
      updateToVersion(db, 77);

      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();

      const CONVERSATION_ID_1 = generateGuid();
      const CONVERSATION_ID_2 = generateGuid();

      insertJob(db, {
        id: 'id-1',
        timestamp: 1,
        queueType: 'delivery receipts',
        data: {
          messageId: MESSAGE_ID_1,
          deliveryReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 1,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-2',
        timestamp: 2,
        queueType: 'delivery receipts',
        data: {
          messageId: MESSAGE_ID_2,
          deliveryReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 2,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-3-missing-data',
        timestamp: 3,
        queueType: 'delivery receipts',
      });
      insertJob(db, {
        id: 'id-4-non-string-messageId',
        timestamp: 4,
        queueType: 'delivery receipts',
        data: {
          messageId: 4,
          deliveryReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 4,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-5-missing-message',
        timestamp: 5,
        queueType: 'delivery receipts',
        data: {
          messageId: 'missing',
          deliveryReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 5,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-6-missing-conversation',
        timestamp: 6,
        queueType: 'delivery receipts',
        data: {
          messageId: MESSAGE_ID_3,
          deliveryReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 6,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-7-missing-delivery-receipts',
        timestamp: 7,
        queueType: 'delivery receipts',
        data: {
          messageId: MESSAGE_ID_3,
        },
      });

      const messageJson1 = JSON.stringify({
        conversationId: CONVERSATION_ID_1,
      });
      const messageJson2 = JSON.stringify({
        conversationId: CONVERSATION_ID_2,
      });
      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID_1}', '${messageJson1}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID_2}', '${messageJson2}'),
          ('${MESSAGE_ID_3}', null, '{}');
        `
      );

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();
      const deliveryJobs = db
        .prepare(
          "SELECT COUNT(*) FROM jobs WHERE queueType = 'delivery receipts';"
        )
        .pluck();

      assert.strictEqual(totalJobs.get(), 7, 'total jobs before');
      assert.strictEqual(conversationJobs.get(), 0, 'conversation jobs before');
      assert.strictEqual(deliveryJobs.get(), 7, 'delivery jobs before');

      updateToVersion(db, 78);

      assert.strictEqual(totalJobs.get(), 2, 'total jobs after');
      assert.strictEqual(conversationJobs.get(), 2, 'conversation jobs after');
      assert.strictEqual(deliveryJobs.get(), 0, 'delivery jobs after');

      const jobs = getJobsInQueue(db, 'conversation');

      assert.deepEqual(jobs, [
        {
          id: 'id-1',
          timestamp: 1,
          queueType: 'conversation',
          data: {
            type: 'Receipts',
            conversationId: CONVERSATION_ID_1,
            receiptsType: 'deliveryReceipt',
            receipts: [
              {
                messageId: MESSAGE_ID_1,
                conversationId: CONVERSATION_ID_1,
                timestamp: 1,
              },
            ],
          },
        },
        {
          id: 'id-2',
          timestamp: 2,
          queueType: 'conversation',
          data: {
            type: 'Receipts',
            conversationId: CONVERSATION_ID_2,
            receiptsType: 'deliveryReceipt',
            receipts: [
              {
                messageId: MESSAGE_ID_1,
                conversationId: CONVERSATION_ID_2,
                timestamp: 2,
              },
            ],
          },
        },
      ]);
    });

    it('updates read jobs with their conversationId', () => {
      updateToVersion(db, 77);

      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();

      const CONVERSATION_ID_1 = generateGuid();
      const CONVERSATION_ID_2 = generateGuid();

      insertJob(db, {
        id: 'id-1',
        timestamp: 1,
        queueType: 'read receipts',
        data: {
          messageId: MESSAGE_ID_1,
          readReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 1,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-2',
        timestamp: 2,
        queueType: 'read receipts',
        data: {
          messageId: MESSAGE_ID_2,
          readReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 2,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-3-missing-data',
        timestamp: 3,
        queueType: 'read receipts',
      });
      insertJob(db, {
        id: 'id-4-non-string-messageId',
        timestamp: 4,
        queueType: 'read receipts',
        data: {
          messageId: 4,
          readReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 4,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-5-missing-message',
        timestamp: 5,
        queueType: 'read receipts',
        data: {
          messageId: 'missing',
          readReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 5,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-6-missing-conversation',
        timestamp: 6,
        queueType: 'read receipts',
        data: {
          messageId: MESSAGE_ID_3,
          readReceipts: [
            {
              messageId: MESSAGE_ID_1,
              timestamp: 6,
            },
          ],
        },
      });
      insertJob(db, {
        id: 'id-7-missing-read-receipts',
        timestamp: 7,
        queueType: 'read receipts',
        data: {
          messageId: MESSAGE_ID_3,
        },
      });

      const messageJson1 = JSON.stringify({
        conversationId: CONVERSATION_ID_1,
      });
      const messageJson2 = JSON.stringify({
        conversationId: CONVERSATION_ID_2,
      });
      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID_1}', '${messageJson1}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID_2}', '${messageJson2}'),
          ('${MESSAGE_ID_3}', null, '{}');
        `
      );

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();
      const readJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'read receipts';")
        .pluck();

      assert.strictEqual(totalJobs.get(), 7, 'total jobs before');
      assert.strictEqual(conversationJobs.get(), 0, 'conversation jobs before');
      assert.strictEqual(readJobs.get(), 7, 'delivery jobs before');

      updateToVersion(db, 78);

      assert.strictEqual(totalJobs.get(), 2, 'total jobs after');
      assert.strictEqual(conversationJobs.get(), 2, 'conversation jobs after');
      assert.strictEqual(readJobs.get(), 0, 'read jobs after');

      const jobs = getJobsInQueue(db, 'conversation');

      assert.deepEqual(jobs, [
        {
          id: 'id-1',
          timestamp: 1,
          queueType: 'conversation',
          data: {
            type: 'Receipts',
            conversationId: CONVERSATION_ID_1,
            receiptsType: 'readReceipt',
            receipts: [
              {
                messageId: MESSAGE_ID_1,
                conversationId: CONVERSATION_ID_1,
                timestamp: 1,
              },
            ],
          },
        },
        {
          id: 'id-2',
          timestamp: 2,
          queueType: 'conversation',
          data: {
            type: 'Receipts',
            conversationId: CONVERSATION_ID_2,
            receiptsType: 'readReceipt',
            receipts: [
              {
                messageId: MESSAGE_ID_1,
                conversationId: CONVERSATION_ID_2,
                timestamp: 2,
              },
            ],
          },
        },
      ]);
    });

    it('updates viewed jobs with their conversationId', () => {
      updateToVersion(db, 77);

      const MESSAGE_ID_1 = generateGuid();
      const MESSAGE_ID_2 = generateGuid();
      const MESSAGE_ID_3 = generateGuid();

      const CONVERSATION_ID_1 = generateGuid();
      const CONVERSATION_ID_2 = generateGuid();

      insertJob(db, {
        id: 'id-1',
        timestamp: 1,
        queueType: 'viewed receipts',
        data: {
          messageId: MESSAGE_ID_1,
          viewedReceipt: {
            messageId: MESSAGE_ID_1,
            timestamp: 1,
          },
        },
      });
      insertJob(db, {
        id: 'id-2',
        timestamp: 2,
        queueType: 'viewed receipts',
        data: {
          messageId: MESSAGE_ID_2,
          viewedReceipt: {
            messageId: MESSAGE_ID_1,
            timestamp: 2,
          },
        },
      });
      insertJob(db, {
        id: 'id-3-missing-data',
        timestamp: 3,
        queueType: 'viewed receipts',
      });
      insertJob(db, {
        id: 'id-4-non-string-messageId',
        timestamp: 4,
        queueType: 'viewed receipts',
        data: {
          messageId: 4,
          viewedReceipt: {
            messageId: MESSAGE_ID_1,
            timestamp: 4,
          },
        },
      });
      insertJob(db, {
        id: 'id-5-missing-message',
        timestamp: 5,
        queueType: 'viewed receipts',
        data: {
          messageId: 'missing',
          viewedReceipt: {
            messageId: MESSAGE_ID_1,
            timestamp: 5,
          },
        },
      });
      insertJob(db, {
        id: 'id-6-missing-conversation',
        timestamp: 6,
        queueType: 'viewed receipts',
        data: {
          messageId: MESSAGE_ID_3,
          viewedReceipt: {
            messageId: MESSAGE_ID_1,
            timestamp: 6,
          },
        },
      });
      insertJob(db, {
        id: 'id-7-missing-viewed-receipt',
        timestamp: 7,
        queueType: 'viewed receipts',
        data: {
          messageId: MESSAGE_ID_3,
        },
      });

      const messageJson1 = JSON.stringify({
        conversationId: CONVERSATION_ID_1,
      });
      const messageJson2 = JSON.stringify({
        conversationId: CONVERSATION_ID_2,
      });
      db.exec(
        `
        INSERT INTO messages
          (id, conversationId, json)
          VALUES
          ('${MESSAGE_ID_1}', '${CONVERSATION_ID_1}', '${messageJson1}'),
          ('${MESSAGE_ID_2}', '${CONVERSATION_ID_2}', '${messageJson2}'),
          ('${MESSAGE_ID_3}', null, '{}');
        `
      );

      const totalJobs = db.prepare('SELECT COUNT(*) FROM jobs;').pluck();
      const conversationJobs = db
        .prepare("SELECT COUNT(*) FROM jobs WHERE queueType = 'conversation';")
        .pluck();
      const viewedJobs = db
        .prepare(
          "SELECT COUNT(*) FROM jobs WHERE queueType = 'viewed receipts';"
        )
        .pluck();

      assert.strictEqual(totalJobs.get(), 7, 'total jobs before');
      assert.strictEqual(conversationJobs.get(), 0, 'conversation jobs before');
      assert.strictEqual(viewedJobs.get(), 7, 'delivery jobs before');

      updateToVersion(db, 78);

      assert.strictEqual(totalJobs.get(), 2, 'total jobs after');
      assert.strictEqual(conversationJobs.get(), 2, 'conversation jobs after');
      assert.strictEqual(viewedJobs.get(), 0, 'viewed jobs after');

      const jobs = getJobsInQueue(db, 'conversation');

      assert.deepEqual(jobs, [
        {
          id: 'id-1',
          timestamp: 1,
          queueType: 'conversation',
          data: {
            type: 'Receipts',
            conversationId: CONVERSATION_ID_1,
            receiptsType: 'viewedReceipt',
            receipts: [
              {
                messageId: MESSAGE_ID_1,
                conversationId: CONVERSATION_ID_1,
                timestamp: 1,
              },
            ],
          },
        },
        {
          id: 'id-2',
          timestamp: 2,
          queueType: 'conversation',
          data: {
            type: 'Receipts',
            conversationId: CONVERSATION_ID_2,
            receiptsType: 'viewedReceipt',
            receipts: [
              {
                messageId: MESSAGE_ID_1,
                conversationId: CONVERSATION_ID_2,
                timestamp: 2,
              },
            ],
          },
        },
      ]);
    });
  });

  describe('updateToSchemaVersion83', () => {
    beforeEach(() => updateToVersion(db, 83));

    it('ensures that index is used for getTotalUnreadMentionsOfMeForConversation, no storyId', () => {
      const { detail } = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT count(1)
          FROM messages
          WHERE
            conversationId = 'conversationId' AND
            readStatus = ${ReadStatus.Unread} AND
            mentionsMe IS 1 AND
            isStory IS 0 AND
            NULL IS NULL
          `
        )
        .get();

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_unread_mentions_no_story_id (conversationId=? AND readStatus=? AND mentionsMe=? AND isStory=?)'
      );
    });

    it('ensures that index is used for getTotalUnreadMentionsOfMeForConversation, with storyId', () => {
      const { detail } = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT count(1)
          FROM messages
          WHERE
            conversationId = 'conversationId' AND
            readStatus = ${ReadStatus.Unread} AND
            mentionsMe IS 1 AND
            isStory IS 0 AND
            storyId IS 'storyId'
          `
        )
        .get();

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_unread_mentions (conversationId=? AND readStatus=? AND mentionsMe=? AND isStory=? AND storyId=?)'
      );
    });

    it('ensures that index is used for getOldestUnreadMentionOfMeForConversation, no storyId', () => {
      const { detail } = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT received_at, sent_at, id FROM messages WHERE
            conversationId = 'conversationId' AND
            readStatus = ${ReadStatus.Unread} AND
            mentionsMe IS 1 AND
            isStory IS 0 AND
            NULL is NULL
          ORDER BY received_at ASC, sent_at ASC
          LIMIT 1;
          `
        )
        .get();

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_unread_mentions_no_story_id (conversationId=? AND readStatus=? AND mentionsMe=? AND isStory=?)'
      );
    });

    it('ensures that index is used for getOldestUnreadMentionOfMeForConversation, with storyId', () => {
      const { detail } = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT received_at, sent_at, id FROM messages WHERE
            conversationId = 'conversationId' AND
            readStatus = ${ReadStatus.Unread} AND
            mentionsMe IS 1 AND
            isStory IS 0 AND
            storyId IS 'storyId'
          ORDER BY received_at ASC, sent_at ASC
          LIMIT 1;
          `
        )
        .get();

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_unread_mentions (conversationId=? AND readStatus=? AND mentionsMe=? AND isStory=? AND storyId=?)'
      );
    });
  });

  describe('updateToSchemaVersion84', () => {
    const schemaVersion = 84;
    function composeMessage({
      id,
      mentions,
      boldRanges,
    }: {
      id?: string;
      mentions?: Array<AciString>;
      boldRanges?: Array<Array<number>>;
    }) {
      const json: Partial<{
        id: string;
        body: string;
        bodyRanges: Array<unknown>;
      }> = {
        id: id ?? generateGuid(),
        body: `Message body: ${id}`,
      };
      if (mentions) {
        json.bodyRanges = mentions.map((mentionUuid, mentionIdx) => ({
          start: mentionIdx,
          length: 1,
          mentionUuid,
        }));
      }

      // Add some other body ranges in that are not mentions
      if (boldRanges) {
        json.bodyRanges = (json.bodyRanges ?? []).concat(
          boldRanges.map(([start, length]) => ({
            start,
            length,
            style: BodyRange.Style.BOLD,
          }))
        );
      }
      return json;
    }

    function addMessages(
      messages: Array<{
        mentions?: Array<AciString>;
        boldRanges?: Array<Array<number>>;
      }>
    ) {
      const formattedMessages = messages.map(composeMessage);

      db.exec(
        `
        INSERT INTO messages
          (id, json)
        VALUES
          ${formattedMessages
            .map(message => `('${message.id}', '${objectToJSON(message)}')`)
            .join(', ')};
        `
      );

      assert.equal(
        db.prepare('SELECT COUNT(*) FROM messages;').pluck().get(),
        messages.length
      );

      return { formattedMessages };
    }

    function getMentions() {
      return db
        .prepare('SELECT messageId, mentionUuid, start, length FROM mentions;')
        .all();
    }

    it('Creates and populates the mentions table with existing mentions', () => {
      updateToVersion(db, schemaVersion - 1);

      const userIds = new Array(5).fill(undefined).map(() => generateAci());
      const { formattedMessages } = addMessages([
        { mentions: [userIds[0]] },
        { mentions: [userIds[1]], boldRanges: [[1, 1]] },
        { mentions: [userIds[1], userIds[2]] },
        {},
        { boldRanges: [[1, 4]] },
      ]);

      // now create mentions table
      updateToVersion(db, schemaVersion);

      // only the 4 mentions should be included, with multiple rows for multiple mentions
      // in a message
      const mentions = getMentions();

      assert.equal(mentions.length, 4);
      assert.sameDeepMembers(mentions, [
        {
          messageId: formattedMessages[0].id,
          mentionUuid: userIds[0],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[1].id,
          mentionUuid: userIds[1],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[2].id,
          mentionUuid: userIds[1],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[2].id,
          mentionUuid: userIds[2],
          start: 1,
          length: 1,
        },
      ]);
    });

    it('Updates mention table when new messages are added', () => {
      updateToVersion(db, schemaVersion);
      assert.equal(
        db.prepare('SELECT COUNT(*) FROM mentions;').pluck().get(),
        0
      );

      const userIds = new Array(5).fill(undefined).map(() => generateAci());
      const { formattedMessages } = addMessages([
        { mentions: [userIds[0]] },
        { mentions: [userIds[1]], boldRanges: [[1, 1]] },
        { mentions: [userIds[1], userIds[2]] },
        {},
        { boldRanges: [[1, 4]] },
      ]);

      // the 4 mentions should be included, with multiple rows for multiple mentions in a
      // message
      const mentions = getMentions();

      assert.sameDeepMembers(mentions, [
        {
          messageId: formattedMessages[0].id,
          mentionUuid: userIds[0],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[1].id,
          mentionUuid: userIds[1],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[2].id,
          mentionUuid: userIds[1],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[2].id,
          mentionUuid: userIds[2],
          start: 1,
          length: 1,
        },
      ]);
    });

    it('Removes mentions when messages are deleted', () => {
      updateToVersion(db, schemaVersion);
      assert.equal(
        db.prepare('SELECT COUNT(*) FROM mentions;').pluck().get(),
        0
      );

      const userIds = new Array(5).fill(undefined).map(() => generateAci());
      const { formattedMessages } = addMessages([
        { mentions: [userIds[0]] },
        { mentions: [userIds[1], userIds[2]], boldRanges: [[1, 1]] },
      ]);

      assert.equal(getMentions().length, 3);

      // The foreign key ON DELETE CASCADE relationship should delete mentions when the
      // referenced message is deleted
      db.exec(`DELETE FROM messages WHERE id = '${formattedMessages[1].id}';`);
      const mentions = getMentions();
      assert.equal(getMentions().length, 1);
      assert.sameDeepMembers(mentions, [
        {
          messageId: formattedMessages[0].id,
          mentionUuid: userIds[0],
          start: 0,
          length: 1,
        },
      ]);
    });

    it('Updates mentions when messages are updated', () => {
      updateToVersion(db, schemaVersion);
      assert.equal(
        db.prepare('SELECT COUNT(*) FROM mentions;').pluck().get(),
        0
      );

      const userIds = new Array(5).fill(undefined).map(() => generateAci());
      const { formattedMessages } = addMessages([{ mentions: [userIds[0]] }]);

      assert.equal(getMentions().length, 1);

      // update it with 0 mentions
      db.prepare(
        `UPDATE messages SET json = $json WHERE id = '${formattedMessages[0].id}';`
      ).run({
        json: objectToJSON(composeMessage({ id: formattedMessages[0].id })),
      });
      assert.equal(getMentions().length, 0);

      // update it with a bold bodyrange
      db.prepare(
        `UPDATE messages SET json = $json WHERE id = '${formattedMessages[0].id}';`
      ).run({
        json: objectToJSON(
          composeMessage({ id: formattedMessages[0].id, boldRanges: [[1, 2]] })
        ),
      });
      assert.equal(getMentions().length, 0);

      // update it with a three new mentions
      db.prepare(
        `UPDATE messages SET json = $json WHERE id = '${formattedMessages[0].id}';`
      ).run({
        json: objectToJSON(
          composeMessage({
            id: formattedMessages[0].id,
            mentions: [userIds[2], userIds[3], userIds[4]],
            boldRanges: [[1, 2]],
          })
        ),
      });
      assert.sameDeepMembers(getMentions(), [
        {
          messageId: formattedMessages[0].id,
          mentionUuid: userIds[2],
          start: 0,
          length: 1,
        },
        {
          messageId: formattedMessages[0].id,
          mentionUuid: userIds[3],
          start: 1,
          length: 1,
        },
        {
          messageId: formattedMessages[0].id,
          mentionUuid: userIds[4],
          start: 2,
          length: 1,
        },
      ]);
    });
    it('uses the mentionUuid index for searching mentions', () => {
      updateToVersion(db, schemaVersion);
      const [query, params] = sql`
        EXPLAIN QUERY PLAN
        SELECT
          messages.rowid,
          mentionUuid
        FROM mentions
        INNER JOIN messages
        ON
          messages.id = mentions.messageId
          AND mentions.mentionUuid IN (
            ${sqlJoin(['a', 'b', 'c'])}
          )
          AND messages.isViewOnce IS NOT 1
          AND messages.storyId IS NULL

        LIMIT 100;
        `;
      const { detail } = db.prepare(query).get(params);

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH mentions USING INDEX mentions_uuid (mentionUuid=?)'
      );
    });
  });

  describe('updateToSchemaVersion85', () => {
    it('generates ourUuid field when JSON is inserted', () => {
      updateToVersion(db, 85);
      const id = 'a1111:a2222';
      const ourUuid = 'ab3333';
      const value = {
        ourUuid,
      };
      const json = JSON.stringify(value);
      db.prepare(
        `
          INSERT INTO kyberPreKeys (id, json) VALUES
          ('${id}', '${json}');
          `
      ).run();

      const payload = db.prepare('SELECT * FROM kyberPreKeys LIMIT 1;').get();

      assert.strictEqual(payload.id, id);
      assert.strictEqual(payload.json, json);
      assert.strictEqual(payload.ourUuid, ourUuid);
    });

    it('adds a createdAt to all existing prekeys', () => {
      updateToVersion(db, 84);

      const id = 'a1111:a2222';
      const ourUuid = 'ab3333';
      const value = {
        ourUuid,
      };
      const startingTime = Date.now();
      const json = JSON.stringify(value);
      db.prepare(
        `
          INSERT INTO preKeys (id, json) VALUES
          ('${id}', '${json}');
          `
      ).run();

      updateToVersion(db, 85);

      const payload = db.prepare('SELECT * FROM preKeys LIMIT 1;').get();

      assert.strictEqual(payload.id, id);

      const object = JSON.parse(payload.json);
      assert.strictEqual(object.ourUuid, ourUuid);
      assert.isAtLeast(object.createdAt, startingTime);
    });
  });

  describe('updateToSchemaVersion86', () => {
    it('supports the right index for first query used in getRecentStoryRepliesSync', () => {
      updateToVersion(db, 86);
      const [query, params] = sql`
        EXPLAIN QUERY PLAN
        SELECT json FROM messages WHERE
          ('messageId' IS NULL OR id IS NOT 'messageId') AND
          isStory IS 0 AND
          storyId IS 'storyId' AND
          received_at = 100000 AND sent_at < 100000
          ORDER BY received_at DESC, sent_at DESC
          LIMIT 100
      `;
      const { detail } = db.prepare(query).get(params);

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_story_replies (storyId=? AND received_at=? AND sent_at<?)'
      );
    });

    it('supports the right index for second query used in getRecentStoryRepliesSync', () => {
      updateToVersion(db, 86);
      const [query, params] = sql`
        EXPLAIN QUERY PLAN
        SELECT json FROM messages WHERE
          ('messageId' IS NULL OR id IS NOT 'messageId') AND
          isStory IS 0 AND
          storyId IS 'storyId' AND
          received_at < 100000
          ORDER BY received_at DESC, sent_at DESC
          LIMIT 100
      `;
      const { detail } = db.prepare(query).get(params);

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_story_replies (storyId=? AND received_at<?)'
      );
    });
  });
});
