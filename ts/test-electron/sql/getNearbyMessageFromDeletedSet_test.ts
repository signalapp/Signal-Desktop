// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { MessageAttributesType } from '../../model-types';

const {
  saveMessages,
  _getAllMessages,
  _removeAllMessages,
  getNearbyMessageFromDeletedSet,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/getNearbyMessageFromDeletedSet', () => {
  beforeEach(async () => {
    await _removeAllMessages();
  });

  it('finds the closest message before, after, or between a set of messages', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = getUuid();
    const ourUuid = getUuid();

    function getMessage(body: string, offset: number): MessageAttributesType {
      return {
        id: body,
        body,
        type: 'outgoing',
        conversationId,
        sent_at: now + offset,
        received_at: now + offset,
        timestamp: now + offset,
      };
    }

    const message1 = getMessage('message 1', -50);
    const message2 = getMessage('message 2', -40);
    const message3 = getMessage('message 3', -30);
    const message4 = getMessage('message 4', -20);
    const message5 = getMessage('message 5', -10);

    await saveMessages([message1, message2, message3, message4, message5], {
      forceSave: true,
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 5);

    const testCases = [
      {
        name: '1 -> 2',
        lastSelectedMessage: message1,
        deletedMessageIds: [message1.id],
        expectedId: message2.id,
      },
      {
        name: '5 -> 4',
        lastSelectedMessage: message5,
        deletedMessageIds: [message5.id],
        expectedId: message4.id,
      },
      {
        name: '1,2 -> 3',
        lastSelectedMessage: message2,
        deletedMessageIds: [message1.id, message2.id],
        expectedId: message3.id,
      },
      {
        name: '4,5 -> 3',
        lastSelectedMessage: message5,
        deletedMessageIds: [message4.id, message5.id],
        expectedId: message3.id,
      },
      {
        name: '3,1 -> 2',
        lastSelectedMessage: message1,
        deletedMessageIds: [message3.id, message1.id],
        expectedId: message2.id,
      },
      {
        name: '4,2 -> 3',
        lastSelectedMessage: message2,
        deletedMessageIds: [message4.id, message2.id],
        expectedId: message3.id,
      },
      {
        name: '1,2,4,5 -> 3',
        lastSelectedMessage: message5,
        deletedMessageIds: [message1.id, message2.id, message4.id, message5.id],
        expectedId: message3.id,
      },
      {
        name: '1,2,3,4,5 -> null',
        lastSelectedMessage: message5,
        deletedMessageIds: [
          message1.id,
          message2.id,
          message3.id,
          message4.id,
          message5.id,
        ],
        expectedId: null,
      },
    ];

    for (const testCase of testCases) {
      const { name, lastSelectedMessage, deletedMessageIds, expectedId } =
        testCase;
      // eslint-disable-next-line no-await-in-loop
      const id = await getNearbyMessageFromDeletedSet({
        conversationId,
        lastSelectedMessage,
        deletedMessageIds,
        storyId: undefined,
        includeStoryReplies: false,
      });
      assert.strictEqual(id, expectedId, name);
    }
  });
});
