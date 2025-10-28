// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import { SPINNER_CLASS_NAME } from './BaseConversationListItem.dom.js';
import { ListTile } from '../ListTile.dom.js';
import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { Spinner } from '../Spinner.dom.js';

import type { LocalizerType } from '../../types/Util.std.js';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId.preload.js';
import type { ShowConversationType } from '../../state/ducks/conversations.preload.js';

type PropsData = {
  username: string;
  isFetchingUsername: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  showConversation: ShowConversationType;
} & LookupConversationWithoutServiceIdActionsType;

export type Props = PropsData & PropsHousekeeping;

export function UsernameSearchResultListItem({
  i18n,
  isFetchingUsername,
  lookupConversationWithoutServiceId,
  username,
  showUserNotFoundModal,
  setIsFetchingUUID,
  showConversation,
}: Props): JSX.Element {
  const boundOnClick = useCallback(async () => {
    if (isFetchingUsername) {
      return;
    }
    const conversationId = await lookupConversationWithoutServiceId({
      showUserNotFoundModal,
      setIsFetchingUUID,

      type: 'username',
      username,
    });

    if (conversationId !== undefined) {
      showConversation({ conversationId });
    }
  }, [
    isFetchingUsername,
    lookupConversationWithoutServiceId,
    setIsFetchingUUID,
    showConversation,
    showUserNotFoundModal,
    username,
  ]);

  return (
    <ListTile
      leading={
        <Avatar
          conversationType="direct"
          searchResult
          i18n={i18n}
          title={username}
          size={AvatarSize.THIRTY_TWO}
          badge={undefined}
          sharedGroupNames={[]}
        />
      }
      title={username}
      onClick={boundOnClick}
      trailing={
        isFetchingUsername ? (
          <Spinner
            size="20px"
            svgSize="small"
            moduleClassName={SPINNER_CLASS_NAME}
            direction="on-progress-dialog"
          />
        ) : undefined
      }
    />
  );
}
