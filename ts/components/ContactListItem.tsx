import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from './Avatar';
import { Emojify } from './conversation/Emojify';

import { LocalizerType } from '../types/Util';

interface Props {
  phoneNumber: string;
  isMe?: boolean;
  name?: string;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  onClick?: () => void;
}

export class ContactListItem extends React.Component<Props> {
  public renderAvatar() {
    const { avatarPath, name, phoneNumber, profileName } = this.props;

    const userName = name || profileName || phoneNumber;

    return (
      <Avatar
        avatarPath={avatarPath}
        name={userName}
        size={AvatarSize.S}
        pubkey={phoneNumber}
      />
    );
  }

  public render() {
    const { i18n, name, onClick, isMe, phoneNumber, profileName } = this.props;

    const title = name ? name : phoneNumber;
    const displayName = isMe ? i18n('me') : title;

    const profileElement =
      !isMe && profileName && !name ? (
        <span className="module-contact-list-item__text__profile-name">
          ~
          <Emojify
            text={profileName}
            i18n={i18n}
            key={`emojify-list-item-${phoneNumber}`}
          />
        </span>
      ) : null;

    const showNumber = isMe || name;

    return (
      <div
        role="button"
        onClick={onClick}
        className={classNames(
          'module-contact-list-item',
          onClick ? 'module-contact-list-item--with-click-handler' : null
        )}
      >
        {this.renderAvatar()}
        <div className="module-contact-list-item__text">
          <div className="module-contact-list-item__text__name">
            <Emojify text={displayName} i18n={i18n} /> {profileElement}
          </div>
        </div>
      </div>
    );
  }
}
