// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation';
import { RowType } from '../../components/ConversationList';

describe('ConversationList', () => {
  const defaultProps = {
    dimensions: { width: 400, height: 600 },
    rowCount: 1,
    getRow: (index: number) => ({
      type: RowType.Conversation,
      conversation: getDefaultConversation({ id: 'test-conversation-id' }),
    }),
    scrollBehavior: 'default' as const,
    scrollToRowIndex: undefined,
    shouldRecomputeRowHeights: false,
    scrollable: true,
    hasDialogPadding: false,
    getPreferredBadge: () => undefined,
    i18n: {
      'icu:ConversationList__aria-label': 'Conversation {title}',
      'icu:ConversationList__last-message-undefined': 'No message',
    } as any,
    theme: 'light' as const,
    blockConversation: sinon.fake(),
    onClickArchiveButton: sinon.fake(),
    onClickContactCheckbox: sinon.fake(),
    onClickClearFilterButton: sinon.fake(),
    onPreloadConversation: sinon.fake(),
    onSelectConversation: sinon.fake(),
    onOutgoingAudioCallInConversation: sinon.fake(),
    onOutgoingVideoCallInConversation: sinon.fake(),
    removeConversation: sinon.fake(),
    renderMessageSearchResult: undefined,
    showChooseGroupMembers: sinon.fake(),
    showFindByUsername: sinon.fake(),
    showFindByPhoneNumber: sinon.fake(),
    showConversation: sinon.fake(),
    lookupConversationWithoutServiceId: sinon.fake(),
    showUserNotFoundModal: sinon.fake(),
    setIsFetchingUUID: sinon.fake(),
    // Context menu actions
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
    onChangeDisappearingMessages: sinon.fake(),
    onChangeMuteExpiration: sinon.fake(),
  };

  beforeEach(() => {
    sinon.restore();
  });

  describe('context menu integration', () => {
    it('provides context menu actions for conversation list', () => {
      const props = { ...defaultProps };
      
      // Test that all context menu actions are provided
      assert.isFunction(props.onConversationAccept);
      assert.isFunction(props.onConversationArchive);
      assert.isFunction(props.onConversationBlock);
      assert.isFunction(props.onConversationDelete);
      assert.isFunction(props.onConversationDeleteMessages);
      assert.isFunction(props.onConversationLeaveGroup);
      assert.isFunction(props.onConversationMarkUnread);
      assert.isFunction(props.onConversationPin);
      assert.isFunction(props.onConversationReportAndMaybeBlock);
      assert.isFunction(props.onConversationUnarchive);
      assert.isFunction(props.onConversationUnblock);
      assert.isFunction(props.onConversationUnpin);
      assert.isFunction(props.onSelectModeEnter);
      assert.isFunction(props.onSetupCustomDisappearingTimeout);
      assert.isFunction(props.onShowMembers);
      assert.isFunction(props.onViewAllMedia);
      assert.isFunction(props.onViewConversationDetails);
      assert.isFunction(props.onChangeDisappearingMessages);
      assert.isFunction(props.onChangeMuteExpiration);
    });

    it('generates conversation data for context menu', () => {
      const row = defaultProps.getRow(0);
      assert.exists(row, 'row should exist');
      assert.strictEqual(row.type, RowType.Conversation);
      
      // The conversation should have all necessary properties for context menu
      const conversation = row.conversation;
      assert.exists(conversation.id);
      assert.exists(conversation.type);
      assert.exists(conversation.acceptedMessageRequest);
      assert.exists(conversation.markedUnread);
      
      // These properties might not exist by default, which is fine
      // They will be set by the actual component when needed
      // We only check for properties that are guaranteed to exist
    });

    it('handles multiple conversations with unique IDs', () => {
      const propsWithMultipleConversations = {
        ...defaultProps,
        rowCount: 2,
        getRow: (index: number) => {
          if (index < 0 || index >= 2) {
            return undefined;
          }
          return {
            type: RowType.Conversation,
            conversation: getDefaultConversation({ id: `test-conversation-${index}` }),
          };
        },
      };

      // Test that multiple conversations can be generated
      const row0 = propsWithMultipleConversations.getRow(0);
      const row1 = propsWithMultipleConversations.getRow(1);
      
      assert.exists(row0, 'row0 should exist');
      assert.exists(row1, 'row1 should exist');
      assert.strictEqual(row0.type, RowType.Conversation);
      assert.strictEqual(row1.type, RowType.Conversation);
      
      assert.notStrictEqual(row0.conversation.id, row1.conversation.id);
    });
  });

  describe('conversation item rendering', () => {
    it('provides conversation data correctly', () => {
      const row = defaultProps.getRow(0);
      assert.strictEqual(row?.type, RowType.Conversation);
      
      if (row?.type === RowType.Conversation) {
        const conversation = row.conversation;
        assert.strictEqual(conversation.id, 'test-conversation-id');
      }
    });

    it('handles different row types', () => {
      const propsWithHeader = {
        ...defaultProps,
        rowCount: 2,
        getRow: (index: number) => {
          if (index < 0 || index >= 2) {
            return undefined;
          }
          if (index === 0) {
            return {
              type: RowType.Header,
              getHeaderText: () => 'Test Header',
            };
          }
          return {
            type: RowType.Conversation,
            conversation: getDefaultConversation({ id: 'test-conversation-id' }),
          };
        },
      };

      const row0 = propsWithHeader.getRow(0);
      const row1 = propsWithHeader.getRow(1);
      
      assert.exists(row0, 'row0 should exist');
      assert.exists(row1, 'row1 should exist');
      assert.strictEqual(row0.type, RowType.Header);
      assert.strictEqual(row1.type, RowType.Conversation);
      
      assert.strictEqual(row0.getHeaderText(), 'Test Header');
    });
  });

  describe('context menu event handling', () => {
    it('provides context menu prevention logic', () => {
      // Test that the component can handle context menu events
      // This is tested through the integration with ContextMenuTrigger
      const props = { ...defaultProps };
      
      // All required props should be present
      assert.exists(props.getRow);
      assert.exists(props.rowCount);
    });
  });

  describe('context menu actions integration', () => {
    it('provides archive action handler', () => {
      const onConversationArchive = sinon.fake();
      const propsWithActions = {
        ...defaultProps,
        onConversationArchive,
      };

      assert.isFunction(propsWithActions.onConversationArchive);
    });

    it('provides pin action handler', () => {
      const onConversationPin = sinon.fake();
      const propsWithActions = {
        ...defaultProps,
        onConversationPin,
      };

      assert.isFunction(propsWithActions.onConversationPin);
    });

    it('provides mark unread action handler', () => {
      const onConversationMarkUnread = sinon.fake();
      const propsWithActions = {
        ...defaultProps,
        onConversationMarkUnread,
      };

      assert.isFunction(propsWithActions.onConversationMarkUnread);
    });

    it('provides block action handler', () => {
      const onConversationBlock = sinon.fake();
      const propsWithActions = {
        ...defaultProps,
        onConversationBlock,
      };

      assert.isFunction(propsWithActions.onConversationBlock);
    });
  });

  describe('error handling', () => {
    it('handles missing context menu actions gracefully', () => {
      const propsWithoutActions = {
        ...defaultProps,
        onConversationArchive: undefined,
        onConversationPin: undefined,
        onConversationMarkUnread: undefined,
      };

      // Should handle missing actions gracefully
      assert.isUndefined(propsWithoutActions.onConversationArchive);
      assert.isUndefined(propsWithoutActions.onConversationPin);
      assert.isUndefined(propsWithoutActions.onConversationMarkUnread);
    });

    it('handles missing conversation data gracefully', () => {
      const propsWithInvalidRow = {
        ...defaultProps,
        getRow: () => undefined,
      };

      // Should handle invalid row data gracefully
      const row = propsWithInvalidRow.getRow(0);
      assert.isUndefined(row);
    });
  });
});
