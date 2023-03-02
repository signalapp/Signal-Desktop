// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

import { HEADER_CONTACT_NAME_CLASS_NAME } from './BaseConversationListItem';
import type { ConversationType } from '../../state/ducks/conversations';
import type { BadgeType } from '../../badges/types';
import type { LocalizerType, ThemeType } from '../../types/Util';
import { ContactName } from '../conversation/ContactName';
import { About } from '../conversation/About';
import { ListTile } from '../ListTile';
import { Avatar, AvatarSize } from '../Avatar';
import { isSignalConversation } from '../../util/isSignalConversation';

export type ContactListItemConversationType = Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'badges'
  | 'color'
  | 'groupId'
  | 'id'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'type'
  | 'unblurredAvatarPath'
  | 'username'
  | 'e164'
  | 'uuid'
>;

type PropsDataType = ContactListItemConversationType & {
  badge: undefined | BadgeType;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  onClick?: (id: string) => void;
  theme: ThemeType;
};

type PropsType = PropsDataType & PropsHousekeepingType;

export const ContactListItem: FunctionComponent<PropsType> = React.memo(
  function ContactListItem({
    about,
    acceptedMessageRequest,
    avatarPath,
    badge,
    color,
    i18n,
    id,
    isMe,
    onClick,
    phoneNumber,
    profileName,
    sharedGroupNames,
    theme,
    title,
    type,
    unblurredAvatarPath,
    uuid,
  }) {
    const headerName = isMe ? (
      <ContactName
        isMe={isMe}
        module={HEADER_CONTACT_NAME_CLASS_NAME}
        title={i18n('noteToSelf')}
      />
    ) : (
      <ContactName
        isSignalConversation={isSignalConversation({ id, uuid })}
        module={HEADER_CONTACT_NAME_CLASS_NAME}
        title={title}
      />
    );

    const messageText =
      about && !isMe ? <About className="" text={about} /> : undefined;

    return (
      <ListTile
        leading={
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            color={color}
            conversationType={type}
            noteToSelf={Boolean(isMe)}
            i18n={i18n}
            isMe={isMe}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            sharedGroupNames={sharedGroupNames}
            size={AvatarSize.THIRTY_TWO}
            unblurredAvatarPath={unblurredAvatarPath}
            // This is here to appease the type checker.
            {...(badge ? { badge, theme } : { badge: undefined })}
          />
        }
        title={headerName}
        subtitle={messageText}
        subtitleMaxLines={1}
        onClick={onClick ? () => onClick(id) : undefined}
      />
    );
  }
);
