// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { TypingAnimation } from './TypingAnimation';
import { Avatar } from '../Avatar';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';

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
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
};

export class TypingBubble extends React.PureComponent<Props> {
  public renderAvatar(): JSX.Element | null {
    const {
      acceptedMessageRequest,
      avatarPath,
      color,
      conversationType,
      i18n,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
    } = this.props;

    if (conversationType !== 'group') {
      return null;
    }

    return (
      <div className="module-message__author-avatar-container">
        <div className="module-message__author-avatar">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            color={color}
            conversationType="direct"
            i18n={i18n}
            isMe={isMe}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            sharedGroupNames={sharedGroupNames}
            size={28}
          />
        </div>
      </div>
    );
  }

  public render(): JSX.Element {
    const { i18n, conversationType } = this.props;
    const isGroup = conversationType === 'group';

    return (
      <div
        className={classNames(
          'module-message',
          'module-message--incoming',
          isGroup ? 'module-message--group' : null
        )}
      >
        {this.renderAvatar()}
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
}
