// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useCallback } from 'react';

import {
  BaseConversationListItem,
  MESSAGE_TEXT_CLASS_NAME,
} from './BaseConversationListItem';

import type { LocalizerType } from '../../types/Util';
import { AvatarColors } from '../../types/Colors';

const TEXT_CLASS_NAME = `${MESSAGE_TEXT_CLASS_NAME}__start-new-conversation`;

type PropsData = {
  phoneNumber: string;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  onClick: (phoneNumber: string) => void;
};

export type Props = PropsData & PropsHousekeeping;

export const StartNewConversation: FunctionComponent<Props> = React.memo(
  function StartNewConversation({ i18n, onClick, phoneNumber }) {
    const messageText = (
      <div className={TEXT_CLASS_NAME}>{i18n('startConversation')}</div>
    );

    const boundOnClick = useCallback(() => {
      onClick(phoneNumber);
    }, [onClick, phoneNumber]);

    return (
      <BaseConversationListItem
        acceptedMessageRequest={false}
        color={AvatarColors[0]}
        conversationType="direct"
        headerName={phoneNumber}
        i18n={i18n}
        isMe={false}
        isSelected={false}
        messageText={messageText}
        onClick={boundOnClick}
        phoneNumber={phoneNumber}
        sharedGroupNames={[]}
        title={phoneNumber}
      />
    );
  }
);
