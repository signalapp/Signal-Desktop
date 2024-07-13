// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-onlyå
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { MessageSearchResult } from '../../components/conversationList/MessageSearchResult';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getTheme } from '../selectors/user';
import { getMessageSearchResultSelector } from '../selectors/search';
import * as log from '../../logging/log';
import { useConversationsActions } from '../ducks/conversations';

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
