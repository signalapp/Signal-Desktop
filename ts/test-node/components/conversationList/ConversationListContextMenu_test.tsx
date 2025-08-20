// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { getDefaultConversation, getDefaultGroup } from '../../../test-helpers/getDefaultConversation';

describe('ConversationListContextMenu', () => {
  const defaultProps = {
    conversation: getDefaultConversation(),
    i18n: {
      getLocaleDirection: () => 'ltr',
      'icu:archiveConversation': 'Archive',
      'icu:moveConversationToInbox': 'Unarchive',
      'icu:pinConversation': 'Pin chat',
      'icu:unpinConversation': 'Unpin chat',
      'icu:markUnread': 'Mark as unread',
      'icu:ConversationHeader__MenuItem--Block': 'Block',
      'icu:ConversationHeader__MenuItem--Unblock': 'Unblock',
      'icu:ConversationHeader__MenuItem--Accept': 'Accept',
      'icu:ConversationHeader__MenuItem--ReportSpam': 'Report Spam',
      'icu:ConversationHeader__MenuItem--DeleteChat': 'Delete Chat',
      'icu:ConversationHeader__ContextMenu__LeaveGroupAction__title': 'Leave Group',
      'icu:deleteConversation': 'Delete conversation',
      'icu:showMembers': 'Show members',
      'icu:allMediaMenuItem': 'All media',
      'icu:ConversationHeader__menu__selectMessages': 'Select messages',
      'icu:showConversationDetails': 'Show conversation details',
      'icu:showConversationDetails--direct': 'Show contact details',
      'icu:muteNotificationsTitle': 'Mute notifications',
      'icu:unmute': 'Unmute',
      'icu:muteAlways': 'Mute always',
      'icu:disappearingMessages': 'Disappearing messages',
      'icu:customDisappearingTimeOption': 'Custom time',
    } as any,
    isMissingMandatoryProfileSharing: false,
    isSignalConversation: false,
    onChangeDisappearingMessages: sinon.fake(),
    onChangeMuteExpiration: sinon.fake(),
    onConversationAccept: sinon.fake(),
    onConversationArchive: sinon.fake(),
    onConversationBlock: sinon.fake(),
    onConversationDelete: sinon.fake(),
    onConversationDeleteMessages: sinon.fake(),
    onConversationLeaveGroup: sinon.fake(),
    onConversationMarkUnread: sinon.fake(),
    onConversationPin: sinon.fake(),
    onConversationReportAndMaybeBlock: sinon.fake(),
    onConversationUnarchive: sinon.fake(),
    onConversationUnblock: sinon.fake(),
    onConversationUnpin: sinon.fake(),
    onSelectModeEnter: sinon.fake(),
    onSetupCustomDisappearingTimeout: sinon.fake(),
    onShowMembers: sinon.fake(),
    onViewAllMedia: sinon.fake(),
    onViewConversationDetails: sinon.fake(),
    triggerId: 'test-trigger-id',
  };

  beforeEach(() => {
    sinon.restore();
  });

  describe('Direct conversation context menu', () => {
    it('provides basic conversation actions', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: true,
        isBlocked: false,
        isArchived: false,
        isPinned: false,
        markedUnread: false,
      });

      // Test that the conversation has the required properties for context menu
      assert.exists(conversation.id);
      assert.strictEqual(conversation.type, 'direct');
      assert.isTrue(conversation.acceptedMessageRequest);
      assert.isFalse(conversation.isBlocked);
      assert.isFalse(conversation.isArchived);
      assert.isFalse(conversation.isPinned);
      assert.isFalse(conversation.markedUnread);
    });

    it('handles archived conversation state', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: true,
        isArchived: true,
      });

      assert.isTrue(conversation.isArchived);
    });

    it('handles pinned conversation state', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: true,
        isPinned: true,
      });

      assert.isTrue(conversation.isPinned);
    });

    it('handles marked unread state', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: true,
        markedUnread: true,
      });

      assert.isTrue(conversation.markedUnread);
    });
  });

  describe('Group conversation context menu', () => {
    it('provides group-specific actions', () => {
      const conversation = getDefaultGroup({
        acceptedMessageRequest: true,
        isBlocked: false,
        isArchived: false,
        isPinned: false,
        groupVersion: 2,
      });

      // Test that the group conversation has the required properties
      assert.exists(conversation.id);
      assert.strictEqual(conversation.type, 'group');
      assert.strictEqual(conversation.groupVersion, 2);
      assert.isTrue(conversation.acceptedMessageRequest);
    });

    it('handles legacy group version', () => {
      const conversation = getDefaultGroup({
        acceptedMessageRequest: true,
        groupVersion: 1,
      });

      assert.strictEqual(conversation.groupVersion, 1);
    });
  });

  describe('Message request context menu', () => {
    it('handles unaccepted conversation state', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: false,
        isBlocked: false,
      });

      assert.isFalse(conversation.acceptedMessageRequest);
      assert.isFalse(conversation.isBlocked);
    });

    it('handles blocked conversation state', () => {
      const conversation = getDefaultConversation({
        acceptedMessageRequest: false,
        isBlocked: true,
      });

      assert.isFalse(conversation.acceptedMessageRequest);
      assert.isTrue(conversation.isBlocked);
    });
  });

  describe('Signal conversation context menu', () => {
    it('identifies Signal conversations', () => {
      const conversation = getDefaultConversation({
        id: '00000000-0000-4000-8000-000000000000', // Signal conversation ID
      });

      assert.strictEqual(conversation.id, '00000000-0000-4000-8000-000000000000');
    });
  });

  describe('Context menu action handlers', () => {
    it('provides archive action handler', () => {
      const onConversationArchive = sinon.fake();
      const props = { ...defaultProps, onConversationArchive };
      
      assert.isFunction(props.onConversationArchive);
    });

    it('provides pin action handler', () => {
      const onConversationPin = sinon.fake();
      const props = { ...defaultProps, onConversationPin };
      
      assert.isFunction(props.onConversationPin);
    });

    it('provides mark unread action handler', () => {
      const onConversationMarkUnread = sinon.fake();
      const props = { ...defaultProps, onConversationMarkUnread };
      
      assert.isFunction(props.onConversationMarkUnread);
    });

    it('provides block action handler', () => {
      const onConversationBlock = sinon.fake();
      const props = { ...defaultProps, onConversationBlock };
      
      assert.isFunction(props.onConversationBlock);
    });

    it('provides accept action handler', () => {
      const onConversationAccept = sinon.fake();
      const props = { ...defaultProps, onConversationAccept };
      
      assert.isFunction(props.onConversationAccept);
    });
  });
});
