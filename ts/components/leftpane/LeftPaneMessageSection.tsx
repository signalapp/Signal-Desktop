import { isEmpty } from 'lodash';
import { useSelector } from 'react-redux';
import { AutoSizer, List, ListRowProps } from 'react-virtualized';
import styled from 'styled-components';
import { SearchResults } from '../search/SearchResults';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { MessageRequestsBanner } from './MessageRequestsBanner';

import { setLeftOverlayMode } from '../../state/ducks/section';
import { getLeftPaneConversationIds } from '../../state/selectors/conversations';
import { getSearchTerm } from '../../state/selectors/search';
import { getLeftOverlayMode } from '../../state/selectors/section';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { SessionSearchInput } from '../SessionSearchInput';
import { StyledLeftPaneList } from './LeftPaneList';
import { ConversationListItem } from './conversation-list-item/ConversationListItem';
import { OverlayClosedGroup } from './overlay/OverlayClosedGroup';
import { OverlayCommunity } from './overlay/OverlayCommunity';
import { OverlayInvite } from './overlay/OverlayInvite';
import { OverlayMessage } from './overlay/OverlayMessage';
import { OverlayMessageRequest } from './overlay/OverlayMessageRequest';
import { OverlayChooseAction } from './overlay/choose-action/OverlayChooseAction';

const StyledLeftPaneContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

const StyledConversationListContent = styled.div`
  background: var(--background-primary-color);
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  transition: none;
`;

const ClosableOverlay = () => {
  const leftOverlayMode = useSelector(getLeftOverlayMode);

  switch (leftOverlayMode) {
    case 'choose-action':
      return <OverlayChooseAction />;
    case 'open-group':
      return <OverlayCommunity />;
    case 'closed-group':
      return <OverlayClosedGroup />;
    case 'message':
      return <OverlayMessage />;
    case 'message-requests':
      return <OverlayMessageRequest />;
    case 'invite-a-friend':
      return <OverlayInvite />;
    case undefined:
      return null;
    default:
      return assertUnreachable(
        leftOverlayMode,
        `ClosableOverlay: leftOverlayMode case not handled "${leftOverlayMode}"`
      );
  }
};

const ConversationRow = (
  { index, key, style }: ListRowProps,
  conversationIds: Array<string>
): JSX.Element | null => {
  // assume conversations that have been marked unapproved should be filtered out by selector.
  if (!conversationIds) {
    throw new Error('ConversationRow: Tried to render without conversations');
  }

  const conversationId = conversationIds[index];
  if (!conversationId) {
    throw new Error(
      'ConversationRow: conversations selector returned element containing falsy value.'
    );
  }

  return <ConversationListItem key={key} style={style} conversationId={conversationId} />;
};

const ConversationList = () => {
  const searchTerm = useSelector(getSearchTerm);
  const conversationIds = useSelector(getLeftPaneConversationIds);

  if (!isEmpty(searchTerm)) {
    return <SearchResults />;
  }

  if (!conversationIds) {
    throw new Error(
      'ConversationList: must provided conversations if no search results are provided'
    );
  }

  return (
    <StyledLeftPaneList key={`conversation-list-0`}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            className="module-left-pane__virtual-list"
            height={height}
            rowCount={conversationIds.length}
            rowHeight={64}
            rowRenderer={props => ConversationRow(props, conversationIds)}
            width={width}
            autoHeight={false}
            conversationIds={conversationIds}
          />
        )}
      </AutoSizer>
    </StyledLeftPaneList>
  );
};

export const LeftPaneMessageSection = () => {
  const leftOverlayMode = useSelector(getLeftOverlayMode);

  return (
    <StyledLeftPaneContent>
      <LeftPaneSectionHeader />
      {leftOverlayMode ? (
        <ClosableOverlay />
      ) : (
        <StyledConversationListContent>
          <SessionSearchInput />
          <MessageRequestsBanner
            handleOnClick={() => {
              window.inboxStore?.dispatch(setLeftOverlayMode('message-requests'));
            }}
          />
          <ConversationList />
        </StyledConversationListContent>
      )}
    </StyledLeftPaneContent>
  );
};
