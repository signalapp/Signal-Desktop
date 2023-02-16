// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { FunctionComponent } from 'react';

import type { LocalizerType, ThemeType } from '../../types/Util';
import { AvatarColors } from '../../types/Colors';
import type { LookupConversationWithoutUuidActionsType } from '../../util/lookupConversationWithoutUuid';
import { ListTile } from '../ListTile';
import { Avatar, AvatarSize } from '../Avatar';
import { Spinner } from '../Spinner';
import { SPINNER_CLASS_NAME } from './BaseConversationListItem';

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

    const title = username;

    const avatar = (
      <Avatar
        acceptedMessageRequest={false}
        color={AvatarColors[0]}
        conversationType="direct"
        searchResult
        i18n={i18n}
        isMe={false}
        title={title}
        sharedGroupNames={[]}
        size={AvatarSize.THIRTY_TWO}
        badge={undefined}
      />
    );

    return isFetching ? (
      <ListTile
        leading={avatar}
        title={title}
        trailing={
          <Spinner
            size="20px"
            svgSize="small"
            moduleClassName={SPINNER_CLASS_NAME}
            direction="on-progress-dialog"
          />
        }
      />
    ) : (
      <ListTile.checkbox
        leading={avatar}
        title={title}
        isChecked={isChecked}
        onClick={onClickItem}
        clickable
      />
    );
  }
);
