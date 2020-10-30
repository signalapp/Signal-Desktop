// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { MessageBodyHighlight } from './MessageBodyHighlight';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';

import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

export type PropsDataType = {
  isSelected?: boolean;
  isSearchingInConversation?: boolean;

  id: string;
  conversationId: string;
  sentAt: number;

  snippet: string;

  from: {
    phoneNumber?: string;
    title: string;
    isMe?: boolean;
    name?: string;
    color?: ColorType;
    profileName?: string;
    avatarPath?: string;
  };

  to: {
    groupName?: string;
    phoneNumber?: string;
    title: string;
    isMe?: boolean;
    name?: string;
    profileName?: string;
  };
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  openConversationInternal: (
    conversationId: string,
    messageId?: string
  ) => void;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

export class MessageSearchResult extends React.PureComponent<PropsType> {
  public renderFromName(): JSX.Element {
    const { from, i18n, to } = this.props;

    if (from.isMe && to.isMe) {
      return (
        <span className="module-message-search-result__header__name">
          {i18n('noteToSelf')}
        </span>
      );
    }
    if (from.isMe) {
      return (
        <span className="module-message-search-result__header__name">
          {i18n('you')}
        </span>
      );
    }

    return (
      <ContactName
        phoneNumber={from.phoneNumber}
        name={from.name}
        profileName={from.profileName}
        title={from.title}
        module="module-message-search-result__header__name"
        i18n={i18n}
      />
    );
  }

  public renderFrom(): JSX.Element {
    const { i18n, to, isSearchingInConversation } = this.props;
    const fromName = this.renderFromName();

    if (!to.isMe && !isSearchingInConversation) {
      return (
        <div className="module-message-search-result__header__from">
          {fromName} {i18n('toJoiner')}{' '}
          <span className="module-mesages-search-result__header__group">
            <ContactName
              phoneNumber={to.phoneNumber}
              name={to.name}
              profileName={to.profileName}
              title={to.title}
              i18n={i18n}
            />
          </span>
        </div>
      );
    }

    return (
      <div className="module-message-search-result__header__from">
        {fromName}
      </div>
    );
  }

  public renderAvatar(): JSX.Element {
    const { from, i18n, to } = this.props;
    const isNoteToSelf = from.isMe && to.isMe;

    return (
      <Avatar
        avatarPath={from.avatarPath}
        color={from.color}
        conversationType="direct"
        i18n={i18n}
        name={from.name}
        noteToSelf={isNoteToSelf}
        phoneNumber={from.phoneNumber}
        profileName={from.profileName}
        title={from.title}
        size={52}
      />
    );
  }

  public render(): JSX.Element | null {
    const {
      from,
      i18n,
      id,
      isSelected,
      conversationId,
      openConversationInternal,
      sentAt,
      snippet,
      to,
    } = this.props;

    if (!from || !to) {
      return null;
    }

    return (
      <button
        onClick={() => {
          if (openConversationInternal) {
            openConversationInternal(conversationId, id);
          }
        }}
        className={classNames(
          'module-message-search-result',
          isSelected ? 'module-message-search-result--is-selected' : null
        )}
        data-id={id}
        type="button"
      >
        {this.renderAvatar()}
        <div className="module-message-search-result__text">
          <div className="module-message-search-result__header">
            {this.renderFrom()}
            <div className="module-message-search-result__header__timestamp">
              <Timestamp timestamp={sentAt} i18n={i18n} />
            </div>
          </div>
          <div className="module-message-search-result__body">
            <MessageBodyHighlight text={snippet} i18n={i18n} />
          </div>
        </div>
      </button>
    );
  }
}
