import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from './Avatar';
import { MessageBodyHighlight } from './MessageBodyHighlight';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';

import { DefaultTheme, withTheme } from 'styled-components';
import { PropsForSearchResults } from '../state/ducks/conversations';

type PropsHousekeeping = {
  isSelected?: boolean;
  theme: DefaultTheme;
  onClick: (conversationId: string, messageId?: string) => void;
};

type Props = PropsForSearchResults & PropsHousekeeping;

class MessageSearchResultInner extends React.PureComponent<Props> {
  public renderFromName() {
    const { from, to } = this.props;

    if (from.isMe && to.isMe) {
      return (
        <span className="module-message-search-result__header__name">
          {window.i18n('noteToSelf')}
        </span>
      );
    }
    if (from.isMe) {
      return (
        <span className="module-message-search-result__header__name">{window.i18n('you')}</span>
      );
    }

    return (
      // tslint:disable: use-simple-attributes
      <ContactName
        phoneNumber={from.phoneNumber}
        name={from.name || ''}
        profileName={from.profileName || ''}
        module="module-message-search-result__header__name"
        shouldShowPubkey={false}
      />
    );
  }

  public renderFrom() {
    const { to } = this.props;
    const fromName = this.renderFromName();

    if (!to.isMe) {
      return (
        <div className="module-message-search-result__header__from">
          {fromName} {window.i18n('to')}{' '}
          <span className="module-mesages-search-result__header__group">
            <ContactName
              phoneNumber={to.phoneNumber}
              name={to.name || ''}
              profileName={to.profileName || ''}
              shouldShowPubkey={false}
            />
          </span>
        </div>
      );
    }

    return <div className="module-message-search-result__header__from">{fromName}</div>;
  }

  public renderAvatar() {
    const { from } = this.props;
    const userName = from.profileName || from.phoneNumber;

    return (
      <Avatar
        avatarPath={from.avatarPath || ''}
        name={userName}
        size={AvatarSize.S}
        pubkey={from.phoneNumber}
      />
    );
  }

  public render() {
    const { from, id, isSelected, conversationId, onClick, receivedAt, snippet, to } = this.props;

    if (!from || !to) {
      return null;
    }

    return (
      <div
        role="button"
        onClick={() => {
          if (onClick) {
            onClick(conversationId, id);
          }
        }}
        className={classNames(
          'module-message-search-result',
          isSelected ? 'module-message-search-result--is-selected' : null
        )}
      >
        {this.renderAvatar()}
        <div className="module-message-search-result__text">
          <div className="module-message-search-result__header">
            {this.renderFrom()}
            <div className="module-message-search-result__header__timestamp">
              <Timestamp timestamp={receivedAt} />
            </div>
          </div>
          <div className="module-message-search-result__body">
            <MessageBodyHighlight text={snippet || ''} />
          </div>
        </div>
      </div>
    );
  }
}

export const MessageSearchResult = withTheme(MessageSearchResultInner);
