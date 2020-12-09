// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { set } from 'lodash/fp';
import {
  actions,
  ConversationMessageType,
  ConversationsStateType,
  ConversationType,
  getConversationCallMode,
  MessageType,
  reducer,
} from '../../../state/ducks/conversations';
import { CallMode } from '../../../types/Calling';

const {
  messageSizeChanged,
  repairNewestMessage,
  repairOldestMessage,
} = actions;

describe('both/state/ducks/conversations', () => {
  describe('helpers', () => {
    describe('getConversationCallMode', () => {
      const fakeConversation: ConversationType = {
        id: 'id1',
        e164: '+18005551111',
        activeAt: Date.now(),
        name: 'No timestamp',
        timestamp: 0,
        inboxPosition: 0,
        phoneNumber: 'notused',
        isArchived: false,
        markedUnread: false,

        type: 'direct',
        isMe: false,
        lastUpdated: Date.now(),
        title: 'No timestamp',
        unreadCount: 1,
        isSelected: false,
        typingContact: {
          name: 'Someone There',
          color: 'blue',
          phoneNumber: '+18005551111',
        },

        acceptedMessageRequest: true,
      };

      it("returns CallMode.None if you've left the conversation", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            left: true,
          }),
          CallMode.None
        );
      });

      it("returns CallMode.None if you've blocked the other person", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            isBlocked: true,
          }),
          CallMode.None
        );
      });

      it("returns CallMode.None if you haven't accepted message requests", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            acceptedMessageRequest: false,
          }),
          CallMode.None
        );
      });

      it('returns CallMode.None if the conversation is Note to Self', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            isMe: true,
          }),
          CallMode.None
        );
      });

      it('returns CallMode.None for v1 groups', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            type: 'group',
            groupVersion: 1,
          }),
          CallMode.None
        );

        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            type: 'group',
          }),
          CallMode.None
        );
      });

      it('returns CallMode.Direct if the conversation is a normal direct conversation', () => {
        assert.strictEqual(
          getConversationCallMode(fakeConversation),
          CallMode.Direct
        );
      });

      it('returns CallMode.Group if the conversation is a v2 group', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            type: 'group',
            groupVersion: 2,
          }),
          CallMode.Group
        );
      });
    });
  });

  describe('reducer', () => {
    const time = Date.now();
    const conversationId = 'conversation-guid-1';
    const messageId = 'message-guid-1';
    const messageIdTwo = 'message-guid-2';
    const messageIdThree = 'message-guid-3';

    function getDefaultState(): ConversationsStateType {
      return {
        conversationLookup: {},
        selectedMessageCounter: 0,
        selectedConversationPanelDepth: 0,
        showArchived: false,
        messagesLookup: {},
        messagesByConversation: {},
      };
    }

    function getDefaultMessage(id: string): MessageType {
      return {
        id,
        conversationId: 'conversationId',
        source: 'source',
        type: 'incoming' as const,
        received_at: Date.now(),
        attachments: [],
        sticker: {},
        unread: false,
      };
    }

    function getDefaultConversationMessage(): ConversationMessageType {
      return {
        heightChangeMessageIds: [],
        isLoadingMessages: false,
        messageIds: [],
        metrics: {
          totalUnread: 0,
        },
        resetCounter: 0,
        scrollToMessageCounter: 0,
      };
    }

    describe('MESSAGE_SIZE_CHANGED', () => {
      const stateWithActiveConversation = {
        ...getDefaultState(),
        messagesByConversation: {
          [conversationId]: {
            heightChangeMessageIds: [],
            isLoadingMessages: false,
            isNearBottom: true,
            messageIds: [messageId],
            metrics: { totalUnread: 0 },
            resetCounter: 0,
            scrollToMessageCounter: 0,
          },
        },
        messagesLookup: {
          [messageId]: getDefaultMessage(messageId),
        },
      };

      it('does nothing if no conversation is active', () => {
        const state = getDefaultState();

        assert.strictEqual(
          reducer(state, messageSizeChanged('messageId', 'convoId')),
          state
        );
      });

      it('does nothing if a different conversation is active', () => {
        assert.deepEqual(
          reducer(
            stateWithActiveConversation,
            messageSizeChanged(messageId, 'another-conversation-guid')
          ),
          stateWithActiveConversation
        );
      });

      it('adds the message ID to the list of messages with changed heights', () => {
        const result = reducer(
          stateWithActiveConversation,
          messageSizeChanged(messageId, conversationId)
        );

        assert.sameMembers(
          result.messagesByConversation[conversationId]
            ?.heightChangeMessageIds || [],
          [messageId]
        );
      });

      it("doesn't add duplicates to the list of changed-heights messages", () => {
        const state = set(
          ['messagesByConversation', conversationId, 'heightChangeMessageIds'],
          [messageId],
          stateWithActiveConversation
        );
        const result = reducer(
          state,
          messageSizeChanged(messageId, conversationId)
        );

        assert.sameMembers(
          result.messagesByConversation[conversationId]
            ?.heightChangeMessageIds || [],
          [messageId]
        );
      });
    });

    describe('REPAIR_NEWEST_MESSAGE', () => {
      it('updates newest', () => {
        const action = repairNewestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageIdThree, messageIdTwo, messageId],
              metrics: {
                totalUnread: 0,
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageIdThree, messageIdTwo, messageId],
              metrics: {
                totalUnread: 0,
                newest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('clears newest', () => {
        const action = repairNewestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                totalUnread: 0,
                newest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                newest: undefined,
                totalUnread: 0,
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('returns state if conversation not present', () => {
        const action = repairNewestMessage(conversationId);
        const state: ConversationsStateType = getDefaultState();
        const actual = reducer(state, action);

        assert.equal(actual, state);
      });
    });

    describe('REPAIR_OLDEST_MESSAGE', () => {
      it('updates oldest', () => {
        const action = repairOldestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageId, messageIdTwo, messageIdThree],
              metrics: {
                totalUnread: 0,
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageId, messageIdTwo, messageIdThree],
              metrics: {
                totalUnread: 0,
                oldest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('clears oldest', () => {
        const action = repairOldestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                totalUnread: 0,
                oldest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getDefaultState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                oldest: undefined,
                totalUnread: 0,
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('returns state if conversation not present', () => {
        const action = repairOldestMessage(conversationId);
        const state: ConversationsStateType = getDefaultState();
        const actual = reducer(state, action);

        assert.equal(actual, state);
      });
    });
  });
});
