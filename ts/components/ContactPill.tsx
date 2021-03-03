// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent } from 'react';

import { ColorType } from '../types/Colors';
import { LocalizerType } from '../types/Util';
import { ContactName } from './conversation/ContactName';
import { Avatar, AvatarSize } from './Avatar';

export type PropsType = {
  avatarPath?: string;
  color?: ColorType;
  firstName?: string;
  i18n: LocalizerType;
  id: string;
  isMe?: boolean;
  name?: string;
  onClickRemove: (id: string) => void;
  phoneNumber?: string;
  profileName?: string;
  title: string;
};

export const ContactPill: FunctionComponent<PropsType> = ({
  avatarPath,
  color,
  firstName,
  i18n,
  id,
  name,
  phoneNumber,
  profileName,
  title,
  onClickRemove,
}) => {
  const removeLabel = i18n('ContactPill--remove');

  return (
    <div className="module-ContactPill">
      <Avatar
        avatarPath={avatarPath}
        color={color}
        noteToSelf={false}
        conversationType="direct"
        i18n={i18n}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        size={AvatarSize.TWENTY_EIGHT}
      />
      <ContactName
        firstName={firstName}
        i18n={i18n}
        module="module-ContactPill__contact-name"
        name={name}
        phoneNumber={phoneNumber}
        preferFirstName
        profileName={profileName}
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
