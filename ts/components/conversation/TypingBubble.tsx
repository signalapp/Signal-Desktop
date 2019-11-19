import React from 'react';
import classNames from 'classnames';

import { TypingAnimation } from './TypingAnimation';
import { Avatar } from '../Avatar';

import { LocalizerType } from '../../types/Util';

interface Props {
  avatarPath?: string;
  color: string;
  name: string;
  phoneNumber: string;
  profileName: string;
  conversationType: string;
  i18n: LocalizerType;
}

export class TypingBubble extends React.Component<Props> {
  public renderAvatar() {
    const {
      avatarPath,
      color,
      name,
      phoneNumber,
      profileName,
      conversationType,
      i18n,
    } = this.props;

    if (conversationType !== 'group') {
      return;
    }

    return (
      <div className="module-message__author-avatar">
        <Avatar
          avatarPath={avatarPath}
          color={color}
          conversationType="direct"
          i18n={i18n}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={36}
        />
      </div>
    );
  }

  public render() {
    const { i18n, color } = this.props;

    return (
      <div className="loki-message-wrapper">
        <div
          className={classNames('module-message', 'module-message--incoming')}
        >
          <div
            className={classNames(
              'module-message__container',
              'module-message__container--incoming',
              `module-message__container--incoming-${color}`
            )}
          >
            <div className="module-message__typing-container">
              <TypingAnimation color="light" i18n={i18n} />
            </div>
            {this.renderAvatar()}
          </div>
        </div>
      </div>
    );
  }
}
