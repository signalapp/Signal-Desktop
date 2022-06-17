// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import type { LocalizerType, ThemeType } from '../../types/Util';
import { AvatarColors } from '../../types/Colors';
import type { LookupConversationWithoutUuidActionsType } from '../../util/lookupConversationWithoutUuid';

export type PropsDataType = {
  username: string;
  isChecked: boolean;
  isFetching: boolean;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  theme: ThemeType;
  toggleConversationInChooseMembers: (conversationId: string) => void;
} & LookupConversationWithoutUuidActionsType;

type PropsType = PropsDataType & PropsHousekeepingType;

export const UsernameCheckbox: FunctionComponent<PropsType> = React.memo(
  function UsernameCheckbox({
    username,
    isChecked,
    isFetching,
    theme,
    i18n,
    lookupConversationWithoutUuid,
    showUserNotFoundModal,
    setIsFetchingUUID,
    toggleConversationInChooseMembers,
  }) {
    const onClickItem = React.useCallback(async () => {
      if (isFetching) {
        return;
      }

      const conversationId = await lookupConversationWithoutUuid({
        showUserNotFoundModal,
        setIsFetchingUUID,

        type: 'username',
        username,
      });

      if (conversationId !== undefined) {
        toggleConversationInChooseMembers(conversationId);
      }
    }, [
      isFetching,
      toggleConversationInChooseMembers,
      lookupConversationWithoutUuid,
      showUserNotFoundModal,
      setIsFetchingUUID,
      username,
    ]);

    const title = i18n('at-username', { username });

    return (
      <BaseConversationListItem
        acceptedMessageRequest={false}
        checked={isChecked}
        color={AvatarColors[0]}
        conversationType="direct"
        headerName={title}
        i18n={i18n}
        isMe={false}
        isSelected={false}
        isUsernameSearchResult
        onClick={onClickItem}
        shouldShowSpinner={isFetching}
        theme={theme}
        sharedGroupNames={[]}
        title={title}
      />
    );
  }
);
