// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';

import { SendStatus } from '../../messages/MessageSendState';
import type { ConversationModel } from '../../models/conversations';

import Data from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { loadCallsHistory } from '../../services/callHistoryLoader';
import { setupBasics, symmetricRoundtripHarness, OUR_ACI } from './helpers';

const CONTACT_A = generateAci();

describe('backup/bubble messages', () => {
  let contactA: ConversationModel;

  beforeEach(async () => {
    await Data._removeAllMessages();
    await Data._removeAllConversations();
    window.storage.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A' }
    );

    await loadCallsHistory();
  });

  it('roundtrips incoming edited message', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        sourceServiceId: CONTACT_A,
        body: 'd',
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        editMessageTimestamp: 5,
        editMessageReceivedAtMs: 5,
        editHistory: [
          {
            body: 'd',
            timestamp: 5,
            received_at: 5,
            received_at_ms: 5,
          },
          {
            body: 'c',
            timestamp: 4,
            received_at: 4,
            received_at_ms: 4,
          },
          {
            body: 'b',
            timestamp: 3,
            received_at: 3,
            received_at_ms: 3,
          },
        ],
      },
    ]);
  });

  it('roundtrips outgoing edited message', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'outgoing',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        sourceServiceId: OUR_ACI,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Delivered,
          },
        },
        timestamp: 3,
        editMessageTimestamp: 5,
        editMessageReceivedAtMs: 5,
        body: 'd',
        editHistory: [
          {
            body: 'd',
            timestamp: 5,
            received_at: 5,
            received_at_ms: 5,
            sendStateByConversationId: {
              [contactA.id]: {
                status: SendStatus.Delivered,
              },
            },
          },
          {
            body: 'c',
            timestamp: 4,
            received_at: 4,
            received_at_ms: 4,
            sendStateByConversationId: {
              [contactA.id]: {
                status: SendStatus.Viewed,
              },
            },
          },
          {
            body: 'b',
            timestamp: 3,
            received_at: 3,
            received_at_ms: 3,
            sendStateByConversationId: {
              [contactA.id]: {
                status: SendStatus.Viewed,
              },
            },
          },
        ],
      },
    ]);
  });
});
