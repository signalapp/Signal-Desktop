// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { FunctionComponent } from 'react';

import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import { AvatarColors } from '../../types/Colors.std.js';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId.preload.js';
import { ListTile } from '../ListTile.dom.js';
import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { Spinner } from '../Spinner.dom.js';
import { SPINNER_CLASS_NAME } from './BaseConversationListItem.dom.js';

export type PropsDataType = {
  username: string;
  isChecked: boolean;
  isFetching: boolean;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  theme: ThemeType;
  toggleConversationInChooseMembers: (conversationId: string) => void;
} & LookupConversationWithoutServiceIdActionsType;

type PropsType = PropsDataType & PropsHousekeepingType;

export const UsernameCheckbox: FunctionComponent<PropsType> = React.memo(
  function UsernameCheckbox({
    username,
    isChecked,
    isFetching,
    i18n,
    lookupConversationWithoutServiceId,
    showUserNotFoundModal,
    setIsFetchingUUID,
    toggleConversationInChooseMembers,
  }) {
    const onClickItem = React.useCallback(async () => {
      if (isFetching) {
        return;
      }

      const conversationId = await lookupConversationWithoutServiceId({
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
      lookupConversationWithoutServiceId,
      showUserNotFoundModal,
      setIsFetchingUUID,
      username,
    ]);

    const title = username;

    const avatar = (
      <Avatar
        color={AvatarColors[0]}
        conversationType="direct"
        searchResult
        i18n={i18n}
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
