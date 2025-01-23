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
import { ID_V1_LENGTH } from '../../groups';
import { DurationInSeconds, WEEK } from '../../util/durations';
import {
  setupBasics,
  asymmetricRoundtripHarness,
  symmetricRoundtripHarness,
  OUR_ACI,
} from './helpers';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';
import { strictAssert } from '../../util/assert';
import type { MessageAttributesType } from '../../model-types';
import { TEXT_ATTACHMENT } from '../../types/MIME';
import { MY_STORY_ID } from '../../types/Stories';

const CONTACT_A = generateAci();
const CONTACT_B = generateAci();
const CONTACT_B_E164 = '+12135550123';
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
  let contactB: ConversationModel;
  let gv1: ConversationModel;

  beforeEach(async () => {
    await DataWriter._removeAllMessages();
    await DataWriter._removeAllConversations();
    window.storage.reset();

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
        received_at_ms: 3,
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
          [CONTACT_A]: {
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
          [CONTACT_A]: {
            status: SendStatus.Read,
            updatedAt: 3,
          },
        },
      };

      await symmetricRoundtripHarness([incomingReply, outgoingReply]);
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
});
