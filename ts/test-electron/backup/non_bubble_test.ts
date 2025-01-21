// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';
import Long from 'long';

import type { ConversationModel } from '../../models/conversations';

import { getRandomBytes } from '../../Crypto';
import * as Bytes from '../../Bytes';
import { SignalService as Proto, Backups } from '../../protobuf';
import { DataWriter } from '../../sql/Client';
import { APPLICATION_OCTET_STREAM } from '../../types/MIME';
import { generateAci } from '../../types/ServiceId';
import { PaymentEventKind } from '../../types/Payment';
import { ContactFormType } from '../../types/EmbeddedContact';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent';
import { DurationInSeconds } from '../../util/durations';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import {
  setupBasics,
  asymmetricRoundtripHarness,
  symmetricRoundtripHarness,
  OUR_ACI,
} from './helpers';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';

const CONTACT_A = generateAci();
const GROUP_ID = Bytes.toBase64(getRandomBytes(32));

describe('backup/non-bubble messages', () => {
  let contactA: ConversationModel;
  let group: ConversationModel;

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

    await loadAllAndReinitializeRedux();
  });

  it('roundtrips END_SESSION simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        flags: Proto.DataMessage.Flags.END_SESSION,
        attachments: [],
        contact: [],
      },
    ]);
  });

  it('roundtrips CHAT_SESSION_REFRESH simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'chat-session-refreshed',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      },
    ]);
  });

  it('roundtrips IDENTITY_CHANGE update in direct convos', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'keychange',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips IDENTITY_CHANGE update in groups', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: group.id,
        id: generateGuid(),
        type: 'keychange',
        key_changed: contactA.id,
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips IDENTITY_DEFAULT simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'verified-change',
        verifiedChanged: contactA.id,
        verified: false,
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips IDENTITY_VERIFIED simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'verified-change',
        verifiedChanged: contactA.id,
        verified: true,
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips CHANGE_NUMBER simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'change-number-notification',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips JOINED_SIGNAL simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'joined-signal-notification',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips BAD_DECRYPT simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'delivery-issue',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
      },
    ]);
  });

  it('roundtrips PAYMENTS_ACTIVATED simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        sourceServiceId: CONTACT_A,
        payment: {
          kind: PaymentEventKind.Activation,
        },
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
      },
    ]);
  });

  it('roundtrips PAYMENT_ACTIVATION_REQUEST simple update', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        sourceServiceId: CONTACT_A,
        payment: {
          kind: PaymentEventKind.ActivationRequest,
        },
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
      },
    ]);
  });

  it('roundtrips bare payments notification', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        payment: {
          kind: PaymentEventKind.Notification,
          note: 'note with text',
        },
      },
    ]);
  });

  it('roundtrips full payments notification', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        payment: {
          kind: PaymentEventKind.Notification,
          note: 'note with text',
          amountMob: '1.01',
          feeMob: '0.01',
          transactionDetailsBase64: Bytes.toBase64(
            Backups.PaymentNotification.TransactionDetails.encode({
              transaction: {
                timestamp: Long.fromNumber(Date.now()),
              },
            }).finish()
          ),
        },
      },
    ]);
  });

  it('roundtrips embedded contact', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        contact: [
          {
            name: {
              givenName: 'Alice',
              familyName: 'Smith',
            },
            number: [
              {
                type: ContactFormType.MOBILE,
                value: '+121255501234',
              },
            ],
            organization: 'Signal',
          },
        ],
        reactions: [
          {
            emoji: '👍',
            fromId: contactA.id,
            targetTimestamp: 1,
            timestamp: 1,
          },
        ],
      },
    ]);
  });

  it('roundtrips sticker', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        // TODO (DESKTOP-6845): properly handle data FilePointer
        sticker: {
          emoji: '👍',
          packId: Bytes.toHex(getRandomBytes(16)),
          stickerId: 1,
          packKey: Bytes.toBase64(getRandomBytes(32)),
          data: {
            contentType: APPLICATION_OCTET_STREAM,
            error: true,
            size: 0,
          },
        },
        reactions: [
          {
            emoji: '👍',
            fromId: contactA.id,
            targetTimestamp: 1,
            timestamp: 1,
          },
        ],
      },
    ]);
  });

  it('roundtrips remote deleted message', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        received_at_ms: 1,
        sent_at: 1,
        timestamp: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
        unidentifiedDeliveryReceived: true,
        isErased: true,
        deletedForEveryone: true,
      },
    ]);
  });

  it('roundtrips timer notification in direct convos', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'timer-notification',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromMillis(5000),
          sourceServiceId: CONTACT_A,
        },
      },
    ]);
  });

  it('roundtrips profile change notification', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'profile-change',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        changedId: contactA.id,
        sourceServiceId: CONTACT_A,
        profileChange: {
          type: 'name',
          oldName: 'Old Name',
          newName: 'New Name',
        },
      },
    ]);
  });

  it('roundtrips title transition notification', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'title-transition-notification',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
        titleTransition: {
          renderInfo: {
            type: 'private',
            e164: '+12125551234',
          },
        },
      },
    ]);
  });

  it('roundtrips thread merge', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'conversation-merge',
        sourceServiceId: CONTACT_A,
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        conversationMerge: {
          renderInfo: {
            type: 'private',
            e164: '+12125551234',
          },
        },
      },
    ]);
  });

  it('roundtrips session switchover', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'phone-number-discovery',
        received_at: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
        phoneNumberDiscovery: {
          e164: '+12125551234',
        },
      },
    ]);
  });

  it('roundtrips unsupported message', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'incoming',
        received_at: 1,
        sourceServiceId: CONTACT_A,
        sourceDevice: 1,
        sent_at: 1,
        timestamp: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        supportedVersionAtReceive: 5,
        requiredProtocolVersion: 6,
      },
    ]);
  });

  it('creates a tombstone for gv1 update in gv2 group', async () => {
    await asymmetricRoundtripHarness(
      [
        {
          conversationId: group.id,
          id: generateGuid(),
          type: 'incoming',
          received_at: 1,
          received_at_ms: 1,
          sourceServiceId: CONTACT_A,
          sourceDevice: 1,
          sent_at: 1,
          timestamp: 1,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          group_update: {},
        },
      ],
      [
        {
          conversationId: group.id,
          id: 'does not matter',
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'summary' }],
            from: CONTACT_A,
          },
          received_at: 1,
          sent_at: 1,
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Seen,
          sourceServiceId: CONTACT_A,
          timestamp: 1,
        },
      ]
    );
  });

  it('roundtrips spam report message', async () => {
    await symmetricRoundtripHarness([
      {
        conversationId: contactA.id,
        id: generateGuid(),
        type: 'message-request-response-event',
        received_at: 1,
        sourceServiceId: OUR_ACI,
        sourceDevice: 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sent_at: 1,
        timestamp: 1,
        messageRequestResponseEvent: MessageRequestResponseEvent.SPAM,
      },
    ]);
  });
});
