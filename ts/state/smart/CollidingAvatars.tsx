// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { CollidingAvatars } from '../../components/CollidingAvatars';
import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';

export type PropsType = Readonly<{
  conversationIds: ReadonlyArray<string>;
}>;

export const SmartCollidingAvatars = memo(function SmartCollidingAvatars({
  conversationIds,
}: PropsType) {
  const i18n = useSelector(getIntl);
  const getConversation = useSelector(getConversationSelector);

  const conversations = useMemo(() => {
    return conversationIds.map(getConversation).sort((a, b) => {
      return (b.profileLastUpdatedAt ?? 0) - (a.profileLastUpdatedAt ?? 0);
    });
  }, [conversationIds, getConversation]);

  return <CollidingAvatars i18n={i18n} conversations={conversations} />;
});
