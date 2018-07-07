import React from 'react';
import classNames from 'classnames';

import { Emojify } from './conversation/Emojify';

import { Localizer } from '../types/Util';

interface Props {
  phoneNumber: string;
  isMe?: boolean;
  name?: string;
  color?: string;
  verified: boolean;
  profileName?: string;
  avatarPath?: string;
  i18n: Localizer;
  onClick?: () => void;
}

function getInitial(name: string): string {
  return name.trim()[0] || '#';
}

export class ContactListItem extends React.Component<Props> {
  public renderAvatar({ displayName }: { displayName: string }) {
    const { avatarPath, i18n, color, name } = this.props;

    if (avatarPath) {
      return (
        <div className="module-contact-list-item__avatar">
          <img alt={i18n('contactAvatarAlt', [displayName])} src={avatarPath} />
        </div>
      );
    }

    const title = name ? getInitial(name) : '#';

    return (
      <div
        className={classNames(
          'module-contact-list-item__avatar-default',
          `module-contact-list-item__avatar-default--${color}`
        )}
      >
        <div className="module-contact-list-item__avatar-default__label">
          {title}
        </div>
      </div>
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
        {this.renderAvatar({ displayName })}
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
