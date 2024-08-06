// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';

import { SendStatus } from '../../messages/MessageSendState';
import type { ConversationModel } from '../../models/conversations';
import { GiftBadgeStates } from '../../components/conversation/Message';

import { DataWriter } from '../../sql/Client';
import { getRandomBytes } from '../../Crypto';
import * as Bytes from '../../Bytes';
import { generateAci } from '../../types/ServiceId';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { loadCallsHistory } from '../../services/callHistoryLoader';
import { ID_V1_LENGTH } from '../../groups';
import { DurationInSeconds, WEEK } from '../../util/durations';
import {
  setupBasics,
  asymmetricRoundtripHarness,
  symmetricRoundtripHarness,
  OUR_ACI,
} from './helpers';

const CONTACT_A = generateAci();
const GV1_ID = Bytes.toBinary(getRandomBytes(ID_V1_LENGTH));

const BADGE_RECEIPT =
  'AEpyZxbRBT+T5PQw9Wcx1QE2aFvL7LoLir9V4UF09Kk9qiP4SpIlHdlWHrAICy6F' +
  '6WdbdCj45fY6cadDKbBmkw+abohRTJnItrFhyKurnA5X+mZHZv4OvS+aZFmAYS6J' +
  'W+hpkbI+Fk7Gu3mEix7Pgz1I2EwGFlUBpm7/nuD5A0cKLrUJAMM142fnOEervePV' +
  'bf0c6Sw5X5aCsBw9J+dxFUGAAAAAAAAAAMH58UUeUj2oH1jfqc0Hb2RUtdA3ee8X' +
  '0Pp83WT8njwFw5rNGSHeKqOvBZzfAhMGJoiz7l1XfIfsPIreaFb/tA9aq2bOAdDl' +
  '5OYlxxl6DnjQ3+g3k9ycpl0elkaQnPW2Ai7yjeJ/96K1qssR2a/2b7xi10dmTRGg' +
  'gebhZnroYYgIgK22ZgAAAABkAAAAAAAAAD9j4f77Xo2Ox5tVyrV2DUo=';

describe('backup/bubble messages', () => {
  let contactA: ConversationModel;
  let gv1: ConversationModel;

  beforeEach(async () => {
    await DataWriter._removeAllMessages();
    await DataWriter._removeAllConversations();
    window.storage.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A' }
    );

    gv1 = await window.ConversationController.getOrCreateAndWait(
      GV1_ID,
      'group',
      {
        groupVersion: 1,
      }
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
        unidentifiedDeliveryReceived: true,
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
        unidentifiedDeliveries: [CONTACT_A],
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

  it('roundtrips unopened gift badge', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        sourceServiceId: CONTACT_A,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        timestamp: 3,
        giftBadge: {
          id: undefined,
          level: 100,
          expiration: 1723248000000,
          receiptCredentialPresentation: BADGE_RECEIPT,
          state: GiftBadgeStates.Opened,
        },
      },
    ]);
  });

  it('roundtrips opened gift badge', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        sourceServiceId: CONTACT_A,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        timestamp: 3,
        giftBadge: {
          id: undefined,
          level: 100,
          expiration: 1723248000000,
          receiptCredentialPresentation: BADGE_RECEIPT,
          state: GiftBadgeStates.Opened,
        },
      },
    ]);
  });

  it('roundtrips gift badge quote', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        sourceServiceId: CONTACT_A,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        timestamp: 3,
        giftBadge: {
          id: undefined,
          level: 100,
          expiration: 1723248000000,
          receiptCredentialPresentation: BADGE_RECEIPT,
          state: GiftBadgeStates.Opened,
        },
      },
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 4,
        received_at_ms: 4,
        sent_at: 4,
        sourceServiceId: CONTACT_A,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        timestamp: 4,
        quote: {
          authorAci: CONTACT_A,
          attachments: [],
          id: 3,
          isViewOnce: false,
          isGiftBadge: true,
          messageId: '',
          referencedMessageNotFound: false,
        },
      },
    ]);
  });

  it('roundtrips sealed/unsealed incoming message', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        sourceServiceId: CONTACT_A,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: false,
        timestamp: 3,
        body: 'unsealed',
      },
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 4,
        received_at_ms: 4,
        sent_at: 4,
        sourceServiceId: CONTACT_A,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        timestamp: 4,
        body: 'sealed',
      },
    ]);
  });

  it('roundtrips sealed/unsealed outgoing message', async () => {
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
        unidentifiedDeliveries: undefined,
        timestamp: 3,
        body: 'unsealed',
      },
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'outgoing',
        received_at: 4,
        received_at_ms: 4,
        sent_at: 4,
        sourceServiceId: OUR_ACI,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Delivered,
          },
        },
        unidentifiedDeliveries: [CONTACT_A],
        timestamp: 4,
        body: 'sealed',
      },
    ]);
  });

  it('roundtrips messages with send errors', async () => {
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
        errors: [
          {
            serviceId: CONTACT_A,
            name: 'OutgoingIdentityKeyError',
            message: `The identity of ${CONTACT_A} has changed.`,
          },
        ],
        timestamp: 3,
        body: 'body',
      },
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'outgoing',
        received_at: 4,
        received_at_ms: 4,
        sent_at: 4,
        sourceServiceId: OUR_ACI,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Delivered,
          },
        },
        errors: [
          {
            serviceId: CONTACT_A,
            name: 'OutgoingMessageError',
            message: 'no http error',
          },
        ],
        timestamp: 4,
        body: 'body',
      },
    ]);
  });

  it('roundtrips sms messages', async () => {
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
        unidentifiedDeliveryReceived: true,
        sms: true,
      },
    ]);
  });

  it('drops gv1 messages', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: gv1.id,
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
          unidentifiedDeliveryReceived: true,
        },
      ],
      []
    );
  });

  it('drops messages that expire soon', async () => {
    await asymmetricRoundtripHarness(
      [
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
          unidentifiedDeliveryReceived: true,
          expirationStartTimestamp: Date.now(),
          expireTimer: DurationInSeconds.fromSeconds(1),
        },
      ],
      []
    );
  });

  it('does not drop messages that expire far in the future', async () => {
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
        unidentifiedDeliveryReceived: true,
        expirationStartTimestamp: Date.now(),
        expireTimer: DurationInSeconds.fromMillis(WEEK),
      },
    ]);
  });
});
