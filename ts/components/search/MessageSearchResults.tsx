import React from 'react';
import classNames from 'classnames';

import { getOurPubKeyStrFromCache } from '../../session/utils/User';
import {
  FindAndFormatContactType,
  openConversationToSpecificMessage,
} from '../../state/ducks/conversations';
import { ContactName } from '../conversation/ContactName';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { Timestamp } from '../conversation/Timestamp';
import { MessageBodyHighlight } from '../basic/MessageBodyHighlight';
import styled from 'styled-components';
import { MessageAttributes } from '../../models/messageType';
import { useIsPrivate } from '../../hooks/useParamSelector';
import { UserUtils } from '../../session/utils';

export type PropsForSearchResults = {
  from: FindAndFormatContactType;
  to: FindAndFormatContactType;
  id: string;
  conversationId: string;
  destination: string;
  source: string;

  direction?: string;
  snippet?: string; //not sure about the type of snippet
  receivedAt?: number;
};

export type MessageResultProps = MessageAttributes & { snippet: string };

const FromName = (props: { source: string; destination: string }) => {
  const { source, destination } = props;

  const isNoteToSelf = destination === getOurPubKeyStrFromCache() && source === destination;

  if (isNoteToSelf) {
    return (
      <span className="module-message-search-result__header__name">
        {window.i18n('noteToSelf')}
      </span>
    );
  }

  if (source === getOurPubKeyStrFromCache()) {
    return <span className="module-message-search-result__header__name">{window.i18n('you')}</span>;
  }

  return (
    // tslint:disable: use-simple-attributes
    <ContactName
      pubkey={source}
      module="module-message-search-result__header__name"
      shouldShowPubkey={false}
    />
  );
};

const From = (props: { source: string; destination: string }) => {
  const { source, destination } = props;
  const fromName = <FromName source={source} destination={destination} />;

  const ourKey = getOurPubKeyStrFromCache();

  if (destination !== ourKey) {
    return (
      <div className="module-message-search-result__header__from">
        {fromName} {window.i18n('to')}
        <span className="module-messages-search-result__header__group">
          <ContactName pubkey={destination} shouldShowPubkey={false} />
        </span>
      </div>
    );
  }

  return <div className="module-message-search-result__header__from">{fromName}</div>;
};

const AvatarItem = (props: { source: string }) => {
  return <Avatar size={AvatarSize.S} pubkey={props.source} />;
};

const ResultBody = styled.div`
  margin-top: 1px;
  flex-grow: 1;
  flex-shrink: 1;

  font-size: 13px;

  color: var(--color-text-subtle);

  max-height: 3.6em;

  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export const MessageSearchResult = (props: MessageResultProps) => {
  const {
    id,
    conversationId,
    received_at,
    snippet,
    source,
    sent_at,
    serverTimestamp,
    timestamp,
    direction,
  } = props;

  /** destination is only used for search results (showing the `from:` and `to`)
   *  1.  for messages we sent or synced from another of our devices
   *    - the conversationId for a private convo
   *    - the conversationId for a closed group convo
   *    - the conversationId for an opengroup
   *
   *  2. for messages we received
   *    - our own pubkey for a private conversation
   *    - the conversationID for a closed group
   *    - the conversationID for a public group
   */
  const me = UserUtils.getOurPubKeyStrFromCache();

  const convoIsPrivate = useIsPrivate(conversationId);
  const destination =
    direction === 'incoming' ? conversationId : convoIsPrivate ? me : conversationId;

  if (!source && !destination) {
    return null;
  }

  return (
    <div
      key={`div-msg-searchresult-${id}`}
      role="button"
      onClick={() => {
        void openConversationToSpecificMessage({
          conversationKey: conversationId,
          messageIdToNavigateTo: id,
          shouldHighlightMessage: true,
        });
      }}
      className={classNames('module-message-search-result')}
    >
      <AvatarItem source={source || me} />
      <div className="module-message-search-result__text">
        <div className="module-message-search-result__header">
          <From source={source} destination={destination} />
          <div className="module-message-search-result__header__timestamp">
            <Timestamp timestamp={serverTimestamp || timestamp || sent_at || received_at} />
          </div>
        </div>
        <ResultBody>
          <MessageBodyHighlight text={snippet || ''} />
        </ResultBody>
      </div>
    </div>
  );
};
