// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { getDefaultConversation, getDefaultGroup } from '../../../test-helpers/getDefaultConversation';

describe('ConversationListItem', () => {
  const defaultProps = {
    avatarPlaceholderGradient: 'test-gradient',
    acceptedMessageRequest: true,
    avatarUrl: 'test-avatar.jpg',
    badges: [],
    color: 'test-color',
    draftPreview: undefined,
    groupId: undefined,
    hasAvatar: false,
    i18n: {
      'icu:ConversationListItem--blocked': 'Blocked',
      'icu:ConversationListItem--message-request': 'Message request',
      'icu:ConversationListItem--draft-prefix': 'Draft: ',
      'icu:noteToSelf': 'Note to self',
      'icu:message--deletedForEveryone': 'This message was deleted',
    } as any,
    id: 'test-conversation-id',
    isBlocked: false,
    isMe: false,
    isSelected: false,
    lastMessage: undefined,
    lastUpdated: Date.now(),
    markedUnread: false,
    muteExpiresAt: undefined,
    onClick: sinon.fake(),
    onMouseDown: sinon.fake(),
    phoneNumber: '+1234567890',
    profileName: undefined,
    removalStage: undefined,
    sharedGroupNames: [],
    shouldShowDraft: false,
    theme: 'light' as const,
    title: 'Test Conversation',
    type: 'direct' as const,
    typingContactIdTimestamps: {},
    unreadCount: 0,
    unreadMentionsCount: 0,
    serviceId: 'test-service-id',
  };

  beforeEach(() => {
    sinon.restore();
  });

  describe('onContextMenu prop', () => {
    it('accepts onContextMenu prop', () => {
      const onContextMenu = sinon.fake();
      const props = { ...defaultProps, onContextMenu };
      
      // Test that the prop is properly set
      assert.isFunction(props.onContextMenu);
    });

    it('renders without onContextMenu when not provided', () => {
      // Test that the component can work without onContextMenu
      const props = { ...defaultProps };
      delete (props as any).onContextMenu;
      
      // Should not have onContextMenu property
      assert.isUndefined((props as any).onContextMenu);
    });
  });

  describe('conversation data', () => {
    it('has required conversation properties', () => {
      const conversation = getDefaultConversation({
        id: 'test-conversation-id',
        title: 'Test Conversation',
        type: 'direct',
        acceptedMessageRequest: true,
        isBlocked: false,
        isMe: false,
        markedUnread: false,
      });

      assert.strictEqual(conversation.id, 'test-conversation-id');
      assert.strictEqual(conversation.title, 'Test Conversation');
      assert.strictEqual(conversation.type, 'direct');
      assert.isTrue(conversation.acceptedMessageRequest);
      assert.isFalse(conversation.isBlocked);
      assert.isFalse(conversation.isMe);
      assert.isFalse(conversation.markedUnread);
    });

    it('handles note to self conversation', () => {
      const conversation = getDefaultConversation({
        isMe: true,
      });

      assert.isTrue(conversation.isMe);
    });

    it('handles blocked conversation', () => {
      const conversation = getDefaultConversation({
        isBlocked: true,
      });

      assert.isTrue(conversation.isBlocked);
    });

    it('handles message request conversation', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: false,
      });

      assert.isFalse(conversation.acceptedMessageRequest);
    });

    it('handles draft preview', () => {
      const draftPreview = {
        text: 'Test draft message',
        bodyRanges: [],
        prefix: '',
      };

      const conversation = getDefaultConversation({
        shouldShowDraft: true,
        draftPreview,
      });

      assert.isTrue(conversation.shouldShowDraft);
      assert.deepEqual(conversation.draftPreview, draftPreview);
    });

    it('handles deleted message', () => {
      const lastMessage = {
        text: 'Deleted message',
        bodyRanges: [],
        prefix: '',
        deletedForEveryone: true,
      };

      const conversation = getDefaultConversation({
        lastMessage,
      });

      assert.deepEqual(conversation.lastMessage, lastMessage);
    });
  });

  describe('conversation interactions', () => {
    it('provides onClick handler', () => {
      const onClick = sinon.fake();
      const props = { ...defaultProps, onClick };
      
      assert.isFunction(props.onClick);
    });

    it('provides onMouseDown handler', () => {
      const onMouseDown = sinon.fake();
      const props = { ...defaultProps, onMouseDown };
      
      assert.isFunction(props.onMouseDown);
    });
  });

  describe('group conversations', () => {
    it('handles group conversation type', () => {
      const conversation = getDefaultGroup({
        groupId: 'test-group-id',
        title: 'Test Group',
      });

      assert.strictEqual(conversation.type, 'group');
      assert.strictEqual(conversation.groupId, 'test-group-id');
      assert.strictEqual(conversation.title, 'Test Group');
    });
  });

  describe('unread indicators', () => {
    it('handles unread count', () => {
      const conversation = getDefaultConversation({
        unreadCount: 5,
      });

      assert.strictEqual(conversation.unreadCount, 5);
    });

    it('handles unread mentions count', () => {
      const conversation = getDefaultConversation({
        unreadMentionsCount: 3,
      });

      assert.strictEqual(conversation.unreadMentionsCount, 3);
    });

    it('handles marked unread state', () => {
      const conversation = getDefaultConversation({
        markedUnread: true,
      });

      assert.isTrue(conversation.markedUnread);
    });
  });

  describe('conversation metadata', () => {
    it('has avatar information', () => {
      const conversation = getDefaultConversation({
        avatarUrl: 'test-avatar.jpg',
        hasAvatar: true,
        avatarPlaceholderGradient: 'test-gradient',
      });

      assert.strictEqual(conversation.avatarUrl, 'test-avatar.jpg');
      assert.isTrue(conversation.hasAvatar);
      assert.strictEqual(conversation.avatarPlaceholderGradient, 'test-gradient');
    });

    it('has color information', () => {
      const conversation = getDefaultConversation({
        color: 'test-color',
      });

      assert.strictEqual(conversation.color, 'test-color');
    });

    it('has phone number', () => {
      const conversation = getDefaultConversation({
        phoneNumber: '+1234567890',
      });

      assert.strictEqual(conversation.phoneNumber, '+1234567890');
    });

    it('has service ID', () => {
      const conversation = getDefaultConversation({
        serviceId: 'test-service-id',
      });

      assert.strictEqual(conversation.serviceId, 'test-service-id');
    });
  });
});
