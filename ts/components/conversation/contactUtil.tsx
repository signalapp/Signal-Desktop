// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import type { ReadonlyDeep } from 'type-fest';

import { Avatar, AvatarBlur } from '../Avatar.dom.js';
import { AvatarColors } from '../../types/Colors.std.js';
import { getName } from '../../types/EmbeddedContact.std.js';
import { AttachmentStatusIcon } from './AttachmentStatusIcon.dom.js';

import type { LocalizerType } from '../../types/Util.std.js';
import type { EmbeddedContactForUIType } from '../../types/EmbeddedContact.std.js';

export function renderAvatar({
  contact,
  direction,
  i18n,
  size,
}: {
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  direction?: 'outgoing' | 'incoming';
  i18n: LocalizerType;
  size: 52 | 80;
}): JSX.Element {
  const { avatar } = contact;

  const avatarUrl = avatar && avatar.avatar && avatar.avatar.path;
  const title = getName(contact) || '';
  const fallback = (
    <Avatar
      avatarUrl={avatarUrl}
      badge={undefined}
      blur={AvatarBlur.NoBlur}
      color={AvatarColors[0]}
      conversationType="direct"
      i18n={i18n}
      title={title}
      sharedGroupNames={[]}
      size={size}
    />
  );

  const attachment = avatar?.avatar;
  if (attachment == null) {
    return fallback;
  }

  return (
    <AttachmentStatusIcon
      attachment={attachment}
      isIncoming={direction === 'incoming'}
    >
      {fallback}
    </AttachmentStatusIcon>
  );
}

export function renderName({
  contact,
  isIncoming,
  module,
}: {
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  isIncoming: boolean;
  module: string;
}): JSX.Element {
  return (
    <div
      className={classNames(
        `module-${module}__contact-name`,
        isIncoming ? `module-${module}__contact-name--incoming` : null
      )}
    >
      {getName(contact)}
    </div>
  );
}

export function renderContactShorthand({
  contact,
  isIncoming,
  module,
}: {
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  isIncoming: boolean;
  module: string;
}): JSX.Element {
  const { number: phoneNumber, email } = contact;
  const firstNumber = phoneNumber && phoneNumber[0] && phoneNumber[0].value;
  const firstEmail = email && email[0] && email[0].value;

  return (
    <div
      className={classNames(
        `module-${module}__contact-method`,
        isIncoming ? `module-${module}__contact-method--incoming` : null
      )}
    >
      {firstNumber || firstEmail}
    </div>
  );
}
