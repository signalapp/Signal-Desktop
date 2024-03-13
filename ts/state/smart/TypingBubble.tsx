// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { last } from 'lodash';
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { TypingBubble } from '../../components/conversation/TypingBubble';
import { useGlobalModalActions } from '../ducks/globalModals';
import { getIntl, getTheme } from '../selectors/user';
import { useTimelineItem } from '../selectors/timeline';
import {
  getConversationSelector,
  getConversationMessagesSelector,
} from '../selectors/conversations';
import { getPreferredBadgeSelector } from '../selectors/badges';

type ExternalProps = {
  conversationId: string;
};

export const SmartTypingBubble = memo(function SmartTypingBubble({
  conversationId,
}: ExternalProps): JSX.Element {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getConversation = useSelector(getConversationSelector);
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Did not find conversation ${conversationId} in state!`);
  }

  const typingContactIdTimestamps =
    conversation.typingContactIdTimestamps ?? {};
  const conversationMessages = useSelector(getConversationMessagesSelector)(
    conversationId
  );
  const lastMessageId = last(conversationMessages.items);
  const lastItem = useTimelineItem(lastMessageId, conversationId);
  let lastItemAuthorId: string | undefined;
  let lastItemTimestamp: number | undefined;
  if (lastItem?.data) {
    if ('author' in lastItem.data) {
      lastItemAuthorId = lastItem.data.author?.id;
    }
    if ('receivedAtMS' in lastItem.data) {
      lastItemTimestamp = lastItem.data.receivedAtMS;
    }
  }

  const { showContactModal } = useGlobalModalActions();
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);

  return (
    <TypingBubble
      conversationId={conversationId}
      conversationType={conversation.type}
      typingContactIdTimestamps={typingContactIdTimestamps}
      lastItemAuthorId={lastItemAuthorId}
      lastItemTimestamp={lastItemTimestamp}
      i18n={i18n}
      theme={theme}
      getConversation={getConversation}
      getPreferredBadge={getPreferredBadge}
      showContactModal={showContactModal}
    />
  );
});
