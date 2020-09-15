import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { Emojify } from './conversation/Emojify';

import { LocalizerType } from '../types/Util';

interface Props {
  phoneNumber: string;
  isMe?: boolean;
  name?: string;
  verified: boolean;
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
        size={36}
        pubkey={phoneNumber}
      />
    );
  }

  public render() {
    const {
      i18n,
      name,
      onClick,
      isMe,
      phoneNumber,
      profileName,
      verified,
    } = this.props;

    const title = name ? name : phoneNumber;
    const displayName = isMe ? i18n('me') : title;

    const profileElement =
      !isMe && profileName && !name ? (
        <span className="module-contact-list-item__text__profile-name">
          ~<Emojify text={profileName} i18n={i18n} />
        </span>
      ) : null;

    const showNumber = isMe || name;
    const showVerified = !isMe && verified;

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
          <div className="module-contact-list-item__text__additional-data">
            {showVerified ? (
              <div className="module-contact-list-item__text__verified-icon" />
            ) : null}
            {showVerified ? ` ${i18n('verified')}` : null}
            {showVerified && showNumber ? ' ∙ ' : null}
            {showNumber ? phoneNumber : null}
          </div>
        </div>
      </div>
    );
  }
}
