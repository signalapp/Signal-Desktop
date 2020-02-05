import React from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';
import { Portal } from 'react-portal';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { Colors, LocalizerType } from '../types/Util';
import { SessionButton, SessionButtonColor } from './session/SessionButton';

export type PropsData = {
  id: string;
  phoneNumber: string;
  color?: string;
  profileName?: string;
  name?: string;
  type: 'group' | 'direct';
  avatarPath?: string;
  isMe: boolean;
  isPublic?: boolean;
  isRss?: boolean;
  isClosable?: boolean;

  lastUpdated: number;
  unreadCount: number;
  mentionedUs: boolean;
  isSelected: boolean;

  isTyping: boolean;
  lastMessage?: {
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
    text: string;
    isRss: boolean;
  };

  isPendingFriendRequest?: boolean;
  hasReceivedFriendRequest?: boolean;
  hasSentFriendRequest?: boolean;
  isBlocked?: boolean;
  isOnline?: boolean;
  hasNickname?: boolean;
  isFriend?: boolean;
  isSecondary?: boolean;
  isGroupInvitation?: boolean;
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
  acceptFriendRequest?: () => void;
  declineFriendRequest?: () => void;
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
      isPendingFriendRequest,
      hasSentFriendRequest,
    } = this.props;

    let borderColor;
    if (!(isPendingFriendRequest && !hasSentFriendRequest)) {
      borderColor = isOnline ? Colors.ONLINE : Colors.OFFLINE;
    }
    const iconSize = isPendingFriendRequest && !hasSentFriendRequest ? 28 : 36;

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
          size={iconSize}
          borderColor={borderColor}
        />
      </div>
    );
  }

  public renderUnread() {
    const { unreadCount, mentionedUs } = this.props;

    if (unreadCount > 0) {
      const atSymbol = mentionedUs ? <p className="at-symbol">@</p> : null;

      return (
        <div>
          <p className="module-conversation-list-item__unread-count">
            {unreadCount}
          </p>
          {atSymbol}
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
      isFriend,
      hasReceivedFriendRequest,
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
          {isMe ? i18n('noteToSelf') : this.renderUser()}
        </div>
        {hasReceivedFriendRequest || this.renderUnread()}
        {isFriend && (
          <div
            className={classNames(
              'module-conversation-list-item__header__date',
              unreadCount > 0
                ? 'module-conversation-list-item__header__date--has-unread'
                : null
            )}
          >
            {!hasReceivedFriendRequest && (
              <Timestamp
                timestamp={lastUpdated}
                extended={false}
                module="module-conversation-list-item__header__timestamp"
                i18n={i18n}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  public renderContextMenu(triggerId: string) {
    const {
      i18n,
      isBlocked,
      isMe,
      isClosable,
      isRss,
      isPublic,
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
        {!isPublic && !isRss && !isMe ? (
          <MenuItem onClick={blockHandler}>{blockTitle}</MenuItem>
        ) : null}
        {!isPublic && !isRss && !isMe ? (
          <MenuItem onClick={onChangeNickname}>
            {i18n('changeNickname')}
          </MenuItem>
        ) : null}
        {!isPublic && !isRss && !isMe && hasNickname ? (
          <MenuItem onClick={onClearNickname}>{i18n('clearNickname')}</MenuItem>
        ) : null}
        {!isPublic && !isRss ? (
          <MenuItem onClick={onCopyPublicKey}>{i18n('copyPublicKey')}</MenuItem>
        ) : null}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
        {!isMe && isClosable ? (
          !isPublic ? (
            <MenuItem onClick={onDeleteContact}>
              {i18n('deleteContact')}
            </MenuItem>
          ) : (
            <MenuItem onClick={onDeleteContact}>
              {i18n('deletePublicChannel')}
            </MenuItem>
          )
        ) : null}
      </ContextMenu>
    );
  }

  public renderMessage() {
    const {
      lastMessage,
      isTyping,
      unreadCount,
      i18n,
      isPendingFriendRequest,
    } = this.props;

    if (!lastMessage && !isTyping) {
      return null;
    }
    let text = lastMessage && lastMessage.text ? lastMessage.text : '';

    // if coming from Rss feed
    if (lastMessage && lastMessage.isRss) {
      // strip any HTML
      text = text.replace(/<[^>]*>?/gm, '');
    }

    if (isPendingFriendRequest) {
      text = text.replace('Friend Request: ', '');
    }

    if (isEmpty(text)) {
      return null;
    }

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

  public renderFriendRequestButtons() {
    const { acceptFriendRequest, declineFriendRequest } = this.props;

    return (
      <div className="module-conversation-list-item__buttons">
        <SessionButton
          text={window.i18n('decline')}
          buttonColor={SessionButtonColor.None}
          onClick={declineFriendRequest}
        />
        <SessionButton
          text={window.i18n('accept')}
          onClick={acceptFriendRequest}
        />
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
      hasReceivedFriendRequest,
      isBlocked,
      style,
      mentionedUs,
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
              unreadCount > 0 && mentionedUs
                ? 'module-conversation-list-item--mentioned-us'
                : null,
              isSelected ? 'module-conversation-list-item--is-selected' : null,
              hasReceivedFriendRequest
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
            {hasReceivedFriendRequest && this.renderFriendRequestButtons()}
          </div>
        </ContextMenuTrigger>
        <Portal>{this.renderContextMenu(triggerId)}</Portal>
      </div>
    );
  }

  private renderUser() {
    const { name, phoneNumber, profileName } = this.props;

    const shortenedPubkey = window.shortenPubkey(phoneNumber);

    const displayedPubkey = profileName ? shortenedPubkey : phoneNumber;

    return (
      <div className="module-conversation__user">
        <ContactName
          phoneNumber={displayedPubkey}
          name={name}
          profileName={profileName}
          module="module-conversation__user"
          i18n={window.i18n}
          boldProfileName={true}
        />
      </div>
    );
  }
}
