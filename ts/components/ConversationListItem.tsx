import React from 'react';
import classNames from 'classnames';

import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { Localizer } from '../types/Util';

interface Props {
  phoneNumber: string;
  profileName?: string;
  name?: string;
  color?: string;
  avatarPath?: string;

  lastUpdated: number;
  hasUnread: boolean;
  isSelected: boolean;

  lastMessage?: {
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
    text: string;
  };

  i18n: Localizer;
  onClick?: () => void;
}

function getInitial(name: string): string {
  return name.trim()[0] || '#';
}

export class ConversationListItem extends React.Component<Props> {
  public renderAvatar() {
    const {
      avatarPath,
      color,
      i18n,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    if (!avatarPath) {
      const initial = getInitial(name || '');

      return (
        <div
          className={classNames(
            'module-conversation-list-item__avatar',
            'module-conversation-list-item__default-avatar',
            `module-conversation-list-item__default-avatar--${color}`
          )}
        >
          {initial}
        </div>
      );
    }

    const title = `${name || phoneNumber}${
      !name && profileName ? ` ~${profileName}` : ''
    }`;

    return (
      <img
        className="module-conversation-list-item__avatar"
        alt={i18n('contactAvatarAlt', [title])}
        src={avatarPath}
      />
    );
  }

  public renderHeader() {
    const { i18n, lastUpdated, name, phoneNumber, profileName } = this.props;

    return (
      <div className="module-conversation-list-item__header">
        <div className="module-conversation-list-item__header__name">
          <ContactName
            phoneNumber={phoneNumber}
            name={name}
            profileName={profileName}
            i18n={i18n}
          />
        </div>
        <div className="module-conversation-list-item__header__date">
          <Timestamp
            timestamp={lastUpdated}
            extended={false}
            module="module-conversation-list-item__header__timestamp"
            i18n={i18n}
          />
        </div>
      </div>
    );
  }

  public renderMessage() {
    const { lastMessage, hasUnread, i18n } = this.props;

    if (!lastMessage) {
      return null;
    }

    return (
      <div className="module-conversation-list-item__message">
        {lastMessage.text ? (
          <div
            className={classNames(
              'module-conversation-list-item__message__text',
              hasUnread
                ? 'module-conversation-list-item__message__text--has-unread'
                : null
            )}
          >
            <MessageBody
              text={lastMessage.text}
              disableJumbomoji={true}
              disableLinks={true}
              i18n={i18n}
            />
          </div>
        ) : null}
        {lastMessage.status ? (
          <div
            className={classNames(
              'module-conversation-list-item__message__status-icon',
              `module-conversation-list-item__message__status-icon--${
                lastMessage.status
              }`
            )}
          />
        ) : null}
      </div>
    );
  }

  public render() {
    const { hasUnread, onClick, isSelected } = this.props;

    return (
      <div
        role="button"
        onClick={onClick}
        className={classNames(
          'module-conversation-list-item',
          hasUnread ? 'module-conversation-list-item--has-unread' : null,
          isSelected ? 'module-conversation-list-item--is-selected' : null
        )}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
          {this.renderMessage()}
        </div>
      </div>
    );
  }
}
