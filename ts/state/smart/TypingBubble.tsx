// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import { TypingBubble } from '../../components/conversation/TypingBubble';
import { strictAssert } from '../../util/assert';

import { useGlobalModalActions } from '../ducks/globalModals';
import { getIntl, getTheme } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { isInternalUser } from '../selectors/items';

type ExternalProps = {
  conversationId: string;
};

export function SmartTypingBubble(props: ExternalProps): JSX.Element {
  const { conversationId } = props;
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getConversation = useSelector(getConversationSelector);
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Did not find conversation ${conversationId} in state!`);
  }

  strictAssert(
    conversation.typingContactIds?.[0],
    'Missing typing contact IDs'
  );

  const { showContactModal } = useGlobalModalActions();

  const preferredBadgeSelector = useSelector(getPreferredBadgeSelector);

  const internalUser = useSelector(isInternalUser);
  const typingContactIdsVisible = internalUser
    ? conversation.typingContactIds
    : conversation.typingContactIds.slice(0, 1);

  const typingContacts = typingContactIdsVisible
    .map(contactId => getConversation(contactId))
    .map(typingConversation => {
      return {
        ...typingConversation,
        badge: preferredBadgeSelector(typingConversation.badges),
      };
    });

  return (
    <TypingBubble
      showContactModal={showContactModal}
      conversationId={conversationId}
      conversationType={conversation.type}
      i18n={i18n}
      theme={theme}
      typingContacts={typingContacts}
    />
  );
}
