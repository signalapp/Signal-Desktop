// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { getIntl } from '../selectors/user.std.js';
import { getConversationByIdSelector } from '../selectors/conversations.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { PinnedMessagesPanel } from '../../components/conversation/pinned-messages/PinnedMessagesPanel.dom.js';
import type { SmartTimelineItemProps } from './TimelineItem.preload.js';
import { SmartTimelineItem } from './TimelineItem.preload.js';
import type { StateSelector } from '../types.std.js';
import type {
  PinnedMessage,
  PinnedMessageId,
} from '../../types/PinnedMessage.std.js';
import type { StateType } from '../reducer.preload.js';

export type SmartPinnedMessagesPanelProps = Readonly<{
  conversationId: string;
}>;

function renderTimelineItem(props: SmartTimelineItemProps) {
  return <SmartTimelineItem {...props} />;
}

const mockSelectPinnedMessages: StateSelector<ReadonlyArray<PinnedMessage>> =
  createSelector(
    (state: StateType) => state.conversations,
    conversations => {
      const selectedConversationId =
        conversations.selectedConversationId ?? null;
      if (selectedConversationId == null) {
        throw new Error();
      }
      const messageIds =
        conversations.messagesByConversation[selectedConversationId]
          ?.messageIds ?? [];

      return messageIds
        .map(messageId => {
          return conversations.messagesLookup[messageId] ?? null;
        })
        .filter(message => {
          return message.type === 'incoming' || message.type === 'outgoing';
        })
        .slice(-10)
        .map((message, messageIndex): PinnedMessage => {
          return {
            id: messageIndex as PinnedMessageId,
            conversationId: selectedConversationId,
            messageId: message.id,
            pinnedAt: Date.now(),
            expiresAt: null,
          };
        });
    }
  );

export const SmartPinnedMessagesPanel = memo(function SmartPinnedMessagesPanel(
  props: SmartPinnedMessagesPanelProps
) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationByIdSelector);
  const conversation = conversationSelector(props.conversationId);

  strictAssert(
    conversation,
    '<SmartPinnedMessagesPanel> expected a conversation to be found'
  );

  const mockPinnedMessages = useSelector(mockSelectPinnedMessages);

  return (
    <PinnedMessagesPanel
      i18n={i18n}
      conversation={conversation}
      pinnedMessages={mockPinnedMessages}
      renderTimelineItem={renderTimelineItem}
    />
  );
});
