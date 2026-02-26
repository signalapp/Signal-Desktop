// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.js';
import {
  getConversationByIdSelector,
  getPinnedMessages,
} from '../selectors/conversations.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { PinnedMessagesPanel } from '../../components/conversation/pinned-messages/PinnedMessagesPanel.dom.js';
import type { SmartTimelineItemProps } from './TimelineItem.preload.js';
import { SmartTimelineItem } from './TimelineItem.preload.js';
import { canPinMessages as getCanPinMessages } from '../selectors/message.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useNavActions } from '../ducks/nav.std.js';

export type SmartPinnedMessagesPanelProps = Readonly<{
  conversationId: string;
}>;

function renderTimelineItem(props: SmartTimelineItemProps) {
  return <SmartTimelineItem {...props} />;
}

export const SmartPinnedMessagesPanel = memo(function SmartPinnedMessagesPanel(
  props: SmartPinnedMessagesPanelProps
) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationByIdSelector);
  const conversation = conversationSelector(props.conversationId);
  const { onPinnedMessageRemove } = useConversationsActions();
  const { popPanelForConversation } = useNavActions();

  strictAssert(
    conversation,
    '<SmartPinnedMessagesPanel> expected a conversation to be found'
  );

  const pinnedMessages = useSelector(getPinnedMessages);
  const canPinMessages = getCanPinMessages(conversation);

  const handlePinnedMessageRemoveAll = useCallback(() => {
    popPanelForConversation();
    for (const pinnedMessage of pinnedMessages) {
      onPinnedMessageRemove(pinnedMessage.messageId);
    }
  }, [popPanelForConversation, pinnedMessages, onPinnedMessageRemove]);

  return (
    <PinnedMessagesPanel
      i18n={i18n}
      conversation={conversation}
      pinnedMessages={pinnedMessages}
      renderTimelineItem={renderTimelineItem}
      canPinMessages={canPinMessages}
      onPinnedMessageRemoveAll={handlePinnedMessageRemoveAll}
    />
  );
});
