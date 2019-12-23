import React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from '../ConversationListItem';
import {
  PropsData as SearchResultsProps,
  SearchResults,
} from '../SearchResults';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { SessionSearchInput } from './SessionSearchInput';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionIdEditable } from './SessionIdEditable';
import { UserSearchDropdown } from './UserSearchDropdown';

export interface Props {
  searchTerm: string;
  isSecondaryDevice: boolean;

  conversations?: Array<ConversationListItemPropsType>;

  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
}

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

export class LeftPaneMessageSection extends React.Component<Props, any> {
  private readonly updateSearchBound: (searchedString: string) => void;
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);
    this.state = {
      showComposeView: false,
    };

    this.updateSearchBound = this.updateSearch.bind(this);
    this.handleComposeClick = this.handleComposeClick.bind(this);
    this.handleOnPasteSessionID = this.handleOnPasteSessionID.bind(this);
    this.debouncedSearch = debounce(this.search.bind(this), 20);
  }

  public getCurrentConversations():
    | Array<ConversationListItemPropsType>
    | undefined {
    const { conversations } = this.props;

    let conversationList = conversations;
    if (conversationList !== undefined) {
      conversationList = conversationList.filter(
        conversation => !conversation.isSecondary
      );
    }

    return conversationList;
  }

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const { openConversationInternal } = this.props;

    const conversations = this.getCurrentConversations();

    if (!conversations) {
      throw new Error('renderRow: Tried to render without conversations');
    }

    const conversation = conversations[index];

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...conversation}
        onClick={openConversationInternal}
        i18n={window.i18n}
      />
    );
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const { openConversationInternal, searchResults } = this.props;

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          openConversation={openConversationInternal}
          i18n={window.i18n}
        />
      );
    }

    const conversations = this.getCurrentConversations();

    if (!conversations) {
      throw new Error(
        'render: must provided conversations if no search results are provided'
      );
    }

    // That extra 1 element added to the list is the 'archived conversations' button
    const length = conversations.length;

    // We ensure that the listKey differs between inbox and archive views, which ensures
    //   that AutoSizer properly detects the new size of its slot in the flexbox. The
    //   archive explainer text at the top of the archive view causes problems otherwise.
    //   It also ensures that we scroll to the top when switching views.
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
              autoHeight={true}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public renderHeader(): JSX.Element {
    return (
      <div className="module-left-pane__header">
        <h1 className="module-left-pane__title">
          {window.i18n('messagesHeader')}
        </h1>
        <SessionButton
          text={window.i18n('compose')}
          onClick={this.handleComposeClick}
        />
      </div>
    );
  }

  public render(): JSX.Element {
    return (
      <div className="module-left-pane-session">
        <div className="module-left-pane">
          {this.renderHeader()}
          {this.state.showComposeView
            ? this.renderCompose()
            : this.renderConversations()}
        </div>
      </div>
    );
  }

  public renderCompose(): JSX.Element {
    const { searchResults } = this.props;

    return (
      <div className="module-left-pane-compose">
        <div className="exit">
          <SessionIconButton
            iconSize={SessionIconSize.Small}
            iconType={SessionIconType.Exit}
            onClick={this.handleComposeClick}
          />
        </div>
        <h2>{window.i18n('enterRecipient')}</h2>
        <h3>{window.i18n('enterSessionID')}</h3>
        <div className="module-left-pane-compose-border-container">
          <hr className="white" />
          <hr className="green" />
        </div>
        <SessionIdEditable
          editable={true}
          placeholder={window.i18n('pasteSessionIDRecipient')}
          onChange={this.handleOnPasteSessionID}
        />

        <div className="session-description-long">
          {window.i18n('usersCanShareTheir...')}
        </div>
        <h4>{window.i18n('or')}</h4>

        <UserSearchDropdown
          searchTerm={this.props.searchTerm}
          updateSearch={this.updateSearchBound}
          placeholder={window.i18n('searchByIDOrDisplayName')}
          searchResults={searchResults}
        />
        <SessionButton
          buttonColor={SessionButtonColor.Green}
          buttonType={SessionButtonType.BrandOutline}
          text={window.i18n('message')}
        />
      </div>
    );
  }

  public renderConversations() {
    return (
      <div>
        <SessionSearchInput
          searchString={this.props.searchTerm}
          onChange={this.updateSearchBound}
          placeholder={window.i18n('searchForAKeyPhrase')}
        />
        {this.renderList()}
      </div>
    );
  }

  public updateSearch(searchTerm: string) {
    const { updateSearchTerm, clearSearch } = this.props;

    if (!searchTerm) {
      clearSearch();

      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }

    if (searchTerm.length < 2) {
      return;
    }

    const cleanedTerm = cleanSearchTerm(searchTerm);
    if (!cleanedTerm) {
      return;
    }

    this.debouncedSearch(cleanedTerm);
  }

  public clearSearch() {
    const { clearSearch } = this.props;

    clearSearch();
    //this.setFocus();
  }

  public search() {
    const { search } = this.props;
    const { searchTerm, isSecondaryDevice } = this.props;

    if (search) {
      search(searchTerm, {
        noteToSelf: window.i18n('noteToSelf').toLowerCase(),
        ourNumber: window.textsecure.storage.user.getNumber(),
        regionCode: '',
        isSecondaryDevice,
      });
    }
  }

  private handleComposeClick() {
    this.setState((state: any) => {
      return { showComposeView: !state.showComposeView };
    });
    // empty our generalized searchedString (one for the whole app)
    this.updateSearch('');
  }

  private handleOnPasteSessionID() {
    console.log('handleOnPasteSessionID');
  }
}
