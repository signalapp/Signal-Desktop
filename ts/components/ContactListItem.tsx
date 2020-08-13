import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { Emojify } from './conversation/Emojify';
import { InContactsIcon } from './InContactsIcon';

import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

interface Props {
  title: string;
  phoneNumber?: string;
  isMe?: boolean;
  name?: string;
  color?: ColorType;
  isVerified?: boolean;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  onClick?: () => void;
}

export class ContactListItem extends React.Component<Props> {
  public renderAvatar() {
    const {
      avatarPath,
      i18n,
      color,
      name,
      phoneNumber,
      profileName,
      title,
    } = this.props;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        size={52}
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
      title,
      isVerified,
    } = this.props;

    const displayName = isMe ? i18n('you') : title;
    const shouldShowIcon = Boolean(name);

    const showNumber = Boolean(isMe || name || profileName);
    const showVerified = !isMe && isVerified;

    return (
      <button
        onClick={onClick}
        className={classNames(
          'module-contact-list-item',
          onClick ? 'module-contact-list-item--with-click-handler' : null
        )}
      >
        {this.renderAvatar()}
        <div className="module-contact-list-item__text">
          <div className="module-contact-list-item__text__name">
            <Emojify text={displayName} />
            {shouldShowIcon ? (
              <span>
                {' '}
                <InContactsIcon i18n={i18n} />
              </span>
            ) : null}
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
      </button>
    );
  }
}
