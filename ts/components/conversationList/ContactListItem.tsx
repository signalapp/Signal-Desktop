// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { ContactName } from '../conversation/ContactName';
import { About } from '../conversation/About';

export type PropsDataType = Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'id'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'type'
  | 'unblurredAvatarPath'
>;

type PropsHousekeepingType = {
  i18n: LocalizerType;
  onClick?: (id: string) => void;
};

type PropsType = PropsDataType & PropsHousekeepingType;

export const ContactListItem: FunctionComponent<PropsType> = React.memo(
  function ContactListItem({
    about,
    acceptedMessageRequest,
    avatarPath,
    color,
    i18n,
    id,
    isMe,
    name,
    onClick,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
    type,
    unblurredAvatarPath,
  }) {
    const headerName = isMe ? (
      i18n('noteToSelf')
    ) : (
      <ContactName title={title} />
    );

    const messageText =
      about && !isMe ? <About className="" text={about} /> : null;

    return (
      <BaseConversationListItem
        acceptedMessageRequest={acceptedMessageRequest}
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
        sharedGroupNames={sharedGroupNames}
        title={title}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }
);
