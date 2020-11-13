// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  getConversationCallMode,
  ConversationType,
} from '../../../state/ducks/conversations';
import { CallMode } from '../../../types/Calling';

describe('conversations duck', () => {
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
});
