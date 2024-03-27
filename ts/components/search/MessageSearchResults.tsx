import styled, { CSSProperties } from 'styled-components';

import { useConversationUsername, useIsPrivate } from '../../hooks/useParamSelector';
import { MessageAttributes } from '../../models/messageType';
import { UserUtils } from '../../session/utils';
import { getOurPubKeyStrFromCache } from '../../session/utils/User';
import { openConversationToSpecificMessage } from '../../state/ducks/conversations';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { MessageBodyHighlight } from '../basic/MessageBodyHighlight';
import { ContactName } from '../conversation/ContactName';
import { Timestamp } from '../conversation/Timestamp';

export type MessageResultProps = MessageAttributes & { snippet: string };

const StyledConversationTitleResults = styled.div`
  flex-grow: 1;
  flex-shrink: 1;
  font-size: 14px;
  line-height: 18px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--conversation-tab-text-color);
  /* We don't want this to overflow horizontally past the timestamp */
  width: 90px;
`;

const StyledConversationFromUserInGroup = styled(StyledConversationTitleResults)`
  display: inline;
  font-size: 12px;
  line-height: 14px;
  overflow-x: hidden;
  font-weight: 700;
  color: var(--conversation-tab-text-color);
`;

const StyledSearchResults = styled.div`
  padding: 8px;
  padding-inline-start: 16px;
  padding-inline-end: 16px;
  min-height: 64px;
  max-width: 300px;

  display: flex;
  flex-direction: row;
  align-items: flex-start;

  cursor: pointer;
  &:hover {
    background-color: var(--conversation-tab-background-hover-color);
  }
`;

const StyledResultText = styled.div`
  flex-grow: 1;
  margin-inline-start: 12px;
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
`;

const ResultsHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledMessageResultsHeaderName = styled.span`
  font-weight: 300;
`;

const FromName = (props: { source: string; conversationId: string }) => {
  const { conversationId, source } = props;

  const isNoteToSelf = conversationId === getOurPubKeyStrFromCache() && source === conversationId;

  if (isNoteToSelf) {
    return (
      <StyledMessageResultsHeaderName>{window.i18n('noteToSelf')}</StyledMessageResultsHeaderName>
    );
  }

  if (source === getOurPubKeyStrFromCache()) {
    return <StyledMessageResultsHeaderName>{window.i18n('you')}</StyledMessageResultsHeaderName>;
  }

  return (
    <ContactName
      pubkey={conversationId}
      module="module-message-search-result__header__name"
      shouldShowPubkey={false}
    />
  );
};

const ConversationHeader = (props: { source: string; conversationId: string }) => {
  const { source, conversationId } = props;

  const ourKey = getOurPubKeyStrFromCache();

  if (conversationId !== ourKey) {
    return (
      <StyledConversationTitleResults>
        <StyledMessageResultsHeaderName>
          <ContactName pubkey={conversationId} shouldShowPubkey={false} boldProfileName={false} />
        </StyledMessageResultsHeaderName>
      </StyledConversationTitleResults>
    );
  }

  return (
    <StyledConversationTitleResults>
      <FromName source={source} conversationId={conversationId} />
    </StyledConversationTitleResults>
  );
};

const FromUserInGroup = (props: { authorPubkey: string; conversationId: string }) => {
  const { authorPubkey, conversationId } = props;

  const ourKey = getOurPubKeyStrFromCache();
  const convoIsPrivate = useIsPrivate(conversationId);
  const authorConvoName = useConversationUsername(authorPubkey);

  if (convoIsPrivate) {
    return null;
  }

  if (authorPubkey === ourKey) {
    return (
      <StyledConversationFromUserInGroup>{window.i18n('you')}: </StyledConversationFromUserInGroup>
    );
  }
  return <StyledConversationFromUserInGroup>{authorConvoName}: </StyledConversationFromUserInGroup>;
};

const AvatarItem = (props: { source: string }) => {
  return <Avatar size={AvatarSize.S} pubkey={props.source} />;
};

const ResultBody = styled.div`
  margin-top: 1px;
  flex-shrink: 1;

  font-size: var(--font-size-sm);

  color: var(--conversation-tab-text-color);

  max-height: 3.6em;

  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`;

const StyledTimestampContaimer = styled.div`
  flex-shrink: 0;
  margin-inline-start: 6px;

  font-size: var(--font-size-xs);
  line-height: 16px;
  letter-spacing: 0.3px;

  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  text-transform: uppercase;

  color: var(--conversation-tab-text-color);
`;

type MessageSearchResultProps = MessageResultProps & { style: CSSProperties };

export const MessageSearchResult = (props: MessageSearchResultProps) => {
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
    style,
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
    <StyledSearchResults
      key={`div-msg-searchresult-${id}`}
      style={style}
      role="button"
      onClick={() => {
        void openConversationToSpecificMessage({
          conversationKey: conversationId,
          messageIdToNavigateTo: id,
          shouldHighlightMessage: true,
        });
      }}
    >
      <AvatarItem source={conversationId} />
      <StyledResultText>
        <ResultsHeader>
          <ConversationHeader source={destination} conversationId={conversationId} />
          <StyledTimestampContaimer>
            <Timestamp
              timestamp={serverTimestamp || timestamp || sent_at || received_at}
              momentFromNow={false}
            />
          </StyledTimestampContaimer>
        </ResultsHeader>
        <ResultBody>
          <FromUserInGroup authorPubkey={source} conversationId={conversationId} />
          <MessageBodyHighlight text={snippet || ''} isGroup={!convoIsPrivate} />
        </ResultBody>
      </StyledResultText>
    </StyledSearchResults>
  );
};
