// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';
import { constantTimeEqual, getRandomBytes } from '../../Crypto';

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

const {
  _getAllSentProtoMessageIds,
  _getAllSentProtoRecipients,
  deleteSentProtoByMessageId,
  deleteSentProtoRecipient,
  deleteSentProtosOlderThan,
  getAllSentProtos,
  getSentProtoByRecipient,
  insertProtoRecipients,
  insertSentProto,
  removeAllSentProtos,
  removeMessage,
  saveMessage,
} = dataInterface;

describe('sql/sendLog', () => {
  beforeEach(async () => {
    await removeAllSentProtos();
  });

  it('roundtrips with insertSentProto/getAllSentProtos', async () => {
    const bytes = getRandomBytes(128);
    const timestamp = Date.now();
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
      urgent: false,
    };
    await insertSentProto(proto, {
      messageIds: [getUuid()],
      recipients: {
        [getUuid()]: [1, 2],
      },
    });
    const allProtos = await getAllSentProtos();

    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.contentHint, proto.contentHint);
    assert.isTrue(constantTimeEqual(actual.proto, proto.proto));
    assert.strictEqual(actual.timestamp, proto.timestamp);
    assert.strictEqual(actual.urgent, proto.urgent);

    await removeAllSentProtos();

    assert.lengthOf(await getAllSentProtos(), 0);
  });

  it('cascades deletes into both tables with foreign keys', async () => {
    assert.lengthOf(await getAllSentProtos(), 0);
    assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
    assert.lengthOf(await _getAllSentProtoRecipients(), 0);

    const bytes = getRandomBytes(128);
    const timestamp = Date.now();
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
      urgent: true,
    };
    await insertSentProto(proto, {
      messageIds: [getUuid(), getUuid()],
      recipients: {
        [getUuid()]: [1, 2],
        [getUuid()]: [1],
      },
    });

    const allProtos = await getAllSentProtos();
    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.contentHint, proto.contentHint);
    assert.isTrue(constantTimeEqual(actual.proto, proto.proto));
    assert.strictEqual(actual.timestamp, proto.timestamp);
    assert.strictEqual(actual.urgent, proto.urgent);

    assert.lengthOf(await _getAllSentProtoMessageIds(), 2);
    assert.lengthOf(await _getAllSentProtoRecipients(), 3);

    await removeAllSentProtos();

    assert.lengthOf(await getAllSentProtos(), 0);
    assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
    assert.lengthOf(await _getAllSentProtoRecipients(), 0);
  });

  it('trigger deletes payload when referenced message is deleted', async () => {
    const id = getUuid();
    const timestamp = Date.now();
    const ourUuid = getUuid();

    await saveMessage(
      {
        id,

        body: 'some text',
        conversationId: getUuid(),
        received_at: timestamp,
        sent_at: timestamp,
        timestamp,
        type: 'outgoing',
      },
      { forceSave: true, ourUuid }
    );

    const bytes = getRandomBytes(128);
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
      urgent: false,
    };
    await insertSentProto(proto, {
      messageIds: [id],
      recipients: {
        [getUuid()]: [1, 2],
      },
    });
    const allProtos = await getAllSentProtos();

    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.timestamp, proto.timestamp);

    await removeMessage(id);

    assert.lengthOf(await getAllSentProtos(), 0);
  });

  describe('#insertSentProto', () => {
    it('supports adding duplicates', async () => {
      const timestamp = Date.now();

      const messageIds = [getUuid()];
      const recipients = {
        [getUuid()]: [1],
      };
      const proto1 = {
        contentHint: 7,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      const proto2 = {
        contentHint: 9,
        proto: getRandomBytes(128),
        timestamp,
        urgent: false,
      };

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);

      await insertSentProto(proto1, { messageIds, recipients });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      await insertSentProto(proto2, { messageIds, recipients });

      assert.lengthOf(await getAllSentProtos(), 2);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 2);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
    });
  });

  describe('#insertProtoRecipients', () => {
    it('handles duplicates, adding new recipients if needed', async () => {
      const timestamp = Date.now();

      const messageIds = [getUuid()];
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);

      const id = await insertSentProto(proto, {
        messageIds,
        recipients: {
          [getUuid()]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      const recipientUuid = getUuid();
      await insertProtoRecipients({
        id,
        recipientUuid,
        deviceIds: [1, 2],
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);
    });
  });

  describe('#deleteSentProtosOlderThan', () => {
    it('deletes all older timestamps', async () => {
      const timestamp = Date.now();

      const proto1 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp: timestamp + 10,
        urgent: true,
      };
      const proto2 = {
        contentHint: 2,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      const proto3 = {
        contentHint: 0,
        proto: getRandomBytes(128),
        timestamp: timestamp - 15,
        urgent: true,
      };
      await insertSentProto(proto1, {
        messageIds: [getUuid()],
        recipients: {
          [getUuid()]: [1],
        },
      });
      await insertSentProto(proto2, {
        messageIds: [getUuid()],
        recipients: {
          [getUuid()]: [1, 2],
        },
      });
      await insertSentProto(proto3, {
        messageIds: [getUuid()],
        recipients: {
          [getUuid()]: [1, 2, 3],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 3);

      await deleteSentProtosOlderThan(timestamp);

      const allProtos = await getAllSentProtos();
      assert.lengthOf(allProtos, 2);

      const actual1 = allProtos[0];
      assert.strictEqual(actual1.contentHint, proto1.contentHint);
      assert.isTrue(constantTimeEqual(actual1.proto, proto1.proto));
      assert.strictEqual(actual1.timestamp, proto1.timestamp);

      const actual2 = allProtos[1];
      assert.strictEqual(actual2.contentHint, proto2.contentHint);
      assert.isTrue(constantTimeEqual(actual2.proto, proto2.proto));
      assert.strictEqual(actual2.timestamp, proto2.timestamp);
    });
  });

  describe('#deleteSentProtoByMessageId', () => {
    it('deletes all records related to that messageId', async () => {
      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);

      const messageId = getUuid();
      const timestamp = Date.now();
      const proto1 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      const proto2 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp: timestamp - 10,
        urgent: true,
      };
      const proto3 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp: timestamp - 20,
        urgent: true,
      };
      await insertSentProto(proto1, {
        messageIds: [messageId, getUuid()],
        recipients: {
          [getUuid()]: [1, 2],
          [getUuid()]: [1],
        },
      });
      await insertSentProto(proto2, {
        messageIds: [messageId],
        recipients: {
          [getUuid()]: [1],
        },
      });
      await insertSentProto(proto3, {
        messageIds: [getUuid()],
        recipients: {
          [getUuid()]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 3);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 4);
      assert.lengthOf(await _getAllSentProtoRecipients(), 5);

      await deleteSentProtoByMessageId(messageId);

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);
    });
  });

  describe('#deleteSentProtoRecipient', () => {
    it('does not delete payload if recipient remains', async () => {
      const timestamp = Date.now();

      const recipientUuid1 = getUuid();
      const recipientUuid2 = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [getUuid()],
        recipients: {
          [recipientUuid1]: [1, 2],
          [recipientUuid2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      await deleteSentProtoRecipient({
        timestamp,
        recipientUuid: recipientUuid1,
        deviceId: 1,
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
    });

    it('deletes payload if no recipients remain', async () => {
      const timestamp = Date.now();

      const recipientUuid1 = getUuid();
      const recipientUuid2 = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [getUuid()],
        recipients: {
          [recipientUuid1]: [1, 2],
          [recipientUuid2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      await deleteSentProtoRecipient({
        timestamp,
        recipientUuid: recipientUuid1,
        deviceId: 1,
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      await deleteSentProtoRecipient({
        timestamp,
        recipientUuid: recipientUuid1,
        deviceId: 2,
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      await deleteSentProtoRecipient({
        timestamp,
        recipientUuid: recipientUuid2,
        deviceId: 1,
      });

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });

    it('deletes multiple recipients in a single transaction', async () => {
      const timestamp = Date.now();

      const recipientUuid1 = getUuid();
      const recipientUuid2 = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [getUuid()],
        recipients: {
          [recipientUuid1]: [1, 2],
          [recipientUuid2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      await deleteSentProtoRecipient([
        {
          timestamp,
          recipientUuid: recipientUuid1,
          deviceId: 1,
        },
        {
          timestamp,
          recipientUuid: recipientUuid1,
          deviceId: 2,
        },
        {
          timestamp,
          recipientUuid: recipientUuid2,
          deviceId: 1,
        },
      ]);

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });
  });

  describe('#getSentProtoByRecipient', () => {
    it('returns matching payload', async () => {
      const timestamp = Date.now();

      const recipientUuid = getUuid();
      const messageIds = [getUuid(), getUuid()];
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds,
        recipients: {
          [recipientUuid]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientUuid,
      });

      if (!actual) {
        throw new Error('Failed to fetch proto!');
      }
      assert.strictEqual(actual.contentHint, proto.contentHint);
      assert.isTrue(constantTimeEqual(actual.proto, proto.proto));
      assert.strictEqual(actual.timestamp, proto.timestamp);
      assert.sameMembers(actual.messageIds, messageIds);
    });

    it('returns matching payload with no messageIds', async () => {
      const timestamp = Date.now();

      const recipientUuid = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [],
        recipients: {
          [recipientUuid]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientUuid,
      });

      if (!actual) {
        throw new Error('Failed to fetch proto!');
      }
      assert.strictEqual(actual.contentHint, proto.contentHint);
      assert.isTrue(constantTimeEqual(actual.proto, proto.proto));
      assert.strictEqual(actual.timestamp, proto.timestamp);
      assert.deepEqual(actual.messageIds, []);
    });

    it('returns nothing if payload does not have recipient', async () => {
      const timestamp = Date.now();

      const recipientUuid = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [getUuid()],
        recipients: {
          [recipientUuid]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientUuid: getUuid(),
      });

      assert.isUndefined(actual);
    });

    it('returns nothing if timestamp does not match', async () => {
      const timestamp = Date.now();

      const recipientUuid = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [getUuid()],
        recipients: {
          [recipientUuid]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp: timestamp + 1,
        recipientUuid,
      });

      assert.isUndefined(actual);
    });

    it('returns nothing if timestamp proto is too old', async () => {
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      const timestamp = Date.now();

      const recipientUuid = getUuid();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
      };
      await insertSentProto(proto, {
        messageIds: [getUuid()],
        recipients: {
          [recipientUuid]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp + TWO_DAYS,
        timestamp,
        recipientUuid,
      });

      assert.isUndefined(actual);

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });
  });
});
