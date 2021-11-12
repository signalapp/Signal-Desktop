// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';
import { noop } from 'lodash';

import { BaseConversationListItem } from './BaseConversationListItem';

import type { LocalizerType } from '../../types/Util';

type PropsData = {
  username: string;
  isFetchingUsername: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  onClick: (username: string) => void;
};

export type Props = PropsData & PropsHousekeeping;

export const UsernameSearchResultListItem: FunctionComponent<Props> = ({
  i18n,
  isFetchingUsername,
  onClick,
  username,
}) => {
  const usernameText = i18n('at-username', { username });
  const boundOnClick = isFetchingUsername
    ? noop
    : () => {
        onClick(username);
      };

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
