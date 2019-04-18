import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { Colors, LocalizerType } from '../types/Util';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';

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

  showFriendRequestIndicator?: boolean;
  isBlocked?: boolean;
  isOnline?: boolean;
  hasNickname?: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
  onClick?: (id: string) => void;
  onDeleteMessages?: () => void;
  onDeleteContact?: () => void;
  onBlockContact?: () => void;
  onChangeNickname?: () => void;
  onClearNickname?: () => void;
  onCopyPublicKey?: () => void;
  onUnblockContact?: () => void;
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
      isOnline,
    } = this.props;

    const borderColor = isOnline ? Colors.ONLINE : Colors.OFFLINE;

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
          borderColor={borderColor}
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

  public renderContextMenu(triggerId: string) {
    const {
      i18n,
      isBlocked,
      isMe,
      hasNickname,
      onDeleteContact,
      onDeleteMessages,
      onBlockContact,
      onChangeNickname,
      onClearNickname,
      onCopyPublicKey,
      onUnblockContact,
    } = this.props;

    const blockTitle = isBlocked ? i18n('unblockUser') : i18n('blockUser');
    const blockHandler = isBlocked ? onUnblockContact : onBlockContact;

    return (
      <ContextMenu id={triggerId}>
        {!isMe ? (
          <MenuItem onClick={blockHandler}>{blockTitle}</MenuItem>
        ) : null}
        {!isMe ? (
          <MenuItem onClick={onChangeNickname}>
            {i18n('changeNickname')}
          </MenuItem>
        ) : null}
        {!isMe && hasNickname ? (
          <MenuItem onClick={onClearNickname}>{i18n('clearNickname')}</MenuItem>
        ) : null}
        <MenuItem onClick={onCopyPublicKey}>{i18n('copyPublicKey')}</MenuItem>
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
        {!isMe ? (
          <MenuItem onClick={onDeleteContact}>{i18n('deleteContact')}</MenuItem>
        ) : null}
      </ContextMenu>
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
    const {
      phoneNumber,
      unreadCount,
      onClick,
      id,
      isSelected,
      showFriendRequestIndicator,
      isBlocked,
      style,
    } = this.props;

    const triggerId = `${phoneNumber}-ctxmenu-${Date.now()}`;

    return (
      <div>
        <ContextMenuTrigger id={triggerId}>
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
              unreadCount > 0
                ? 'module-conversation-list-item--has-unread'
                : null,
              isSelected ? 'module-conversation-list-item--is-selected' : null,
              showFriendRequestIndicator
                ? 'module-conversation-list-item--has-friend-request'
                : null,
              isBlocked ? 'module-conversation-list-item--is-blocked' : null
            )}
          >
            {this.renderAvatar()}
            <div className="module-conversation-list-item__content">
              {this.renderHeader()}
              {this.renderMessage()}
            </div>
          </div>
        </ContextMenuTrigger>
        {this.renderContextMenu(triggerId)}
      </div>
    );
  }
}
