// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { About } from './conversation/About';
import { Avatar } from './Avatar';
import { Emojify } from './conversation/Emojify';
import { InContactsIcon } from './InContactsIcon';

import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from '../util/isInSystemContacts';

type Props = {
  i18n: LocalizerType;
  isAdmin?: boolean;
  onClick?: () => void;
} & Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'type'
  | 'unblurredAvatarPath'
>;

export class ContactListItem extends React.Component<Props> {
  public renderAvatar(): JSX.Element {
    const {
      acceptedMessageRequest,
      avatarPath,
      color,
      i18n,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
      type,
      unblurredAvatarPath,
    } = this.props;

    return (
      <Avatar
        acceptedMessageRequest={acceptedMessageRequest}
        avatarPath={avatarPath}
        color={color}
        conversationType={type}
        i18n={i18n}
        isMe={isMe}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={52}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }

  public render(): JSX.Element {
    const {
      about,
      i18n,
      isAdmin,
      isMe,
      name,
      onClick,
      title,
      type,
    } = this.props;

    const displayName = isMe ? i18n('you') : title;

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
              {isInSystemContacts({ name, type }) ? (
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
