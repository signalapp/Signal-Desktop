import { assert } from 'chai';

import * as Conversation from '../../types/Conversation';
import {
  IncomingMessage,
  OutgoingMessage,
  VerifiedChangeMessage,
} from '../../types/Message';

describe('Conversation', () => {
  describe('createLastMessageUpdate', () => {
    it('should reset last message if conversation has no messages', () => {
      const input = {
        currentLastMessageText: null,
        currentTimestamp: null,
        lastMessage: null,
        lastMessageStatus: null,
        lastMessageNotificationText: null,
      };
      const expected = {
        lastMessage: '',
        lastMessageStatus: null,
        timestamp: null,
      };

      const actual = Conversation.createLastMessageUpdate(input);
      assert.deepEqual(actual, expected);
    });

    context('for regular message', () => {
      it('should update last message text and timestamp', () => {
        const input = {
          currentLastMessageText: 'Existing message',
          currentTimestamp: 555,
          lastMessageStatus: 'read',
          lastMessage: {
            type: 'outgoing',
            conversationId: 'foo',
            sent_at: 666,
            timestamp: 666,
          } as OutgoingMessage,
          lastMessageNotificationText: 'New outgoing message',
        };
        const expected = {
          lastMessage: 'New outgoing message',
          lastMessageStatus: 'read',
          timestamp: 666,
        };

        const actual = Conversation.createLastMessageUpdate(input);
        assert.deepEqual(actual, expected);
      });
    });
    context('for verified change message', () => {
      it('should skip update', () => {
        const input = {
          currentLastMessageText: 'bingo',
          currentTimestamp: 555,
          lastMessageStatus: null,
          lastMessage: {
            type: 'verified-change',
            conversationId: 'foo',
            sent_at: 666,
            timestamp: 666,
          } as VerifiedChangeMessage,
          lastMessageNotificationText: 'Verified Changed',
        };
        const expected = {
          lastMessage: 'bingo',
          lastMessageStatus: null,
          timestamp: 555,
        };

        const actual = Conversation.createLastMessageUpdate(input);
        assert.deepEqual(actual, expected);
      });
    });

    context('for expire timer update from sync', () => {
      it('should update message but not timestamp (to prevent bump to top)', () => {
        const input = {
          currentLastMessageText: 'I am expired',
          currentTimestamp: 555,
          lastMessageStatus: null,
          lastMessage: {
            type: 'incoming',
            conversationId: 'foo',
            sent_at: 666,
            timestamp: 666,
            expirationTimerUpdate: {
              expireTimer: 111,
              fromSync: true,
              source: '+12223334455',
            },
          } as IncomingMessage,
          lastMessageNotificationText: 'Last message before expired',
        };
        const expected = {
          lastMessage: 'Last message before expired',
          lastMessageStatus: null,
          timestamp: 555,
        };

        const actual = Conversation.createLastMessageUpdate(input);
        assert.deepEqual(actual, expected);
      });
    });
  });
});
