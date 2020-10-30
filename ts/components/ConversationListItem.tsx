// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties } from 'react';
import classNames from 'classnames';
import { isNumber } from 'lodash';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';
import { cleanId } from './_util';

import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

export const MessageStatuses = [
  'sending',
  'sent',
  'delivered',
  'read',
  'error',
  'partial-sent',
] as const;

export type MessageStatusType = typeof MessageStatuses[number];

export type PropsData = {
  id: string;
  phoneNumber?: string;
  color?: ColorType;
  profileName?: string;
  title: string;
  name?: string;
  type: 'group' | 'direct';
  avatarPath?: string;
  isMe?: boolean;
  muteExpiresAt?: number;

  lastUpdated: number;
  unreadCount?: number;
  markedUnread: boolean;
  isSelected: boolean;

  acceptedMessageRequest?: boolean;
  draftPreview?: string;
  shouldShowDraft?: boolean;

  typingContact?: unknown;
  lastMessage?: {
    status: MessageStatusType;
    text: string;
    deletedForEveryone?: boolean;
  };
  isPinned?: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: CSSProperties;
  onClick?: (id: string) => void;
};

export type Props = PropsData & PropsHousekeeping;

export class ConversationListItem extends React.PureComponent<Props> {
  public renderAvatar(): JSX.Element {
    const {
      avatarPath,
      color,
      type,
      i18n,
      isMe,
      name,
      phoneNumber,
      profileName,
      title,
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
          title={title}
          size={52}
        />
        {this.renderUnread()}
      </div>
    );
  }

  isUnread(): boolean {
    const { markedUnread, unreadCount } = this.props;

    return (isNumber(unreadCount) && unreadCount > 0) || markedUnread;
  }

  public renderUnread(): JSX.Element | null {
    const { unreadCount } = this.props;

    if (this.isUnread()) {
      return (
        <div className="module-conversation-list-item__unread-count">
          {unreadCount || ''}
        </div>
      );
    }

    return null;
  }

  public renderHeader(): JSX.Element {
    const {
      i18n,
      isMe,
      lastUpdated,
      name,
      phoneNumber,
      profileName,
      title,
    } = this.props;

    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames(
            'module-conversation-list-item__header__name',
            this.isUnread()
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
              title={title}
              i18n={i18n}
            />
          )}
        </div>
        <div
          className={classNames(
            'module-conversation-list-item__header__date',
            this.isUnread()
              ? 'module-conversation-list-item__header__date--has-unread'
              : null
          )}
        >
          <Timestamp
            timestamp={lastUpdated}
            extended={false}
            module="module-conversation-list-item__header__timestamp"
            withUnread={this.isUnread()}
            i18n={i18n}
          />
        </div>
      </div>
    );
  }

  public renderMessage(): JSX.Element | null {
    const {
      draftPreview,
      i18n,
      acceptedMessageRequest,
      lastMessage,
      muteExpiresAt,
      shouldShowDraft,
      typingContact,
    } = this.props;
    if (!lastMessage && !typingContact) {
      return null;
    }

    const messageBody = lastMessage ? lastMessage.text : '';
    const showingDraft = shouldShowDraft && draftPreview;
    const deletedForEveryone = Boolean(
      lastMessage && lastMessage.deletedForEveryone
    );

    /* eslint-disable no-nested-ternary */
    return (
      <div className="module-conversation-list-item__message">
        <div
          dir="auto"
          className={classNames(
            'module-conversation-list-item__message__text',
            this.isUnread()
              ? 'module-conversation-list-item__message__text--has-unread'
              : null
          )}
        >
          {muteExpiresAt && Date.now() < muteExpiresAt && (
            <span className="module-conversation-list-item__muted" />
          )}
          {!acceptedMessageRequest ? (
            <span className="module-conversation-list-item__message-request">
              {i18n('ConversationListItem--message-request')}
            </span>
          ) : typingContact ? (
            <TypingAnimation i18n={i18n} />
          ) : (
            <>
              {showingDraft ? (
                <>
                  <span className="module-conversation-list-item__message__draft-prefix">
                    {i18n('ConversationListItem--draft-prefix')}
                  </span>
                  <MessageBody
                    text={(draftPreview || '').split('\n')[0]}
                    disableJumbomoji
                    disableLinks
                    i18n={i18n}
                  />
                </>
              ) : deletedForEveryone ? (
                <span className="module-conversation-list-item__message__deleted-for-everyone">
                  {i18n('message--deletedForEveryone')}
                </span>
              ) : (
                <MessageBody
                  text={(messageBody || '').split('\n')[0]}
                  disableJumbomoji
                  disableLinks
                  i18n={i18n}
                />
              )}
            </>
          )}
        </div>
        {!showingDraft && lastMessage && lastMessage.status ? (
          <div
            className={classNames(
              'module-conversation-list-item__message__status-icon',
              `module-conversation-list-item__message__status-icon--${lastMessage.status}`
            )}
          />
        ) : null}
      </div>
    );
  }
  /* eslint-enable no-nested-ternary */

  public render(): JSX.Element {
    const { id, isSelected, onClick, style } = this.props;

    return (
      <button
        type="button"
        onClick={() => {
          if (onClick) {
            onClick(id);
          }
        }}
        style={style}
        className={classNames(
          'module-conversation-list-item',
          this.isUnread() ? 'module-conversation-list-item--has-unread' : null,
          isSelected ? 'module-conversation-list-item--is-selected' : null
        )}
        data-id={cleanId(id)}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
          {this.renderMessage()}
        </div>
      </button>
    );
  }
}
