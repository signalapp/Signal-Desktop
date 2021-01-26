// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { About } from './conversation/About';
import { Avatar } from './Avatar';
import { Emojify } from './conversation/Emojify';
import { InContactsIcon } from './InContactsIcon';

import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

type Props = {
  about?: string;
  avatarPath?: string;
  color?: ColorType;
  i18n: LocalizerType;
  isAdmin?: boolean;
  isMe?: boolean;
  name?: string;
  onClick?: () => void;
  phoneNumber?: string;
  profileName?: string;
  title: string;
};

export class ContactListItem extends React.Component<Props> {
  public renderAvatar(): JSX.Element {
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

  public render(): JSX.Element {
    const { about, i18n, isAdmin, isMe, name, onClick, title } = this.props;

    const displayName = isMe ? i18n('you') : title;
    const shouldShowIcon = Boolean(name);

    return (
      <button
        onClick={onClick}
        className={classNames(
          'module-contact-list-item',
          onClick ? 'module-contact-list-item--with-click-handler' : null
        )}
        type="button"
      >
        {this.renderAvatar()}
        <div className="module-contact-list-item__text">
          <div className="module-contact-list-item__left">
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
              <About text={about} />
            </div>
          </div>
          {isAdmin ? (
            <div className="module-contact-list-item__admin">
              {i18n('GroupV2--admin')}
            </div>
          ) : null}
        </div>
      </button>
    );
  }
}
