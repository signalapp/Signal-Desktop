// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { ConversationType } from '../../../state/ducks/conversations';

import {
  canReply,
  isEndSession,
  isGroupUpdate,
  isIncoming,
  isOutgoing,
} from '../../../state/selectors/message';

describe('state/selectors/messages', () => {
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

      assert.isFalse(canReply(message, getConversationById));
    });

    // NOTE: This is missing a test for mandatory profile sharing.

    it('returns false if the message was deleted for everyone', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
        deletedForEveryone: true,
      };
      const getConversationById = () => defaultConversation;

      assert.isFalse(canReply(message, getConversationById));
    });

    it('returns false for outgoing messages that have not been sent', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'outgoing' as const,
        sent_to: [],
      };
      const getConversationById = () => defaultConversation;

      assert.isFalse(canReply(message, getConversationById));
    });

    it('returns true for outgoing messages that have been delivered to at least one person', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'outgoing' as const,
        receipients: [uuid(), uuid()],
        sent_to: [uuid()],
      };
      const getConversationById = () => ({
        ...defaultConversation,
        type: 'group' as const,
      });

      assert.isTrue(canReply(message, getConversationById));
    });

    it('returns true for incoming messages', () => {
      const message = {
        conversationId: 'fake-conversation-id',
        type: 'incoming' as const,
      };
      const getConversationById = () => defaultConversation;

      assert.isTrue(canReply(message, getConversationById));
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
