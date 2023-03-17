// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { MessageAttributesType } from '../../model-types.d';
import { CallMode } from '../../types/Calling';

const {
  removeAll,
  _getAllMessages,
  saveMessages,
  getCallHistoryMessageByCallId,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/getCallHistoryMessageByCallId', () => {
  beforeEach(async () => {
    await removeAll();
  });

  it('returns a previous call history message', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = getUuid();
    const ourUuid = getUuid();

    const callHistoryMessage: MessageAttributesType = {
      id: getUuid(),
      type: 'call-history',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
      callHistoryDetails: {
        callId: '12345',
        callMode: CallMode.Direct,
        wasIncoming: true,
        wasVideoCall: true,
        wasDeclined: true,
        acceptedTime: now - 10,
        endedTime: undefined,
      },
    };

    await saveMessages([callHistoryMessage], {
      forceSave: true,
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 1);

    const messageId = await getCallHistoryMessageByCallId(
      conversationId,
      '12345'
    );
    assert.strictEqual(messageId, callHistoryMessage.id);
  });
});
