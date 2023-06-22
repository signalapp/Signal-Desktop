import autoBind from 'auto-bind';
import React from 'react';
import { AutoSizer, List, ListRowProps } from 'react-virtualized';
import { SearchResults, SearchResultsProps } from '../search/SearchResults';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { MessageRequestsBanner } from './MessageRequestsBanner';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from './conversation-list-item/ConversationListItem';

import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { OverlayMode, setOverlayMode } from '../../state/ducks/section';
import { getOverlayMode } from '../../state/selectors/section';
import { SessionSearchInput } from '../SessionSearchInput';
import { StyledLeftPaneList } from './LeftPaneList';
import { OverlayClosedGroup } from './overlay/OverlayClosedGroup';
import { OverlayCommunity } from './overlay/OverlayCommunity';
import { OverlayMessage } from './overlay/OverlayMessage';
import { OverlayMessageRequest } from './overlay/OverlayMessageRequest';
import { OverlayChooseAction } from './overlay/choose-action/OverlayChooseAction';

export interface Props {
  conversations?: Array<ConversationListItemProps>;
  searchResults?: SearchResultsProps;
  overlayMode: OverlayMode | undefined;
}

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
  const overlayMode = useSelector(getOverlayMode);

  switch (overlayMode) {
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
    default:
      return null;
  }
};

export class LeftPaneMessageSection extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    autoBind(this);
  }

  public renderRow = ({ index, key, style }: ListRowProps): JSX.Element | null => {
    const { conversations } = this.props;

    //assume conversations that have been marked unapproved should be filtered out by selector.
    if (!conversations) {
      throw new Error('renderRow: Tried to render without conversations');
    }

    const conversation = conversations[index];
    if (!conversation) {
      throw new Error('renderRow: conversations selector returned element containing falsy value.');
    }

    return <MemoConversationListItemWithDetails key={key} style={style} id={conversation.id} />; // TODO there should not be a need for the ...conversation here?
  };

  public renderList(): JSX.Element {
    const { conversations, searchResults } = this.props;

    if (searchResults) {
      return <SearchResults {...searchResults} />;
    }

    if (!conversations) {
      throw new Error('render: must provided conversations if no search results are provided');
    }

    const length = conversations.length;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversations data changes. Otherwise it would just render
    //   on startup and scroll.
    // TODO do need that `conversations` prop? I again don't see why it is needed. Especially because the list item use hook to fetch their details.
    return (
      <StyledLeftPaneList key={0}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
              autoHeight={false}
            />
          )}
        </AutoSizer>
      </StyledLeftPaneList>
    );
  }

  public render(): JSX.Element {
    const { overlayMode } = this.props;

    return (
      <StyledLeftPaneContent>
        <LeftPaneSectionHeader />
        {overlayMode ? <ClosableOverlay /> : this.renderConversations()}
      </StyledLeftPaneContent>
    );
  }

  public renderConversations() {
    return (
      <StyledConversationListContent>
        <SessionSearchInput />
        <MessageRequestsBanner
          handleOnClick={() => {
            window.inboxStore?.dispatch(setOverlayMode('message-requests'));
          }}
        />
        {this.renderList()}
      </StyledConversationListContent>
    );
  }
}
