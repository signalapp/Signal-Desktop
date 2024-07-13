// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';
import { SendStatus } from '../../../messages/MessageSendState';
import type {
  MessageAttributesType,
  ShallowChallengeError,
} from '../../../model-types.d';
import type { ConversationType } from '../../../state/ducks/conversations';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../../test-both/helpers/getDefaultConversation';

import {
  canDeleteForEveryone,
  canReact,
  canReply,
  cleanBodyForDirectionCheck,
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

  describe('cleanBodyForDirectionCheck', () => {
    it('drops emoji', () => {
      const body = "😮😮😮😮 that's wild!";
      const expected = " that's wild!";
      const actual = cleanBodyForDirectionCheck(body);
      assert.strictEqual(actual, expected);
    });

    it('drops mentions', () => {
      const body = "heyo, how's it going \uFFFC? And \uFFFC too!";
      const expected = "heyo, how's it going ? And  too!";
      const actual = cleanBodyForDirectionCheck(body);
      assert.strictEqual(actual, expected);
    });

    it('drops links', () => {
      const body =
        'You should download it from https://signal.org/download. Then read something on https://signal.org/blog. Then donate at https://signal.org/donate.';
      const expected =
        'You should download it from . Then read something on . Then donate at .';
      const actual = cleanBodyForDirectionCheck(body);
      assert.strictEqual(actual, expected);
    });

    it('drops all of them at the same time', () => {
      const body =
        'https://signal.org/download 😮 \uFFFC Did you really join Signal?';
      const expected = '   Did you really join Signal?';
      const actual = cleanBodyForDirectionCheck(body);
      assert.strictEqual(actual, expected);
    });
  });

  describe('canDeleteForEveryone', () => {
    it('returns false for incoming messages', () => {
      const message = {
        type: 'incoming' as const,
        sent_at: Date.now() - 1000,
      };
      const isMe = false;

      assert.isFalse(canDeleteForEveryone(message, isMe));
    });

    it('returns false for messages that were already deleted for everyone', () => {
      const message = {
        type: 'outgoing' as const,
        deletedForEveryone: true,
        sent_at: Date.now() - 1000,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Read,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Delivered,
            updatedAt: Date.now(),
          },
        },
      };
      const isMe = false;

      assert.isFalse(canDeleteForEveryone(message, isMe));
    });

    it('returns false for messages that were are too old to delete', () => {
      const message = {
        type: 'outgoing' as const,
        sent_at: Date.now() - moment.duration(25, 'hours').asMilliseconds(),
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Read,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Delivered,
            updatedAt: Date.now(),
          },
        },
      };
      const isMe = false;

      assert.isFalse(canDeleteForEveryone(message, isMe));
    });

    it("returns false for messages that haven't been sent to anyone", () => {
      const message = {
        type: 'outgoing' as const,
        sent_at: Date.now() - 1000,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Failed,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
        },
      };
      const isMe = false;

      assert.isFalse(canDeleteForEveryone(message, isMe));
    });

    it('returns true for messages that meet all criteria for deletion', () => {
      const message = {
        type: 'outgoing' as const,
        sent_at: Date.now() - 1000,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Delivered,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Failed,
            updatedAt: Date.now(),
          },
        },
      };
      const isMe = false;

      assert.isTrue(canDeleteForEveryone(message, isMe));
    });
  });

  describe('canReact', () => {
    const defaultConversation = getDefaultConversation();

    it('returns false for disabled v1 groups', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
      };
      const getConversationById = () => ({
        ...getDefaultGroup(),
        isGroupV1AndDisabled: true,
      });

      assert.isFalse(canReact(message, ourConversationId, getConversationById));
    });

    // NOTE: This is missing a test for mandatory profile sharing.

    it('returns false if the message was deleted for everyone', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
        deletedForEveryone: true,
      };
      const getConversationById = () => defaultConversation;

      assert.isFalse(canReact(message, ourConversationId, getConversationById));
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

      assert.isFalse(canReact(message, ourConversationId, getConversationById));
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

      assert.isTrue(canReact(message, ourConversationId, getConversationById));
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
        ...getDefaultGroup(),
      });

      assert.isTrue(canReact(message, ourConversationId, getConversationById));
    });

    it('returns true for incoming messages', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
      };
      const getConversationById = () => defaultConversation;

      assert.isTrue(canReact(message, ourConversationId, getConversationById));
    });
  });

  describe('canReply', () => {
    const defaultConversation: ConversationType = {
      id: uuid(),
      type: 'direct',
      title: 'Test conversation',
      isMe: false,
      sharedGroupNames: [],
      acceptedMessageRequest: true,
      badges: [],
    };

    it('returns false for disabled v1 groups', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
      };
      const getConversationById = () => ({
        ...getDefaultGroup(),
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
      const getConversationById = () => getDefaultGroup();

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

    it('returns undefined for incoming messages with no errors', () => {
      const message = createMessage({ type: 'incoming' });

      assert.isUndefined(getMessagePropStatus(message, ourConversationId));
    });

    it('returns "error" for incoming messages with errors', () => {
      const message = createMessage({
        type: 'incoming',
        errors: [new Error('something went wrong')],
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId),
        'error'
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
        getMessagePropStatus(message, ourConversationId),
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
        getMessagePropStatus(message, ourConversationId),
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
        getMessagePropStatus(message, ourConversationId),
        'error'
      );
    });

    it('returns "viewed" if the message is just for you and has been sent', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
        },
      });

      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId),
        'viewed'
      );
    });

    it('returns "viewed" if the message was viewed by at least one person', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Viewed,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Read,
            updatedAt: Date.now(),
          },
        },
      });
      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId),
        'viewed'
      );
    });

    it('returns "read" if the message was read by at least one person', () => {
      const message = createMessage({
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: Date.now(),
          },
          [uuid()]: {
            status: SendStatus.Read,
            updatedAt: Date.now(),
          },
        },
      });
      assert.strictEqual(
        getMessagePropStatus(message, ourConversationId),
        'read'
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
        getMessagePropStatus(message, ourConversationId),
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
        getMessagePropStatus(message, ourConversationId),
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
        getMessagePropStatus(message, ourConversationId),
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
