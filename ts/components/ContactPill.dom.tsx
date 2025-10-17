// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../types/Util.std.js';
import { ContactName } from './conversation/ContactName.dom.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';

export type PropsType = {
  i18n: LocalizerType;
  onClickRemove: (id: string) => void;
} & Pick<
  ConversationType,
  | 'about'
  | 'avatarPlaceholderGradient'
  | 'avatarUrl'
  | 'color'
  | 'firstName'
  | 'hasAvatar'
  | 'id'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
>;

export function ContactPill({
  avatarPlaceholderGradient,
  avatarUrl,
  color,
  firstName,
  hasAvatar,
  i18n,
  id,
  phoneNumber,
  profileName,
  sharedGroupNames,
  title,
  onClickRemove,
}: PropsType): JSX.Element {
  const removeLabel = i18n('icu:ContactPill--remove');

  return (
    <div className="module-ContactPill">
      <Avatar
        avatarPlaceholderGradient={avatarPlaceholderGradient}
        avatarUrl={avatarUrl}
        badge={undefined}
        color={color}
        noteToSelf={false}
        conversationType="direct"
        hasAvatar={hasAvatar}
        i18n={i18n}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.TWENTY}
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
