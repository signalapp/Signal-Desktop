// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { MessageSearchResult } from '../../components/conversationList/MessageSearchResult.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { getIntl, getTheme } from '../selectors/user.js';
import { getMessageSearchResultSelector } from '../selectors/search.js';
import { createLogger } from '../../logging/log.js';
import { useConversationsActions } from '../ducks/conversations.js';

const log = createLogger('MessageSearchResult');

type SmartMessageSearchResultProps = {
  id: string;
};

export const SmartMessageSearchResult = memo(function SmartMessageSearchResult({
  id,
}: SmartMessageSearchResultProps) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const messageSearchResultSelector = useSelector(
    getMessageSearchResultSelector
  );
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const { showConversation } = useConversationsActions();

  const messageResult = messageSearchResultSelector(id);
  if (messageResult == null) {
    log.error('SmartMessageSearchResult: no message was found');
    return null;
  }
  const { conversationId, snippet, body, bodyRanges, from, to, sentAt } =
    messageResult;

  return (
    <MessageSearchResult
      i18n={i18n}
      theme={theme}
      getPreferredBadge={getPreferredBadge}
      id={id}
      conversationId={conversationId}
      snippet={snippet}
      body={body}
      bodyRanges={bodyRanges}
      from={from}
      to={to}
      showConversation={showConversation}
      sentAt={sentAt}
    />
  );
});
