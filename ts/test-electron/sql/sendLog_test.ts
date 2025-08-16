// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { constantTimeEqual, getRandomBytes } from '../../Crypto';
import { cleanupMessages, postSaveUpdates } from '../../util/cleanup';

const {
  _getAllSentProtoMessageIds,
  _getAllSentProtoRecipients,
  getAllSentProtos,
} = DataReader;
const {
  deleteSentProtoByMessageId,
  deleteSentProtoRecipient,
  deleteSentProtosOlderThan,
  getSentProtoByRecipient,
  insertProtoRecipients,
  insertSentProto,
  removeAllSentProtos,
  removeMessage,
  saveMessage,
} = DataWriter;

describe('sql/sendLog', () => {
  beforeEach(async () => {
    await removeAllSentProtos();
    await window.ConversationController.load();
  });

  it('roundtrips with insertSentProto/getAllSentProtos', async () => {
    const bytes = getRandomBytes(128);
    const timestamp = Date.now();
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
      urgent: false,
      hasPniSignatureMessage: false,
    };
    await insertSentProto(proto, {
      messageIds: [generateUuid()],
      recipients: {
        [generateAci()]: [1, 2],
      },
    });
    const allProtos = await getAllSentProtos();

    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.contentHint, proto.contentHint);
    assert.isTrue(constantTimeEqual(actual.proto, proto.proto));
    assert.strictEqual(actual.timestamp, proto.timestamp);
    assert.strictEqual(actual.urgent, proto.urgent);
    assert.strictEqual(
      actual.hasPniSignatureMessage,
      proto.hasPniSignatureMessage
    );

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
      hasPniSignatureMessage: true,
    };
    await insertSentProto(proto, {
      messageIds: [generateUuid(), generateUuid()],
      recipients: {
        [generateAci()]: [1, 2],
        [generateAci()]: [1],
      },
    });

    const allProtos = await getAllSentProtos();
    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.contentHint, proto.contentHint);
    assert.isTrue(constantTimeEqual(actual.proto, proto.proto));
    assert.strictEqual(actual.timestamp, proto.timestamp);
    assert.strictEqual(actual.urgent, proto.urgent);
    assert.strictEqual(
      actual.hasPniSignatureMessage,
      proto.hasPniSignatureMessage
    );

    assert.lengthOf(await _getAllSentProtoMessageIds(), 2);
    assert.lengthOf(await _getAllSentProtoRecipients(), 3);

    await removeAllSentProtos();

    assert.lengthOf(await getAllSentProtos(), 0);
    assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
    assert.lengthOf(await _getAllSentProtoRecipients(), 0);
  });

  it('trigger deletes payload when referenced message is deleted', async () => {
    const id = generateUuid();
    const timestamp = Date.now();
    const ourAci = generateAci();

    await saveMessage(
      {
        id,

        body: 'some text',
        conversationId: generateUuid(),
        received_at: timestamp,
        sent_at: timestamp,
        timestamp,
        type: 'outgoing',
      },
      { forceSave: true, ourAci, postSaveUpdates }
    );

    const bytes = getRandomBytes(128);
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
      urgent: false,
      hasPniSignatureMessage: false,
    };
    await insertSentProto(proto, {
      messageIds: [id],
      recipients: {
        [generateAci()]: [1, 2],
      },
    });
    const allProtos = await getAllSentProtos();

    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.timestamp, proto.timestamp);

    await removeMessage(id, { cleanupMessages });

    assert.lengthOf(await getAllSentProtos(), 0);
  });

  describe('#insertSentProto', () => {
    it('supports adding duplicates', async () => {
      const timestamp = Date.now();

      const messageIds = [generateUuid()];
      const recipients = {
        [generateAci()]: [1],
      };
      const proto1 = {
        contentHint: 7,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      const proto2 = {
        contentHint: 9,
        proto: getRandomBytes(128),
        timestamp,
        urgent: false,
        hasPniSignatureMessage: true,
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

      const messageIds = [generateUuid()];
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);

      const id = await insertSentProto(proto, {
        messageIds,
        recipients: {
          [generateAci()]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      const recipientServiceId = generateAci();
      await insertProtoRecipients({
        id,
        recipientServiceId,
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
        hasPniSignatureMessage: false,
      };
      const proto2 = {
        contentHint: 2,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      const proto3 = {
        contentHint: 0,
        proto: getRandomBytes(128),
        timestamp: timestamp - 15,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto1, {
        messageIds: [generateUuid()],
        recipients: {
          [generateAci()]: [1],
        },
      });
      await insertSentProto(proto2, {
        messageIds: [generateUuid()],
        recipients: {
          [generateAci()]: [1, 2],
        },
      });
      await insertSentProto(proto3, {
        messageIds: [generateUuid()],
        recipients: {
          [generateAci()]: [1, 2, 3],
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

      const messageId = generateUuid();
      const timestamp = Date.now();
      const proto1 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      const proto2 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp: timestamp - 10,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      const proto3 = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp: timestamp - 20,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto1, {
        messageIds: [messageId, generateUuid()],
        recipients: {
          [generateAci()]: [1, 2],
          [generateAci()]: [1],
        },
      });
      await insertSentProto(proto2, {
        messageIds: [messageId],
        recipients: {
          [generateAci()]: [1],
        },
      });
      await insertSentProto(proto3, {
        messageIds: [generateUuid()],
        recipients: {
          [generateAci()]: [1],
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

      const recipientServiceId1 = generateAci();
      const recipientServiceId2 = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId1]: [1, 2],
          [recipientServiceId2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
        timestamp,
        recipientServiceId: recipientServiceId1,
        deviceId: 1,
      });
      assert.lengthOf(successfulPhoneNumberShares, 0);

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
    });

    it('deletes payload if no recipients remain', async () => {
      const timestamp = Date.now();

      const recipientServiceId1 = generateAci();
      const recipientServiceId2 = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId1]: [1, 2],
          [recipientServiceId2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      {
        const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
          timestamp,
          recipientServiceId: recipientServiceId1,
          deviceId: 1,
        });
        assert.lengthOf(successfulPhoneNumberShares, 0);
      }

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      {
        const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
          timestamp,
          recipientServiceId: recipientServiceId1,
          deviceId: 2,
        });
        assert.lengthOf(successfulPhoneNumberShares, 0);
      }

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      {
        const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
          timestamp,
          recipientServiceId: recipientServiceId2,
          deviceId: 1,
        });
        assert.lengthOf(successfulPhoneNumberShares, 0);
      }

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });

    it('returns deleted recipients when pni signature was sent', async () => {
      const timestamp = Date.now();

      const recipientServiceId1 = generateAci();
      const recipientServiceId2 = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: true,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId1]: [1, 2],
          [recipientServiceId2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      {
        const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
          timestamp,
          recipientServiceId: recipientServiceId1,
          deviceId: 1,
        });
        assert.lengthOf(successfulPhoneNumberShares, 0);
      }

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      {
        const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
          timestamp,
          recipientServiceId: recipientServiceId1,
          deviceId: 2,
        });
        assert.deepStrictEqual(successfulPhoneNumberShares, [
          recipientServiceId1,
        ]);
      }

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      {
        const { successfulPhoneNumberShares } = await deleteSentProtoRecipient({
          timestamp,
          recipientServiceId: recipientServiceId2,
          deviceId: 1,
        });
        assert.deepStrictEqual(successfulPhoneNumberShares, [
          recipientServiceId2,
        ]);
      }

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });

    it('deletes multiple recipients in a single transaction', async () => {
      const timestamp = Date.now();

      const recipientServiceId1 = generateAci();
      const recipientServiceId2 = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId1]: [1, 2],
          [recipientServiceId2]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 3);

      const { successfulPhoneNumberShares } = await deleteSentProtoRecipient([
        {
          timestamp,
          recipientServiceId: recipientServiceId1,
          deviceId: 1,
        },
        {
          timestamp,
          recipientServiceId: recipientServiceId1,
          deviceId: 2,
        },
        {
          timestamp,
          recipientServiceId: recipientServiceId2,
          deviceId: 1,
        },
      ]);
      assert.lengthOf(successfulPhoneNumberShares, 0);

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });
  });

  describe('#getSentProtoByRecipient', () => {
    it('returns matching payload', async () => {
      const timestamp = Date.now();

      const recipientServiceId = generateAci();
      const messageIds = [generateUuid(), generateUuid()];
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds,
        recipients: {
          [recipientServiceId]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientServiceId,
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

      const recipientServiceId = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [],
        recipients: {
          [recipientServiceId]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientServiceId,
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

      const recipientServiceId = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientServiceId: generateAci(),
      });

      assert.isUndefined(actual);
    });

    it('returns nothing if timestamp does not match', async () => {
      const timestamp = Date.now();

      const recipientServiceId = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp: timestamp + 1,
        recipientServiceId,
      });

      assert.isUndefined(actual);
    });

    it('returns nothing if timestamp proto is too old', async () => {
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      const timestamp = Date.now();

      const recipientServiceId = generateAci();
      const proto = {
        contentHint: 1,
        proto: getRandomBytes(128),
        timestamp,
        urgent: true,
        hasPniSignatureMessage: false,
      };
      await insertSentProto(proto, {
        messageIds: [generateUuid()],
        recipients: {
          [recipientServiceId]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp + TWO_DAYS,
        timestamp,
        recipientServiceId,
      });

      assert.isUndefined(actual);

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);
    });
  });
});
