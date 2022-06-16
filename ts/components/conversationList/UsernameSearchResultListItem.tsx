// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useCallback } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';

import type { LocalizerType } from '../../types/Util';
import { lookupConversationWithoutUuid } from '../../util/lookupConversationWithoutUuid';
import type { LookupConversationWithoutUuidActionsType } from '../../util/lookupConversationWithoutUuid';
import type { ShowConversationType } from '../../state/ducks/conversations';

type PropsData = {
  username: string;
  isFetchingUsername: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  showConversation: ShowConversationType;
} & LookupConversationWithoutUuidActionsType;

export type Props = PropsData & PropsHousekeeping;

export const UsernameSearchResultListItem: FunctionComponent<Props> = ({
  i18n,
  isFetchingUsername,
  username,
  showUserNotFoundModal,
  setIsFetchingUUID,
  showConversation,
}) => {
  const usernameText = i18n('at-username', { username });
  const boundOnClick = useCallback(async () => {
    if (isFetchingUsername) {
      return;
    }
    const conversationId = await lookupConversationWithoutUuid({
      showUserNotFoundModal,
      setIsFetchingUUID,

      type: 'username',
      username,
    });

    if (conversationId !== undefined) {
      showConversation({ conversationId });
    }
  }, [
    username,
    showUserNotFoundModal,
    setIsFetchingUUID,
    showConversation,
    isFetchingUsername,
  ]);

  return (
    <BaseConversationListItem
      acceptedMessageRequest={false}
      conversationType="direct"
      headerName={usernameText}
      i18n={i18n}
      isMe={false}
      isSelected={false}
      isUsernameSearchResult
      shouldShowSpinner={isFetchingUsername}
      onClick={boundOnClick}
      sharedGroupNames={[]}
      title={usernameText}
    />
  );
};
