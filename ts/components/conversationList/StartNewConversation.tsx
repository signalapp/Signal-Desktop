// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent } from 'react';

import {
  BaseConversationListItem,
  MESSAGE_TEXT_CLASS_NAME,
} from './BaseConversationListItem';

import { LocalizerType } from '../../types/Util';

const TEXT_CLASS_NAME = `${MESSAGE_TEXT_CLASS_NAME}__start-new-conversation`;

type PropsData = {
  phoneNumber: string;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style: CSSProperties;
  onClick: () => void;
};

export type Props = PropsData & PropsHousekeeping;

export const StartNewConversation: FunctionComponent<Props> = React.memo(
  ({ i18n, onClick, phoneNumber, style }) => {
    const messageText = (
      <div className={TEXT_CLASS_NAME}>{i18n('startConversation')}</div>
    );

    return (
      <BaseConversationListItem
        color="grey"
        conversationType="direct"
        headerName={phoneNumber}
        i18n={i18n}
        isSelected={false}
        messageText={messageText}
        onClick={onClick}
        phoneNumber={phoneNumber}
        style={style}
        title={phoneNumber}
      />
    );
  }
);
