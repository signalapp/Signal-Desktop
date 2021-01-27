import React from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { contextMenu } from 'react-contexify';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { LocalizerType } from '../types/Util';

import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from './session/usingClosedConversationDetails';
import {
  ConversationListItemContextMenu,
  PropsContextConversationItem,
} from './session/menu/ConversationListItemContextMenu';
import { createPortal } from 'react-dom';
import { OutgoingMessageStatus } from './conversation/message/OutgoingMessageStatus';
import { DefaultTheme, withTheme } from 'styled-components';
import { PubKey } from '../session/types';

export type ConversationListItemProps = {
  id: string;
  phoneNumber: string;
  color?: string;
  profileName?: string;
  name?: string;
  type: 'group' | 'direct';
  avatarPath?: string;
  isMe: boolean;
  isPublic?: boolean;
  primaryDevice?: string;

  lastUpdated: number;
  unreadCount: number;
  mentionedUs: boolean;
  isSelected: boolean;

  isTyping: boolean;
  lastMessage?: {
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
    text: string;
  };

  isBlocked?: boolean;
  hasNickname?: boolean;
  isGroupInvitation?: boolean;
  isKickedFromGroup?: boolean;
  left?: boolean;
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
  onClick?: (id: string) => void;
  onDeleteMessages?: () => void;
  onDeleteContact?: () => void;
  onLeaveGroup?: () => void;
  onBlockContact?: () => void;
  onCopyPublicKey?: () => void;
  onUnblockContact?: () => void;
  onInviteContacts?: () => void;
  onClearNickname?: () => void;
  theme: DefaultTheme;
};

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(
    children,
    document.querySelector('.inbox.index') as Element
  );
};

class ConversationListItem extends React.PureComponent<Props> {
  public constructor(props: Props) {
    super(props);
  }

  public renderAvatar() {
    const {
      avatarPath,
      i18n,
      name,
      phoneNumber,
      profileName,
      memberAvatars,
    } = this.props;

    const iconSize = 36;
    const userName = name || profileName || phoneNumber;

    return (
      <div className="module-conversation-list-item__avatar-container">
        <Avatar
          avatarPath={avatarPath}
          name={userName}
          size={iconSize}
          memberAvatars={memberAvatars}
          pubkey={phoneNumber}
        />
      </div>
    );
  }

  public renderHeader() {
    const { unreadCount, mentionedUs, i18n, isMe, lastUpdated } = this.props;

    let atSymbol = null;
    let unreadCountDiv = null;
    if (unreadCount > 0) {
      atSymbol = mentionedUs ? <p className="at-symbol">@</p> : null;
      unreadCountDiv = (
        <p className="module-conversation-list-item__unread-count">
          {unreadCount}
        </p>
      );
    }

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
          {this.renderUser()}
        </div>
        {unreadCountDiv}
        {atSymbol}
        {
          <div
            className={classNames(
              'module-conversation-list-item__header__date',
              unreadCount > 0
                ? 'module-conversation-list-item__header__date--has-unread'
                : null
            )}
          >
            {
              <Timestamp
                timestamp={lastUpdated}
                extended={false}
                isConversationListItem={true}
                theme={this.props.theme}
              />
            }
          </div>
        }
      </div>
    );
  }

  public renderMessage() {
    const { lastMessage, isTyping, unreadCount, i18n } = this.props;

    if (!lastMessage && !isTyping) {
      return null;
    }
    const text = lastMessage && lastMessage.text ? lastMessage.text : '';

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
              isGroup={true}
              text={text}
              disableJumbomoji={true}
              disableLinks={true}
              i18n={i18n}
            />
          )}
        </div>
        {lastMessage && lastMessage.status ? (
          <OutgoingMessageStatus
            status={lastMessage.status}
            iconColor={this.props.theme.colors.textColorSubtle}
            theme={this.props.theme}
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
      isBlocked,
      style,
      mentionedUs,
    } = this.props;
    const triggerId = `conversation-item-${phoneNumber}-ctxmenu`;
    const key = `conversation-item-${phoneNumber}`;

    return (
      <div key={key}>
        <div
          role="button"
          onClick={() => {
            if (onClick) {
              onClick(id);
            }
          }}
          onContextMenu={(e: any) => {
            contextMenu.show({
              id: triggerId,
              event: e,
            });
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
            isBlocked ? 'module-conversation-list-item--is-blocked' : null
          )}
        >
          {this.renderAvatar()}
          <div className="module-conversation-list-item__content">
            {this.renderHeader()}
            {this.renderMessage()}
          </div>
        </div>
        <Portal>
          <ConversationListItemContextMenu {...this.getMenuProps(triggerId)} />
        </Portal>
      </div>
    );
  }

  private getMenuProps(triggerId: string): PropsContextConversationItem {
    return {
      triggerId,
      ...this.props,
    };
  }

  private renderUser() {
    const { name, phoneNumber, profileName, isMe, i18n } = this.props;

    const shortenedPubkey = PubKey.shorten(phoneNumber);

    const displayedPubkey = profileName ? shortenedPubkey : phoneNumber;
    const displayName = isMe ? i18n('noteToSelf') : profileName;

    let shouldShowPubkey = false;
    if (!name || name.length === 0) {
      shouldShowPubkey = true;
    }

    return (
      <div className="module-conversation__user">
        <ContactName
          phoneNumber={displayedPubkey}
          name={name}
          profileName={displayName}
          module="module-conversation__user"
          i18n={window.i18n}
          boldProfileName={true}
          shouldShowPubkey={shouldShowPubkey}
        />
      </div>
    );
  }
}

export const ConversationListItemWithDetails = usingClosedConversationDetails(
  withTheme(ConversationListItem)
);
