import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from './Avatar';
import { MessageBodyHighlight } from './MessageBodyHighlight';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';

import {
  FindAndFormatContactType,
  openConversationExternal,
  PropsForSearchResults,
} from '../state/ducks/conversations';
import { useDispatch } from 'react-redux';

type PropsHousekeeping = {
  isSelected?: boolean;
};

type Props = PropsForSearchResults & PropsHousekeeping;

const FromName = (props: { from: FindAndFormatContactType; to: FindAndFormatContactType }) => {
  const { from, to } = props;

  if (from.isMe && to.isMe) {
    return (
      <span className="module-message-search-result__header__name">
        {window.i18n('noteToSelf')}
      </span>
    );
  }
  if (from.isMe) {
    return <span className="module-message-search-result__header__name">{window.i18n('you')}</span>;
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
};

const From = (props: { from: FindAndFormatContactType; to: FindAndFormatContactType }) => {
  const { to, from } = props;
  const fromName = <FromName from={from} to={to} />;

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
};

const AvatarItem = (props: { from: FindAndFormatContactType }) => {
  const { from } = props;
  const userName = from.profileName || from.phoneNumber;

  return (
    <Avatar
      avatarPath={from.avatarPath || ''}
      name={userName}
      size={AvatarSize.S}
      pubkey={from.phoneNumber}
    />
  );
};
export const MessageSearchResult = (props: Props) => {
  const { from, id: messageId, isSelected, conversationId, receivedAt, snippet, to } = props;

  const dispatch = useDispatch();

  if (!from || !to) {
    return null;
  }

  return (
    <div
      role="button"
      onClick={() => {
        dispatch(openConversationExternal({ id: conversationId, messageId }));
      }}
      className={classNames(
        'module-message-search-result',
        isSelected ? 'module-message-search-result--is-selected' : null
      )}
    >
      <AvatarItem from={from} />
      <div className="module-message-search-result__text">
        <div className="module-message-search-result__header">
          <From from={from} to={to} />
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
};
