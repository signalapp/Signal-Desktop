import React from 'react';
import { AutoSizer, List } from 'react-virtualized';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from './conversation-list-item/ConversationListItem';
import { ReduxConversationType } from '../../state/ducks/conversations';
import { SearchResults, SearchResultsProps } from '../search/SearchResults';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import autoBind from 'auto-bind';
import _ from 'lodash';
import { MessageRequestsBanner } from './MessageRequestsBanner';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSearchInput } from '../SessionSearchInput';
import { RowRendererParamsType } from './LeftPane';
import { OverlayOpenGroup } from './overlay/OverlayOpenGroup';
import { OverlayMessageRequest } from './overlay/OverlayMessageRequest';
import { OverlayMessage } from './overlay/OverlayMessage';
import { OverlayClosedGroup } from './overlay/OverlayClosedGroup';
import { OverlayMode, setOverlayMode } from '../../state/ducks/section';

export interface Props {
  contacts: Array<ReduxConversationType>;
  conversations?: Array<ConversationListItemProps>;
  searchResults?: SearchResultsProps;

  messageRequestsEnabled?: boolean;
  overlayMode: OverlayMode;
}

export class LeftPaneMessageSection extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);

    autoBind(this);
  }

  public renderRow = ({ index, key, style }: RowRendererParamsType): JSX.Element | null => {
    const { conversations } = this.props;

    //assume conversations that have been marked unapproved should be filtered out by selector.
    if (!conversations) {
      throw new Error('renderRow: Tried to render without conversations');
    }

    const conversation = conversations[index];
    if (!conversation) {
      throw new Error('renderRow: conversations selector returned element containing falsy value.');
    }

    return <MemoConversationListItemWithDetails key={key} style={style} {...conversation} />;
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const { conversations, searchResults } = this.props;

    if (searchResults) {
      return <SearchResults {...searchResults} />;
    }

    if (!conversations) {
      throw new Error('render: must provided conversations if no search results are provided');
    }

    const length = conversations.length;

    const listKey = 0;
    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    const list = (
      <div className="module-left-pane__list" key={listKey}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              conversations={conversations}
              height={height}
              rowCount={length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
              autoHeight={false}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public render(): JSX.Element {
    const { overlayMode } = this.props;

    return (
      <div className="session-left-pane-section-content">
        <LeftPaneSectionHeader
          buttonClicked={() => {
            window.inboxStore?.dispatch(setOverlayMode('message'));
          }}
        />
        {overlayMode ? this.renderClosableOverlay() : this.renderConversations()}
      </div>
    );
  }

  public renderConversations() {
    return (
      <div className="module-conversations-list-content">
        <SessionSearchInput />
        <MessageRequestsBanner
          handleOnClick={() => {
            window.inboxStore?.dispatch(setOverlayMode('message-requests'));
          }}
        />
        {this.renderList()}
        {this.renderBottomButtons()}
      </div>
    );
  }

  private renderClosableOverlay() {
    const { overlayMode } = this.props;

    switch (overlayMode) {
      case 'open-group':
        return <OverlayOpenGroup />;
      case 'closed-group':
        return <OverlayClosedGroup />;

      case 'message':
        return <OverlayMessage />;
      case 'message-requests':
        return <OverlayMessageRequest />;
      default:
        return null;
    }
  }

  private renderBottomButtons(): JSX.Element {
    const joinOpenGroup = window.i18n('joinOpenGroup');
    const newClosedGroup = window.i18n('newClosedGroup');

    return (
      <div className="left-pane-contact-bottom-buttons">
        <SessionButton
          text={joinOpenGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Green}
          onClick={() => {
            window.inboxStore?.dispatch(setOverlayMode('open-group'));
          }}
        />
        <SessionButton
          text={newClosedGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
          onClick={() => {
            window.inboxStore?.dispatch(setOverlayMode('closed-group'));
          }}
        />
      </div>
    );
  }
}
