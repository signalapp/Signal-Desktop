// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import classNames from 'classnames';

import { TypingAnimation } from './TypingAnimation';
import { Avatar } from '../Avatar';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { BadgeType } from '../../badges/types';

export type Props = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  badge: undefined | BadgeType;
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
  theme: ThemeType;
};

export function TypingBubble({
  acceptedMessageRequest,
  avatarPath,
  badge,
  color,
  conversationType,
  i18n,
  isMe,
  name,
  phoneNumber,
  profileName,
  sharedGroupNames,
  theme,
  title,
}: Props): ReactElement {
  const isGroup = conversationType === 'group';

  return (
    <div
      className={classNames(
        'module-message',
        'module-message--incoming',
        isGroup ? 'module-message--group' : null
      )}
    >
      {isGroup && (
        <div className="module-message__author-avatar-container">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            badge={badge}
            color={color}
            conversationType="direct"
            i18n={i18n}
            isMe={isMe}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            theme={theme}
            title={title}
            sharedGroupNames={sharedGroupNames}
            size={28}
          />
        </div>
      )}
      <div className="module-message__container-outer">
        <div
          className={classNames(
            'module-message__container',
            'module-message__container--incoming'
          )}
        >
          <div className="module-message__typing-container">
            <TypingAnimation color="light" i18n={i18n} />
          </div>
        </div>
      </div>
    </div>
  );
}
