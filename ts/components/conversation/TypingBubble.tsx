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
      name,
      phoneNumber,
      profileName,
      conversationType,
    } = this.props;

    if (conversationType !== 'group') {
      return;
    }
    const userName = name || profileName || phoneNumber;

    return (
      <div className="module-message__author-avatar">
        <Avatar
          avatarPath={avatarPath}
          name={userName}
          size={36}
          pubkey={phoneNumber}
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
              'module-message__container--incoming'
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
