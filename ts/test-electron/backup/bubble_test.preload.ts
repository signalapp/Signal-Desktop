// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';

import { SendStatus } from '../../messages/MessageSendState.std.ts';
import type { ConversationModel } from '../../models/conversations.preload.ts';
import { GiftBadgeStates } from '../../types/GiftBadgeStates.std.ts';

import { DataWriter } from '../../sql/Client.preload.ts';
import { getRandomBytes } from '../../Crypto.node.ts';
import * as Bytes from '../../Bytes.std.ts';
import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../../MessageSeenStatus.std.ts';
import { ID_V1_LENGTH } from '../../types/groups.std.ts';
import { DurationInSeconds, WEEK } from '../../util/durations/index.std.ts';
import {
  setupBasics,
  asymmetricRoundtripHarness,
  symmetricRoundtripHarness,
  OUR_ACI,
} from './helpers.preload.ts';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders.preload.ts';
import { strictAssert } from '../../util/assert.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { IMAGE_PNG, TEXT_ATTACHMENT } from '../../types/MIME.std.ts';
import { MY_STORY_ID } from '../../types/Stories.std.ts';
import { generateAttachmentKeys } from '../../AttachmentCrypto.node.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { BodyRange } from '../../types/BodyRange.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';

const CONTACT_A = generateAci();
const CONTACT_B = generateAci();
const CONTACT_B_E164 = '+12135550123';
const GV1_ID = Bytes.toBinary(getRandomBytes(ID_V1_LENGTH));
const GV2_ID = Bytes.toBase64(getRandomBytes(32));

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
  let contactB: ConversationModel;
  let gv1: ConversationModel;
  let gv2: ConversationModel;

  beforeEach(async () => {
    await DataWriter._removeAllMessages();
    await DataWriter._removeAllConversations();
    itemStorage.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A', active_at: 1 }
    );
    contactB = await window.ConversationController.getOrCreateAndWait(
      CONTACT_B,
      'private',
      { systemGivenName: 'CONTACT_B', e164: CONTACT_B_E164, active_at: 1 }
    );

    gv1 = await window.ConversationController.getOrCreateAndWait(
      GV1_ID,
      'group',
      {
        groupVersion: 1,
        active_at: 1,
      }
    );

    gv2 = await window.ConversationController.getOrCreateAndWait(
      GV2_ID,
      'group',
      {
        groupVersion: 2,
        masterKey: Bytes.toBase64(getRandomBytes(32)),
        name: 'Rock Enthusiasts',
        active_at: 1,
      }
    );

    await loadAllAndReinitializeRedux();
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
            readStatus: ReadStatus.Unread,
            unidentifiedDeliveryReceived: true,
          },
          {
            body: 'c',
            timestamp: 4,
            received_at: 4,
            received_at_ms: 4,
            readStatus: ReadStatus.Unread,
            unidentifiedDeliveryReceived: false,
          },
          {
            body: 'b',
            timestamp: 3,
            received_at: 3,
            received_at_ms: 3,
            readStatus: ReadStatus.Read,
            unidentifiedDeliveryReceived: false,
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
        readStatus: ReadStatus.Read,
        received_at: 3,
        received_at_ms: 43,
        seenStatus: SeenStatus.Seen,
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
        editMessageReceivedAtMs: 45,
        body: 'd',
        editHistory: [
          {
            body: 'd',
            timestamp: 5,
            received_at: 5,
            received_at_ms: 45,
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
            received_at_ms: 44,
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
            received_at_ms: 43,
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

  it('drops messages with neither text nor attachments', async () => {
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
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
        },
      ],
      []
    );
  });

  it('is resilient to ACIs not from known conversations', async () => {
    const unknownAci = generateAci();
    await symmetricRoundtripHarness([
      {
        conversationId: gv2.id,
        id: generateGuid(),
        body: 'body',
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        sourceServiceId: unknownAci,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
      },
    ]);
  });

  it('drops edited revisions with neither text nor attachments', async () => {
    const message: MessageAttributesType = {
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
          readStatus: ReadStatus.Unread,
          unidentifiedDeliveryReceived: true,
        },
        {
          timestamp: 4,
          received_at: 4,
          received_at_ms: 4,
          readStatus: ReadStatus.Unread,
          unidentifiedDeliveryReceived: false,
        },
        {
          body: 'b',
          timestamp: 3,
          received_at: 3,
          received_at_ms: 3,
          readStatus: ReadStatus.Read,
          unidentifiedDeliveryReceived: false,
        },
      ],
    };
    strictAssert(message.editHistory, 'edit history exists');
    const [currentRevision, , oldestRevision] = message.editHistory;
    strictAssert(currentRevision, 'current revision exists');
    strictAssert(oldestRevision, 'oldest revision exists');

    await asymmetricRoundtripHarness(
      [message],
      [
        {
          ...message,
          editHistory: [currentRevision, oldestRevision],
        },
      ]
    );
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

  it('fixes e164-only incoming 1:1 messages', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          // Note: contact B e164 vs contact A conversationId
          source: CONTACT_B_E164,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
          timestamp: 3,
          body: 'hello',
        },
      ],
      [
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
          body: 'hello',
        },
      ]
    );
  });

  it('fixes source-missing incoming 1:1 messages', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
          timestamp: 3,
          body: 'hello',
        },
      ],
      [
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
          body: 'hello',
        },
      ]
    );
  });

  it('drops source-missing incoming group messages', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: gv2.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
          timestamp: 3,
          body: 'hello',
        },
      ],
      []
    );
  });

  it('drops misattributed incoming 1:1 messages', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          sourceServiceId: CONTACT_B,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
          timestamp: 3,
          body: 'hello',
        },
      ],
      []
    );
  });

  it('updates incoming messages authored by self to outgoing', async () => {
    const ourConversation = window.ConversationController.get(OUR_ACI);
    strictAssert(ourConversation, 'our conversation exists');

    await asymmetricRoundtripHarness(
      [
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          sourceServiceId: OUR_ACI,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
          timestamp: 3,
          body: 'hello',
        },
      ],
      [
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'outgoing',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          sourceServiceId: OUR_ACI,
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Seen,
          timestamp: 3,
          body: 'hello',
          sendStateByConversationId: {
            [ourConversation.id]: { status: SendStatus.Read, updatedAt: 3 },
          },
        },
      ]
    );
  });

  it('filters out reactions from unknown authors', async () => {
    const message = {
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
      reactions: [
        {
          emoji: 'first',
          fromId: contactA.id,
          targetTimestamp: 3,
          timestamp: 3,
        },
        {
          emoji: 'second',
          fromId: generateGuid(),
          targetTimestamp: 3,
          timestamp: 3,
        },
        {
          emoji: 'third',
          fromId: contactB.id,
          targetTimestamp: 3,
          timestamp: 3,
        },
      ],
      body: 'hello',
    } as const;
    await asymmetricRoundtripHarness(
      [message],
      [{ ...message, reactions: [message.reactions[0], message.reactions[2]] }]
    );
  });

  describe('quotes', () => {
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
          body: '123',
          quote: {
            authorAci: CONTACT_A,
            attachments: [],
            id: 3,
            isViewOnce: false,
            isGiftBadge: true,
            referencedMessageNotFound: false,
          },
        },
      ]);
    });
    it('roundtrips quote with referenced message found', async () => {
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
          body: '123',
          quote: {
            authorAci: CONTACT_A,
            attachments: [],
            id: 42,
            isGiftBadge: false,
            text: 'quote text',
            isViewOnce: false,
            referencedMessageNotFound: false,
          },
        },
      ]);
    });
    it('roundtrips quote without referenced message found', async () => {
      const message = {
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
        body: '123',
        quote: {
          authorAci: CONTACT_A,
          attachments: [],
          id: 42,
          text: 'quote text',
          isViewOnce: false,
          isGiftBadge: false,
          referencedMessageNotFound: true,
        },
      } as const;

      await asymmetricRoundtripHarness(
        [message],
        [
          {
            ...message,
            quote: {
              ...message.quote,
              // id is removed during roundtrip
              id: null,
            },
          },
        ]
      );
    });

    it('roundtrips view-once-quotes', async () => {
      const message = {
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
        body: '123',
        quote: {
          authorAci: CONTACT_A,
          attachments: [],
          id: 42,
          text: 'quote text',
          isViewOnce: true,
          isGiftBadge: false,
          referencedMessageNotFound: true,
        },
      } as const;

      await asymmetricRoundtripHarness(
        [message],
        [
          {
            ...message,
            quote: {
              ...message.quote,
              // id is removed during roundtrip
              id: null,
            },
          },
        ]
      );
    });
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
        received_at_ms: 4,
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
        readStatus: ReadStatus.Read,
        received_at: 4,
        received_at_ms: 4,
        seenStatus: SeenStatus.Seen,
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
          [contactB.id]: {
            status: SendStatus.Failed,
          },
        },
        errors: [
          {
            serviceId: CONTACT_B,
            name: 'OutgoingIdentityKeyError',
            message: `The identity of ${CONTACT_B} has changed.`,
          },
        ],
        timestamp: 3,
        body: 'body',
      },
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'outgoing',
        readStatus: ReadStatus.Read,
        received_at: 4,
        received_at_ms: 4,
        seenStatus: SeenStatus.Seen,
        sent_at: 4,
        sourceServiceId: OUR_ACI,
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Failed,
          },
          [contactB.id]: {
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
  it('drops erased messages', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 3,
          received_at_ms: 3,
          isErased: true,
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
  it('drops invalid body ranges', async () => {
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
          bodyRanges: [
            {
              start: 0,
              length: 1,
              // @ts-expect-error invalid data
              style: undefined,
            },
            {
              start: 1,
              length: 0,
              style: BodyRange.Style.BOLD,
            },
          ],
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
        },
      ],
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
          bodyRanges: [
            {
              start: 1,
              length: 0,
              style: BodyRange.Style.BOLD,
            },
          ],
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
        },
      ]
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

  it('drops messages that have not started to expire but have an expireTimer of <= DAY', async () => {
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
          expireTimer: DurationInSeconds.fromDays(1),
        },
      ],
      []
    );
  });

  it('does not drop messages that have not started to expire but have an expireTimer of > DAY', async () => {
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
        expireTimer: DurationInSeconds.fromDays(1.01),
      },
    ]);
  });

  describe('link previews', async () => {
    it('roundtrips link preview', async () => {
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
          body: 'https://signal.org is a cool place',
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: true,
          preview: [
            {
              url: 'https://signal.org',
              title: 'Signal',
            },
          ],
        },
      ]);
    });
    it('drops preview if URL does not exist in body', async () => {
      const message: MessageAttributesType = {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        sourceServiceId: CONTACT_A,
        body: 'no urls here',
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
      };
      await asymmetricRoundtripHarness(
        [
          {
            ...message,
            preview: [
              {
                url: 'https://signal.org',
                title: 'Signal',
              },
            ],
          },
        ],
        [
          {
            ...message,
            preview: [],
          },
        ]
      );
    });
  });
  describe('lonely-in-group messages', async () => {
    const GROUP_ID = Bytes.toBase64(getRandomBytes(32));
    let group: ConversationModel | undefined;
    let ourConversation: ConversationModel | undefined;

    beforeEach(async () => {
      group = await window.ConversationController.getOrCreateAndWait(
        GROUP_ID,
        'group',
        {
          groupVersion: 2,
          masterKey: Bytes.toBase64(getRandomBytes(32)),
          name: 'Rock Enthusiasts',
          active_at: 1,
        }
      );
      ourConversation = window.ConversationController.get(OUR_ACI);
    });

    it('roundtrips messages that have our id in sendStateByConversationId', async () => {
      strictAssert(group, 'conversations exist');
      strictAssert(ourConversation, 'conversations exist');
      await symmetricRoundtripHarness([
        {
          conversationId: group.id,
          id: generateGuid(),
          type: 'outgoing',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          timestamp: 3,
          sourceServiceId: OUR_ACI,
          body: 'd',
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Seen,
          sendStateByConversationId: {
            [ourConversation.id]: { status: SendStatus.Read, updatedAt: 3 },
          },
          expirationStartTimestamp: Date.now(),
          expireTimer: DurationInSeconds.fromMillis(WEEK),
        },
      ]);
    });
    it(
      'if a message did not have sendStateByConversationId (e.g. to mimic post-import from primary), ' +
        'would add it with our conversationId when importing',
      async () => {
        strictAssert(group, 'conversations exist');
        strictAssert(ourConversation, 'conversations exist');
        const message: MessageAttributesType = {
          conversationId: group.id,
          id: generateGuid(),
          type: 'outgoing',
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          timestamp: 3,
          sourceServiceId: OUR_ACI,
          body: 'd',
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Seen,
          expirationStartTimestamp: Date.now(),
          expireTimer: DurationInSeconds.fromMillis(WEEK),
        };

        await asymmetricRoundtripHarness(
          [
            {
              ...message,
              sendStateByConversationId: {},
            },
          ],
          [
            {
              ...message,
              sendStateByConversationId: {
                [ourConversation.id]: { status: SendStatus.Read, updatedAt: 3 },
              },
            },
          ]
        );
      }
    );
    it('filters out our conversation id from sendStateByConversationId in non-note-to-self convos', async () => {
      strictAssert(group, 'conversations exist');
      strictAssert(ourConversation, 'conversations exist');
      const message: MessageAttributesType = {
        conversationId: group.id,
        id: generateGuid(),
        type: 'outgoing',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        sourceServiceId: OUR_ACI,
        body: 'd',
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        expirationStartTimestamp: Date.now(),
        expireTimer: DurationInSeconds.fromMillis(WEEK),
      };

      await asymmetricRoundtripHarness(
        [
          {
            ...message,
            sendStateByConversationId: {
              [ourConversation.id]: { status: SendStatus.Read, updatedAt: 3 },
              [contactA.id]: { status: SendStatus.Delivered, updatedAt: 4 },
            },
          },
        ],
        [
          {
            ...message,
            sendStateByConversationId: {
              [contactA.id]: { status: SendStatus.Delivered, updatedAt: 4 },
            },
          },
        ]
      );
    });
    it('does not filter out our conversation id from sendStateByConversationId in Note-to-Self', async () => {
      strictAssert(ourConversation, 'conversations exist');
      const message: MessageAttributesType = {
        conversationId: ourConversation.id,
        id: generateGuid(),
        type: 'outgoing',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        sourceServiceId: OUR_ACI,
        body: 'd',
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        expirationStartTimestamp: Date.now(),
        expireTimer: DurationInSeconds.fromMillis(WEEK),
      };
      ourConversation.set({ active_at: 3 });

      await symmetricRoundtripHarness([
        {
          ...message,
          sendStateByConversationId: {
            [ourConversation.id]: { status: SendStatus.Read, updatedAt: 3 },
          },
        },
      ]);
    });
  });
  describe('stories', () => {
    const GROUP_ID = Bytes.toBase64(getRandomBytes(32));
    let group: ConversationModel | undefined;
    let ourConversation: ConversationModel | undefined;

    beforeEach(async () => {
      group = await window.ConversationController.getOrCreateAndWait(
        GROUP_ID,
        'group',
        {
          groupVersion: 2,
          masterKey: Bytes.toBase64(getRandomBytes(32)),
          name: 'Rock Enthusiasts',
          active_at: 1,
        }
      );
      ourConversation = window.ConversationController.get(OUR_ACI);
    });
    it('does not export stories', async () => {
      strictAssert(ourConversation, 'conversations exist');
      strictAssert(group, 'conversations exist');
      const commonProps = {
        type: 'story',
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        sourceServiceId: OUR_ACI,
        attachments: [
          {
            contentType: TEXT_ATTACHMENT,
            size: 4,
            textAttachment: {
              color: 4285041620,
              text: 'test',
              textForegroundColor: 4294967295,
              textStyle: 1,
            },
          },
        ],
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        expirationStartTimestamp: Date.now(),
        expireTimer: DurationInSeconds.fromMillis(WEEK),
      } satisfies Partial<MessageAttributesType>;

      const directStory: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        conversationId: ourConversation.id,
        storyDistributionListId: MY_STORY_ID,
      };

      const groupStory: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        conversationId: group.id,
      };

      await asymmetricRoundtripHarness([directStory, groupStory], []);
    });
    it('roundtrips direct story emoji replies', async () => {
      strictAssert(ourConversation, 'conversations exist');
      const commonProps = {
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        conversationId: contactA.id,
      } satisfies Partial<MessageAttributesType>;

      const incomingReply: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        type: 'incoming',
        unidentifiedDeliveryReceived: true,
        sourceServiceId: CONTACT_A,
        storyReaction: {
          emoji: '🤷‍♂️',
          targetAuthorAci: OUR_ACI,
          targetTimestamp: 0, // targetTimestamp is not roundtripped
        },
        storyReplyContext: {
          authorAci: OUR_ACI,
          messageId: '',
        },
      };

      const outgoingReply: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        type: 'outgoing',
        sourceServiceId: OUR_ACI,
        storyReaction: {
          emoji: '🤷‍♂️',
          targetAuthorAci: CONTACT_A,
          targetTimestamp: 0, // targetTimestamp is not roundtripped
        },
        storyReplyContext: {
          authorAci: CONTACT_A,
          messageId: '',
        },
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Read,
            updatedAt: 3,
          },
        },
      };

      await symmetricRoundtripHarness([incomingReply, outgoingReply]);
    });
    it('roundtrips direct story text replies', async () => {
      strictAssert(ourConversation, 'conversations exist');
      const commonProps = {
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        conversationId: contactA.id,
        body: 'text reply to story',
      } satisfies Partial<MessageAttributesType>;

      const incomingReply: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        type: 'incoming',
        unidentifiedDeliveryReceived: true,
        sourceServiceId: CONTACT_A,
        storyReplyContext: {
          authorAci: OUR_ACI,
          messageId: '',
        },
      };

      const outgoingReply: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        type: 'outgoing',
        sourceServiceId: OUR_ACI,
        storyReplyContext: {
          authorAci: CONTACT_A,
          messageId: '',
        },
        sendStateByConversationId: {
          [contactA.id]: {
            status: SendStatus.Read,
            updatedAt: 3,
          },
        },
      };

      await symmetricRoundtripHarness([incomingReply, outgoingReply]);
    });

    it('drops direct story text replies with no body', async () => {
      strictAssert(ourConversation, 'conversation exists');

      await asymmetricRoundtripHarness(
        [
          {
            conversationId: contactA.id,
            id: generateGuid(),
            type: 'incoming',
            body: '',
            unidentifiedDeliveryReceived: true,
            sourceServiceId: CONTACT_A,
            received_at: 3,
            received_at_ms: 3,
            sent_at: 3,
            timestamp: 3,
            readStatus: ReadStatus.Read,
            seenStatus: SeenStatus.Seen,
            storyReplyContext: {
              authorAci: OUR_ACI,
              messageId: '',
            },
          },
        ],
        []
      );
    });

    it('does not export group story replies', async () => {
      strictAssert(ourConversation, 'conversations exist');
      strictAssert(group, 'conversations exist');
      const commonProps = {
        conversationId: group.id,
        received_at: 3,
        received_at_ms: 3,
        sent_at: 3,
        timestamp: 3,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        body: 'text reply to story',
      } satisfies Partial<MessageAttributesType>;

      const incomingReply: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        type: 'incoming',
        unidentifiedDeliveryReceived: true,
        sourceServiceId: CONTACT_A,
        storyReplyContext: {
          authorAci: OUR_ACI,
          messageId: '',
        },
      };

      const outgoingReply: MessageAttributesType = {
        ...commonProps,
        id: generateGuid(),
        type: 'outgoing',
        sourceServiceId: OUR_ACI,
        storyReplyContext: {
          authorAci: CONTACT_A,
          messageId: '',
        },
        sendStateByConversationId: {
          [CONTACT_A]: {
            status: SendStatus.Read,
            updatedAt: 3,
          },
        },
      };

      await asymmetricRoundtripHarness([incomingReply, outgoingReply], []);
    });
  });

  describe('view-once', () => {
    it('roundtrips incoming viewed view-once message', async () => {
      await symmetricRoundtripHarness([
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          isErased: true,
          isViewOnce: true,
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          sourceServiceId: CONTACT_A,
          readStatus: ReadStatus.Viewed,
          seenStatus: SeenStatus.Seen,
          unidentifiedDeliveryReceived: false,
          timestamp: 3,
        },
      ]);
    });
    it('roundtrips incoming unviewed view-once message', async () => {
      await symmetricRoundtripHarness([
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'incoming',
          isViewOnce: true,
          attachments: [
            {
              size: 128,
              contentType: IMAGE_PNG,
              cdnKey: 'cdnKey',
              cdnNumber: 2,
              uploadTimestamp: 2001,
              key: Bytes.toBase64(generateAttachmentKeys()),
              digest: Bytes.toBase64(getRandomBytes(32)),
              caption: 'shhhh',
            },
          ],
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          sourceServiceId: CONTACT_A,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          unidentifiedDeliveryReceived: false,
          timestamp: 3,
        },
      ]);
    });
    it('roundtrips outgoing view-once message', async () => {
      await symmetricRoundtripHarness([
        {
          conversationId: contactA.id,
          id: generateGuid(),
          type: 'outgoing',
          isViewOnce: true,
          isErased: true,
          received_at: 3,
          received_at_ms: 3,
          sent_at: 3,
          sourceServiceId: OUR_ACI,
          seenStatus: SeenStatus.Seen,
          sendStateByConversationId: {
            [contactA.id]: {
              status: SendStatus.Delivered,
            },
          },
          unidentifiedDeliveries: [CONTACT_A],
          timestamp: 3,
        },
      ]);
    });
  });

  describe('polls', () => {
    const GROUP_ID = Bytes.toBase64(getRandomBytes(32));
    let group: ConversationModel | undefined;

    let basePollMessage: MessageAttributesType;

    beforeEach(async () => {
      group = await window.ConversationController.getOrCreateAndWait(
        GROUP_ID,
        'group',
        {
          groupVersion: 2,
          masterKey: Bytes.toBase64(getRandomBytes(32)),
          name: 'Poll Test Group',
          active_at: 1,
        }
      );

      strictAssert(group, 'group must exist');

      basePollMessage = {
        conversationId: group.id,
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
        poll: {
          question: '',
          options: [],
          allowMultiple: false,
          votes: undefined,
          terminatedAt: undefined,
        },
      };
    });

    it('roundtrips poll with no votes', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          poll: {
            question: 'How do you feel about unit testing?',
            options: ['yay', 'ok', 'nay'],
            allowMultiple: false,
          },
        },
      ]);
    });

    it('roundtrips poll with single vote', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          poll: {
            question: 'How do you feel about unit testing?',
            options: ['yay', 'ok', 'nay'],
            allowMultiple: false,
            votes: [
              {
                fromConversationId: contactA.id,
                optionIndexes: [0], // Voted for "yay"
                voteCount: 1,
                timestamp: 3,
              },
            ],
          },
        },
      ]);
    });

    it('roundtrips poll with multiple voters', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          poll: {
            question: 'Pizza toppings?',
            options: ['pepperoni', 'mushrooms', 'pineapple'],
            allowMultiple: false,
            votes: [
              {
                fromConversationId: contactA.id,
                optionIndexes: [0], // contactA voted for pepperoni
                voteCount: 2, // Changed their vote twice
                timestamp: 3,
              },
              {
                fromConversationId: contactB.id,
                optionIndexes: [2], // contactB voted for pineapple
                voteCount: 1,
                timestamp: 3,
              },
            ],
          },
        },
      ]);
    });

    it('roundtrips poll with multiple selections', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          poll: {
            question: 'Which features do you want?',
            options: ['dark mode', 'better search', 'polls', 'voice notes'],
            allowMultiple: true,
            votes: [
              {
                fromConversationId: contactA.id,
                optionIndexes: [0, 2, 3], // Selected dark mode, polls, and voice notes
                voteCount: 1,
                timestamp: 3,
              },
            ],
          },
        },
      ]);
    });

    it('roundtrips ended poll', async () => {
      const pollData = {
        poll: {
          question: 'This poll is closed',
          options: ['option1', 'option2'],
          allowMultiple: false,
          votes: [
            {
              fromConversationId: contactA.id,
              optionIndexes: [0],
              voteCount: 1,
              timestamp: 3,
            },
          ],
        },
      };

      await asymmetricRoundtripHarness(
        [
          {
            ...basePollMessage,
            ...pollData,
            poll: {
              ...pollData.poll,
              terminatedAt: 5, // Original termination timestamp
            },
          },
        ],
        [
          {
            ...basePollMessage,
            ...pollData,
            poll: {
              ...pollData.poll,
              terminatedAt: 3, // After roundtrip, set to message timestamp
            },
          },
        ]
      );
    });

    it('roundtrips outgoing poll', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          type: 'outgoing',
          sourceServiceId: OUR_ACI,
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Seen,
          unidentifiedDeliveryReceived: false, // Outgoing messages default to false
          sendStateByConversationId: {
            [contactA.id]: {
              status: SendStatus.Delivered,
            },
          },
          poll: {
            question: 'Meeting time?',
            options: ['10am', '2pm', '4pm'],
            allowMultiple: false,
            votes: [
              {
                fromConversationId: contactA.id,
                optionIndexes: [1],
                voteCount: 1,
                timestamp: 3,
              },
            ],
          },
        },
      ]);
    });

    it('excludes pending votes from backup', async () => {
      strictAssert(group, 'group must exist');
      const ourConversation = window.ConversationController.get(OUR_ACI);
      strictAssert(ourConversation, 'our conversation must exist');

      await asymmetricRoundtripHarness(
        [
          {
            ...basePollMessage,
            poll: {
              question: 'Test question?',
              options: ['yes', 'no'],
              allowMultiple: false,
              votes: [
                {
                  fromConversationId: contactA.id,
                  optionIndexes: [0],
                  voteCount: 1,
                  timestamp: 3,
                  // No sendStateByConversationId - this vote is sent
                },
                {
                  fromConversationId: ourConversation.id,
                  optionIndexes: [1],
                  voteCount: 1,
                  timestamp: 3,
                  // This vote is still pending, should NOT be in backup
                  sendStateByConversationId: {
                    [contactA.id]: {
                      status: SendStatus.Pending,
                      updatedAt: 3,
                    },
                  },
                },
              ],
            },
          },
        ],
        [
          {
            ...basePollMessage,
            poll: {
              question: 'Test question?',
              options: ['yes', 'no'],
              allowMultiple: false,
              votes: [
                {
                  fromConversationId: contactA.id,
                  optionIndexes: [0],
                  voteCount: 1,
                  timestamp: 3,
                  // Only the sent vote should remain after roundtrip
                },
                // The pending vote should be excluded from the backup
              ],
            },
          },
        ]
      );
    });

    it('roundtrips poll with reactions', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          poll: {
            question: 'React to this poll?',
            options: ['yes', 'no'],
            allowMultiple: false,
          },
          reactions: [
            {
              emoji: '👍',
              fromId: contactA.id,
              targetTimestamp: 3,
              timestamp: 3,
            },
            {
              emoji: '❤️',
              fromId: contactB.id,
              targetTimestamp: 3,
              timestamp: 3,
            },
          ],
        },
      ]);
    });

    it('roundtrips quote of poll', async () => {
      await symmetricRoundtripHarness([
        {
          ...basePollMessage,
          poll: {
            question: 'Original poll?',
            options: ['option1', 'option2'],
            allowMultiple: false,
          },
        },
        {
          ...basePollMessage,
          id: generateGuid(), // Generate new ID to avoid duplicate
          sent_at: 4,
          timestamp: 4,
          body: 'Replying to poll',
          poll: undefined,
          quote: {
            id: 3,
            authorAci: CONTACT_A,
            text: 'Original poll?',
            attachments: [],
            isGiftBadge: false,
            isPoll: true,
            isViewOnce: false,
            referencedMessageNotFound: false,
          },
        },
      ]);
    });
  });
});
