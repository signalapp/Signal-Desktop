// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import { ColorType } from '../../types/Colors';
import { LocalizerType } from '../../types/Util';
import { ContactName } from '../conversation/ContactName';
import { About } from '../conversation/About';

export type PropsDataType = {
  about?: string;
  avatarPath?: string;
  color?: ColorType;
  id: string;
  isMe?: boolean;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  title: string;
  type: 'group' | 'direct';
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  style: CSSProperties;
  onClick?: (id: string) => void;
};

type PropsType = PropsDataType & PropsHousekeepingType;

export const ContactListItem: FunctionComponent<PropsType> = React.memo(
  ({
    about,
    avatarPath,
    color,
    i18n,
    id,
    isMe,
    name,
    onClick,
    phoneNumber,
    profileName,
    style,
    title,
    type,
  }) => {
    const headerName = isMe ? (
      i18n('noteToSelf')
    ) : (
      <ContactName
        phoneNumber={phoneNumber}
        name={name}
        profileName={profileName}
        title={title}
        i18n={i18n}
      />
    );

    const messageText =
      about && !isMe ? <About className="" text={about} /> : null;

    return (
      <BaseConversationListItem
        avatarPath={avatarPath}
        color={color}
        conversationType={type}
        headerName={headerName}
        i18n={i18n}
        id={id}
        isMe={isMe}
        isSelected={false}
        messageText={messageText}
        name={name}
        onClick={onClick ? () => onClick(id) : undefined}
        phoneNumber={phoneNumber}
        profileName={profileName}
        style={style}
        title={title}
      />
    );
  }
);
