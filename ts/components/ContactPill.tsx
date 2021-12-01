// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { ContactName } from './conversation/ContactName';
import { Avatar, AvatarSize } from './Avatar';

export type PropsType = {
  i18n: LocalizerType;
  onClickRemove: (id: string) => void;
} & Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'firstName'
  | 'id'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'unblurredAvatarPath'
>;

export const ContactPill: FunctionComponent<PropsType> = ({
  acceptedMessageRequest,
  avatarPath,
  color,
  firstName,
  i18n,
  isMe,
  id,
  name,
  phoneNumber,
  profileName,
  sharedGroupNames,
  title,
  unblurredAvatarPath,
  onClickRemove,
}) => {
  const removeLabel = i18n('ContactPill--remove');

  return (
    <div className="module-ContactPill">
      <Avatar
        acceptedMessageRequest={acceptedMessageRequest}
        avatarPath={avatarPath}
        badge={undefined}
        color={color}
        noteToSelf={false}
        conversationType="direct"
        i18n={i18n}
        isMe={isMe}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.TWENTY_EIGHT}
        unblurredAvatarPath={unblurredAvatarPath}
      />
      <ContactName
        firstName={firstName}
        module="module-ContactPill__contact-name"
        preferFirstName
        title={title}
      />
      <button
        aria-label={removeLabel}
        className="module-ContactPill__remove"
        onClick={() => {
          onClickRemove(id);
        }}
        title={removeLabel}
        type="button"
      />
    </div>
  );
};
