// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { SendStatus } from '../../../messages/MessageSendState';
import {
  MessageAttributesType,
  ShallowChallengeError,
} from '../../../model-types.d';
import { ConversationType } from '../../../state/ducks/conversations';

import {
  canReply,
  getMessagePropStatus,
  isEndSession,
  isGroupUpdate,
  isIncoming,
  isOutgoing,
} from '../../../state/selectors/message';

describe('state/selectors/messages', () => {
  let ourConversationId: string;

  beforeEach(() => {
    ourConversationId = uuid();
  });

  describe('canReply', () => {
    const defaultConversation: ConversationType = {
      id: uuid(),
      type: 'direct',
      title: 'Test conversation',
      isMe: false,
      sharedGroupNames: [],
      acceptedMessageRequest: true,
    };

    it('returns false for disabled v1 groups', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
      };
      const getConversationById = () => ({
        ...defaultConversation,
        type: 'group' as const,
        isGroupV1AndDisabled: true,
      });

      assert.isFalse(canReply(message, ourConversationId, getConversationById));
    });

    // NOTE: This is missing a test for mandatory profile sharing.

    it('returns false if the message was deleted for everyone', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
        deletedForEveryone: true,
      };
      const getConversationById = () => defaultConversation;

      assert.isFalse(canReply(message, ourConversationId, getConversationById));
    });

    it('returns false for outgoing messages that have not been sent', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'outgoing' as const,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
        },
      };
      const getConversationById = () => defaultConversation;

      assert.isFalse(canReply(message, ourConversationId, getConversationById));
    });

    it('returns true for outgoing messages that are only sent to yourself', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'outgoing' as const,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
        },
      };
      const getConversationById = () => defaultConversation;

      assert.isTrue(canReply(message, ourConversationId, getConversationById));
    });

    it('returns true for outgoing messages that have been sent to at least one person', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'outgoing' as const,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
        },
      };
      const getConversationById = () => ({
        ...defaultConversation,
        type: 'group' as const,
      });

      assert.isTrue(canReply(message, ourConversationId, getConversationById));
    });

    it('returns true for incoming messages', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
      };
      const getConversationById = () => defaultConversation;

      assert.isTrue(canReply(message, ourConversationId, getConversationById));
    });
  });

  describe('getMessagePropStatus', () => {
    const createMessage = (overrides: Partial<MessageAttributesType>) => ({
      type: 'outgoing' as const,
      ...overrides,
    });

    it('returns undefined for incoming messages', () => {
      const message = createMessage({ type: 'incoming' });

      assert.isUndefined(
        getMessagePropStatus(message, ourConversationId, true)
      );
    });

    it('returns "paused" for messages with challenges', () => {
      const challengeError: ShallowChallengeError = Object.assign(
        new Error('a challenge'),
        {
          name: 'SendMessageChallengeError',
          retryAfter: 123,
          data: {},
        }
      );
      const message = createMessage({ errors: [challengeError] });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, true),
        'paused'
      );
    });

    it('returns "partial-sent" if the message has errors but was sent to at least one person', () => {
      const message = createMessage({
        errors: [new Error('whoopsie')],
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Delivered,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, true),
        'partial-sent'
      );
    });

    it('returns "error" if the message has errors and has not been sent', () => {
      const message = createMessage({
        errors: [new Error('whoopsie')],
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, true),
        'error'
      );
    });

    it('returns "read" if the message is just for you and has been sent', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
        },
      });

      [true, false].forEach(readReceiptSetting => {
        assert.strictEqual(
          getMessagePropStatus(message, ourConversationId, readReceiptSetting),
          'read'
        );
      });
    });

    it('returns "read" if the message was read by at least one person and you have read receipts enabled', () => {
      const readMessage = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Delivered,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Read,
            updatedAt: Date.now(),
          },
        },
      });
      assert.strictEqual(
        getMessagePropStatus(readMessage, ourConversationId, true),
        'read'
      );

      const viewedMessage = createMessage({
        sendStateByConversationId: {
          [uuid()]: {
            status: SendStatus.Viewed,
            updatedAt: Date.now(),
          },
        },
      });
      assert.strictEqual(
        getMessagePropStatus(viewedMessage, ourConversationId, true),
        'read'
      );
    });

    it('returns "delivered" if the message was read by at least one person and you have read receipts disabled', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Read,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, false),
        'delivered'
      );
    });

    it('returns "delivered" if the message was delivered to at least one person, but no "higher"', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Delivered,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, true),
        'delivered'
      );
    });

    it('returns "sent" if the message was sent to at least one person, but no "higher"', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, true),
        'sent'
      );
    });

    it('returns "sending" if the message has not been sent yet, even if it has been synced to yourself', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId, true),
        'sending'
      );
    });
  });

  describe('isEndSession', () => {
    it('checks if it is end of the session', () => {
      assert.isFalse(isEndSession({}));
      assert.isFalse(isEndSession({ flags: undefined }));
      assert.isFalse(isEndSession({ flags: 0 }));
      assert.isFalse(isEndSession({ flags: 2 }));
      assert.isFalse(isEndSession({ flags: 4 }));

      assert.isTrue(isEndSession({ flags: 1 }));
    });
  });

  describe('isGroupUpdate', () => {
    it('checks if is group update', () => {
      assert.isFalse(isGroupUpdate({}));
      assert.isFalse(isGroupUpdate({ group_update: undefined }));

      assert.isTrue(isGroupUpdate({ group_update: { left: 'You' } }));
    });
  });

  describe('isIncoming', () => {
    it('checks if is incoming message', () => {
      assert.isFalse(isIncoming({ type: 'outgoing' }));
      assert.isFalse(isIncoming({ type: 'call-history' }));

      assert.isTrue(isIncoming({ type: 'incoming' }));
    });
  });

  describe('isOutgoing', () => {
    it('checks if is outgoing message', () => {
      assert.isFalse(isOutgoing({ type: 'incoming' }));
      assert.isFalse(isOutgoing({ type: 'call-history' }));

      assert.isTrue(isOutgoing({ type: 'outgoing' }));
    });
  });
});
