// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { SendStatus } from '../../messages/MessageSendState.std.js';

import { migrateLegacySendAttributes } from '../../messages/migrateLegacySendAttributes.preload.js';

describe('migrateLegacySendAttributes', () => {
  const defaultMessage = {
    type: 'outgoing' as const,
    sent_at: 123,
    sent: true,
  };

  const createGetConversation = (
    ...conversations: ReadonlyArray<ConversationType>
  ) => {
    const lookup = new Map<string, ConversationType>();
    conversations.forEach(conversation => {
      [conversation.id, conversation.serviceId, conversation.e164].forEach(
        property => {
          if (property) {
            lookup.set(property, conversation);
          }
        }
      );
    });

    return (id?: string | null) => (id ? lookup.get(id) : undefined);
  };

  it("doesn't migrate messages that already have the modern send state", () => {
    const ourConversationId = uuid();
    const message = {
      ...defaultMessage,
      sendStateByConversationId: {
        [ourConversationId]: {
          status: SendStatus.Sent,
          updatedAt: 123,
        },
      },
    };
    const getConversation = () => undefined;

    assert.isUndefined(
      migrateLegacySendAttributes(message, getConversation, ourConversationId)
    );
  });

  it("doesn't migrate messages that aren't outgoing", () => {
    const ourConversationId = uuid();
    const message = {
      ...defaultMessage,
      type: 'incoming' as const,
    };
    const getConversation = () => undefined;

    assert.isUndefined(
      migrateLegacySendAttributes(message, getConversation, ourConversationId)
    );
  });

  it('advances the send state machine, starting from "pending", for different state types', () => {
    let e164Counter = 0;
    const getTestConversation = () => {
      const last4Digits = e164Counter.toString().padStart(4);
      assert.strictEqual(
        last4Digits.length,
        4,
        'Test setup failure: E164 is too long'
      );
      e164Counter += 1;
      return getDefaultConversation({ e164: `+1999555${last4Digits}` });
    };

    // This is aliased for clarity.
    const ignoredUuid = uuid;

    const failedConversationByUuid = getTestConversation();
    const failedConversationByE164 = getTestConversation();
    const pendingConversation = getTestConversation();
    const sentConversation = getTestConversation();
    const deliveredConversation = getTestConversation();
    const readConversation = getTestConversation();
    const conversationNotInRecipientsList = getTestConversation();
    const ourConversation = getTestConversation();

    const message = {
      ...defaultMessage,
      recipients: [
        failedConversationByUuid.serviceId,
        failedConversationByE164.serviceId,
        pendingConversation.serviceId,
        sentConversation.serviceId,
        deliveredConversation.serviceId,
        readConversation.serviceId,
        ignoredUuid(),
        ourConversation.serviceId,
      ],
      errors: [
        Object.assign(new Error('looked up by UUID'), {
          identifier: failedConversationByUuid.serviceId,
        }),
        Object.assign(new Error('looked up by E164'), {
          number: failedConversationByE164.e164,
        }),
        Object.assign(new Error('ignored error'), {
          identifier: ignoredUuid(),
        }),
        new Error('a different error'),
      ],
      sent_to: [
        sentConversation.e164,
        conversationNotInRecipientsList.serviceId,
        ignoredUuid(),
        ourConversation.serviceId,
      ],
      delivered_to: [
        deliveredConversation.serviceId,
        ignoredUuid(),
        ourConversation.serviceId,
      ],
      read_by: [readConversation.serviceId, ignoredUuid()],
    };
    const getConversation = createGetConversation(
      failedConversationByUuid,
      failedConversationByE164,
      pendingConversation,
      sentConversation,
      deliveredConversation,
      readConversation,
      conversationNotInRecipientsList,
      ourConversation
    );

    assert.deepEqual(
      migrateLegacySendAttributes(message, getConversation, ourConversation.id),
      {
        [ourConversation.id]: {
          status: SendStatus.Delivered,
          updatedAt: undefined,
        },
        [failedConversationByUuid.id]: {
          status: SendStatus.Failed,
          updatedAt: undefined,
        },
        [failedConversationByE164.id]: {
          status: SendStatus.Failed,
          updatedAt: undefined,
        },
        [pendingConversation.id]: {
          status: SendStatus.Pending,
          updatedAt: message.sent_at,
        },
        [sentConversation.id]: {
          status: SendStatus.Sent,
          updatedAt: undefined,
        },
        [conversationNotInRecipientsList.id]: {
          status: SendStatus.Sent,
          updatedAt: undefined,
        },
        [deliveredConversation.id]: {
          status: SendStatus.Delivered,
          updatedAt: undefined,
        },
        [readConversation.id]: {
          status: SendStatus.Read,
          updatedAt: undefined,
        },
      }
    );
  });

  it('considers our own conversation sent if the "sent" attribute is set', () => {
    const ourConversation = getDefaultConversation();
    const conversation1 = getDefaultConversation();
    const conversation2 = getDefaultConversation();

    const message = {
      ...defaultMessage,
      recipients: [conversation1.id, conversation2.id],
      sent: true,
    };
    const getConversation = createGetConversation(
      ourConversation,
      conversation1,
      conversation2
    );

    assert.deepEqual(
      migrateLegacySendAttributes(
        message,
        getConversation,
        ourConversation.id
      )?.[ourConversation.id],
      {
        status: SendStatus.Sent,
        updatedAt: undefined,
      }
    );
  });

  it("considers our own conversation failed if the message isn't marked sent and we aren't elsewhere in the recipients list", () => {
    const ourConversation = getDefaultConversation();
    const conversation1 = getDefaultConversation();
    const conversation2 = getDefaultConversation();

    const message = {
      ...defaultMessage,
      recipients: [conversation1.id, conversation2.id],
      sent: false,
    };
    const getConversation = createGetConversation(
      ourConversation,
      conversation1,
      conversation2
    );

    assert.deepEqual(
      migrateLegacySendAttributes(
        message,
        getConversation,
        ourConversation.id
      )?.[ourConversation.id],
      {
        status: SendStatus.Failed,
        updatedAt: undefined,
      }
    );
  });

  it('migrates a typical legacy note to self message', () => {
    const ourConversation = getDefaultConversation();
    const message = {
      ...defaultMessage,
      conversationId: ourConversation.id,
      recipients: [],
      destination: ourConversation.serviceId,
      sent_to: [ourConversation.serviceId],
      sent: true,
      synced: true,
      unidentifiedDeliveries: [],
      delivered_to: [ourConversation.id],
      read_by: [ourConversation.id],
    };
    const getConversation = createGetConversation(ourConversation);

    assert.deepEqual(
      migrateLegacySendAttributes(message, getConversation, ourConversation.id),
      {
        [ourConversation.id]: {
          status: SendStatus.Read,
          updatedAt: undefined,
        },
      }
    );
  });
});
