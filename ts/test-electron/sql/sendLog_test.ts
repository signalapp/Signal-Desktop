// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as getGuid } from 'uuid';

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import {
  constantTimeEqual,
  getRandomBytes,
  typedArrayToArrayBuffer,
} from '../../Crypto';

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

describe('sendLog', () => {
  beforeEach(async () => {
    await removeAllSentProtos();
  });

  it('roundtrips with insertSentProto/getAllSentProtos', async () => {
    const bytes = Buffer.from(getRandomBytes(128));
    const timestamp = Date.now();
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
    };
    await insertSentProto(proto, {
      messageIds: [getGuid()],
      recipients: {
        [getGuid()]: [1, 2],
      },
    });
    const allProtos = await getAllSentProtos();

    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.contentHint, proto.contentHint);
    assert.isTrue(
      constantTimeEqual(
        typedArrayToArrayBuffer(actual.proto),
        typedArrayToArrayBuffer(proto.proto)
      )
    );
    assert.strictEqual(actual.timestamp, proto.timestamp);

    await removeAllSentProtos();

    assert.lengthOf(await getAllSentProtos(), 0);
  });

  it('cascades deletes into both tables with foreign keys', async () => {
    assert.lengthOf(await getAllSentProtos(), 0);
    assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
    assert.lengthOf(await _getAllSentProtoRecipients(), 0);

    const bytes = Buffer.from(getRandomBytes(128));
    const timestamp = Date.now();
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
    };
    await insertSentProto(proto, {
      messageIds: [getGuid(), getGuid()],
      recipients: {
        [getGuid()]: [1, 2],
        [getGuid()]: [1],
      },
    });

    assert.lengthOf(await getAllSentProtos(), 1);
    assert.lengthOf(await _getAllSentProtoMessageIds(), 2);
    assert.lengthOf(await _getAllSentProtoRecipients(), 3);

    await removeAllSentProtos();

    assert.lengthOf(await getAllSentProtos(), 0);
    assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
    assert.lengthOf(await _getAllSentProtoRecipients(), 0);
  });

  it('trigger deletes payload when referenced message is deleted', async () => {
    const id = getGuid();
    const timestamp = Date.now();

    await saveMessage(
      {
        id,

        body: 'some text',
        conversationId: getGuid(),
        received_at: timestamp,
        sent_at: timestamp,
        timestamp,
        type: 'outgoing',
      },
      { forceSave: true }
    );

    const bytes = Buffer.from(getRandomBytes(128));
    const proto = {
      contentHint: 1,
      proto: bytes,
      timestamp,
    };
    await insertSentProto(proto, {
      messageIds: [id],
      recipients: {
        [getGuid()]: [1, 2],
      },
    });
    const allProtos = await getAllSentProtos();

    assert.lengthOf(allProtos, 1);
    const actual = allProtos[0];

    assert.strictEqual(actual.timestamp, proto.timestamp);

    await removeMessage(id, { Message: window.Whisper.Message });

    assert.lengthOf(await getAllSentProtos(), 0);
  });

  describe('#insertSentProto', () => {
    it('supports adding duplicates', async () => {
      const timestamp = Date.now();

      const messageIds = [getGuid()];
      const recipients = {
        [getGuid()]: [1],
      };
      const proto1 = {
        contentHint: 7,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      const proto2 = {
        contentHint: 9,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
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

      const messageIds = [getGuid()];
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };

      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);

      const id = await insertSentProto(proto, {
        messageIds,
        recipients: {
          [getGuid()]: [1],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 1);

      const recipientUuid = getGuid();
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
        proto: Buffer.from(getRandomBytes(128)),
        timestamp: timestamp + 10,
      };
      const proto2 = {
        contentHint: 2,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      const proto3 = {
        contentHint: 0,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp: timestamp - 15,
      };
      await insertSentProto(proto1, {
        messageIds: [getGuid()],
        recipients: {
          [getGuid()]: [1],
        },
      });
      await insertSentProto(proto2, {
        messageIds: [getGuid()],
        recipients: {
          [getGuid()]: [1, 2],
        },
      });
      await insertSentProto(proto3, {
        messageIds: [getGuid()],
        recipients: {
          [getGuid()]: [1, 2, 3],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 3);

      await deleteSentProtosOlderThan(timestamp);

      const allProtos = await getAllSentProtos();
      assert.lengthOf(allProtos, 2);

      const actual1 = allProtos[0];
      assert.strictEqual(actual1.contentHint, proto1.contentHint);
      assert.isTrue(
        constantTimeEqual(
          typedArrayToArrayBuffer(actual1.proto),
          typedArrayToArrayBuffer(proto1.proto)
        )
      );
      assert.strictEqual(actual1.timestamp, proto1.timestamp);

      const actual2 = allProtos[1];
      assert.strictEqual(actual2.contentHint, proto2.contentHint);
      assert.isTrue(
        constantTimeEqual(
          typedArrayToArrayBuffer(actual2.proto),
          typedArrayToArrayBuffer(proto2.proto)
        )
      );
      assert.strictEqual(actual2.timestamp, proto2.timestamp);
    });
  });

  describe('#deleteSentProtoByMessageId', () => {
    it('deletes all records releated to that messageId', async () => {
      assert.lengthOf(await getAllSentProtos(), 0);
      assert.lengthOf(await _getAllSentProtoMessageIds(), 0);
      assert.lengthOf(await _getAllSentProtoRecipients(), 0);

      const messageId = getGuid();
      const timestamp = Date.now();
      const proto1 = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      const proto2 = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp: timestamp - 10,
      };
      const proto3 = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp: timestamp - 20,
      };
      await insertSentProto(proto1, {
        messageIds: [messageId, getGuid()],
        recipients: {
          [getGuid()]: [1, 2],
          [getGuid()]: [1],
        },
      });
      await insertSentProto(proto2, {
        messageIds: [messageId],
        recipients: {
          [getGuid()]: [1],
        },
      });
      await insertSentProto(proto3, {
        messageIds: [getGuid()],
        recipients: {
          [getGuid()]: [1],
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

      const recipientUuid1 = getGuid();
      const recipientUuid2 = getGuid();
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      await insertSentProto(proto, {
        messageIds: [getGuid()],
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

      const recipientUuid1 = getGuid();
      const recipientUuid2 = getGuid();
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      await insertSentProto(proto, {
        messageIds: [getGuid()],
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
  });

  describe('#getSentProtoByRecipient', () => {
    it('returns matching payload', async () => {
      const timestamp = Date.now();

      const recipientUuid = getGuid();
      const messageIds = [getGuid(), getGuid()];
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
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
      assert.isTrue(
        constantTimeEqual(
          typedArrayToArrayBuffer(actual.proto),
          typedArrayToArrayBuffer(proto.proto)
        )
      );
      assert.strictEqual(actual.timestamp, proto.timestamp);
      assert.sameMembers(actual.messageIds, messageIds);
    });

    it('returns matching payload with no messageIds', async () => {
      const timestamp = Date.now();

      const recipientUuid = getGuid();
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
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
      assert.isTrue(
        constantTimeEqual(
          typedArrayToArrayBuffer(actual.proto),
          typedArrayToArrayBuffer(proto.proto)
        )
      );
      assert.strictEqual(actual.timestamp, proto.timestamp);
      assert.deepEqual(actual.messageIds, []);
    });

    it('returns nothing if payload does not have recipient', async () => {
      const timestamp = Date.now();

      const recipientUuid = getGuid();
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      await insertSentProto(proto, {
        messageIds: [getGuid()],
        recipients: {
          [recipientUuid]: [1, 2],
        },
      });

      assert.lengthOf(await getAllSentProtos(), 1);
      assert.lengthOf(await _getAllSentProtoRecipients(), 2);

      const actual = await getSentProtoByRecipient({
        now: timestamp,
        timestamp,
        recipientUuid: getGuid(),
      });

      assert.isUndefined(actual);
    });

    it('returns nothing if timestamp does not match', async () => {
      const timestamp = Date.now();

      const recipientUuid = getGuid();
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      await insertSentProto(proto, {
        messageIds: [getGuid()],
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

      const recipientUuid = getGuid();
      const proto = {
        contentHint: 1,
        proto: Buffer.from(getRandomBytes(128)),
        timestamp,
      };
      await insertSentProto(proto, {
        messageIds: [getGuid()],
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
