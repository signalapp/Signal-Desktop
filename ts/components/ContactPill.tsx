// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'unblurredAvatarPath'
>;

export function ContactPill({
  acceptedMessageRequest,
  avatarPath,
  color,
  firstName,
  i18n,
  isMe,
  id,
  phoneNumber,
  profileName,
  sharedGroupNames,
  title,
  unblurredAvatarPath,
  onClickRemove,
}: PropsType): JSX.Element {
  const removeLabel = i18n('icu:ContactPill--remove');

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
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.TWENTY}
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
}
