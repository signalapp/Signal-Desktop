import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { LocalizerType } from '../types/Util';

export type PropsData = {
  id: string;
  phoneNumber: string;
  color?: string;
  profileName?: string;
  name?: string;
  type: 'group' | 'direct';
  avatarPath?: string;
  isMe: boolean;

  lastUpdated: number;
  unreadCount: number;
  isSelected: boolean;

  isTyping: boolean;
  lastMessage?: {
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
    text: string;
  };
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
  onClick?: (id: string) => void;
};

type Props = PropsData & PropsHousekeeping;

export class ConversationListItem extends React.PureComponent<Props> {
  public renderAvatar() {
    const {
      avatarPath,
      color,
      type,
      i18n,
      isMe,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    return (
      <div className="module-conversation-list-item__avatar-container">
        <Avatar
          avatarPath={avatarPath}
          color={color}
          noteToSelf={isMe}
          conversationType={type}
          i18n={i18n}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={48}
        />
        {this.renderUnread()}
      </div>
    );
  }

  public renderUnread() {
    const { unreadCount } = this.props;

    if (unreadCount > 0) {
      return (
        <div className="module-conversation-list-item__unread-count">
          {unreadCount}
        </div>
      );
    }

    return null;
  }

  public renderHeader() {
    const {
      unreadCount,
      i18n,
      isMe,
      lastUpdated,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames(
            'module-conversation-list-item__header__name',
            unreadCount > 0
              ? 'module-conversation-list-item__header__name--with-unread'
              : null
          )}
        >
          {isMe ? (
            i18n('noteToSelf')
          ) : (
            <ContactName
              phoneNumber={phoneNumber}
              name={name}
              profileName={profileName}
              i18n={i18n}
            />
          )}
        </div>
        <div
          className={classNames(
            'module-conversation-list-item__header__date',
            unreadCount > 0
              ? 'module-conversation-list-item__header__date--has-unread'
              : null
          )}
        >
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
    const { lastMessage, isTyping, unreadCount, i18n } = this.props;
    if (!lastMessage && !isTyping) {
      return null;
    }
    const text = lastMessage && lastMessage.text ? lastMessage.text : '';

    return (
      <div className="module-conversation-list-item__message">
        <div
          className={classNames(
            'module-conversation-list-item__message__text',
            unreadCount > 0
              ? 'module-conversation-list-item__message__text--has-unread'
              : null
          )}
        >
          {isTyping ? (
            <TypingAnimation i18n={i18n} />
          ) : (
            <MessageBody
              text={text}
              disableJumbomoji={true}
              disableLinks={true}
              i18n={i18n}
            />
          )}
        </div>
        {lastMessage && lastMessage.status ? (
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
    const { unreadCount, onClick, id, isSelected, style } = this.props;

    return (
      <div
        role="button"
        onClick={() => {
          if (onClick) {
            onClick(id);
          }
        }}
        style={style}
        className={classNames(
          'module-conversation-list-item',
          unreadCount > 0 ? 'module-conversation-list-item--has-unread' : null,
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
