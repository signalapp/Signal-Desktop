import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';
import { cleanId } from './_util';

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

  draftPreview?: string;
  shouldShowDraft?: boolean;

  typingContact?: Object;
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
          size={52}
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
            withUnread={unreadCount > 0}
            i18n={i18n}
          />
        </div>
      </div>
    );
  }

  public renderMessage() {
    const {
      draftPreview,
      i18n,
      lastMessage,
      shouldShowDraft,
      typingContact,
      unreadCount,
    } = this.props;
    if (!lastMessage && !typingContact) {
      return null;
    }

    const showingDraft = shouldShowDraft && draftPreview;

    // Note: instead of re-using showingDraft here we explode it because
    //   typescript can't tell that draftPreview is truthy otherwise
    const text =
      shouldShowDraft && draftPreview
        ? draftPreview
        : lastMessage && lastMessage.text
          ? lastMessage.text
          : '';

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
          {typingContact ? (
            <TypingAnimation i18n={i18n} />
          ) : (
            <>
              {showingDraft ? (
                <span className="module-conversation-list-item__message__draft-prefix">
                  {i18n('ConversationListItem--draft-prefix')}
                </span>
              ) : null}
              <MessageBody
                text={text.split('\n')[0]}
                disableJumbomoji={true}
                disableLinks={true}
                i18n={i18n}
              />
            </>
          )}
        </div>
        {!showingDraft && lastMessage && lastMessage.status ? (
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
      <button
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
