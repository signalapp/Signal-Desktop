import React from 'react';

import { AutoSizer, List } from 'react-virtualized';

import { MainViewController } from '../MainViewController';
import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from '../ConversationListItem';
import { ConversationType } from '../../state/ducks/conversations';
import {
  PropsData as SearchResultsProps,
  SearchResults,
} from '../SearchResults';
import { SessionSearchInput } from './SessionSearchInput';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { validateNumber } from '../../types/PhoneNumber';
import { LeftPane, RowRendererParamsType } from '../LeftPane';
import {
  SessionClosableOverlay,
  SessionClosableOverlayType,
} from './SessionClosableOverlay';
import { SessionIconType } from './icon';
import { ContactType } from './SessionMemberListItem';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { OpenGroup } from '../../session/types';

export interface Props {
  searchTerm: string;
  isSecondaryDevice: boolean;

  contacts: Array<ConversationType>;
  conversations?: Array<ConversationListItemPropsType>;
  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
}

export enum SessionComposeToType {
  Message = 'message',
  OpenGroup = 'open-group',
  ClosedGroup = 'closed-group',
}

export const SessionGroupType = {
  OpenGroup: SessionComposeToType.OpenGroup,
  ClosedGroup: SessionComposeToType.ClosedGroup,
};
export type SessionGroupType = SessionComposeToType;

interface State {
  loading: boolean;
  overlay: false | SessionComposeToType;
  valuePasted: string;
}

export class LeftPaneMessageSection extends React.Component<Props, State> {
  private readonly updateSearchBound: (searchedString: string) => void;
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);

    this.state = {
      loading: false,
      overlay: false,
      valuePasted: '',
    };

    const conversations = this.getCurrentConversations();

    const realConversations: Array<ConversationListItemPropsType> = [];
    if (conversations) {
      conversations.forEach(conversation => {
        const isRSS =
          conversation.id &&
          !!(conversation.id && conversation.id.match(/^rss:/));

        return !isRSS && realConversations.push(conversation);
      });
    }

    this.updateSearchBound = this.updateSearch.bind(this);

    this.handleOnPaste = this.handleOnPaste.bind(this);
    this.handleToggleOverlay = this.handleToggleOverlay.bind(this);
    this.handleMessageButtonClick = this.handleMessageButtonClick.bind(this);

    this.handleNewSessionButtonClick = this.handleNewSessionButtonClick.bind(
      this
    );
    this.handleJoinChannelButtonClick = this.handleJoinChannelButtonClick.bind(
      this
    );
    this.onCreateClosedGroup = this.onCreateClosedGroup.bind(this);

    this.renderClosableOverlay = this.renderClosableOverlay.bind(this);
    this.debouncedSearch = debounce(this.search.bind(this), 20);
  }

  public componentWillUnmount() {
    this.updateSearch('');
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
    const contacts = searchResults?.contacts || [];

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          contacts={contacts}
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
              autoHeight={true}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public componentDidMount() {
    MainViewController.renderMessageView();
  }

  public componentDidUpdate() {
    MainViewController.renderMessageView();
  }

  public renderHeader(): JSX.Element {
    const labels = [window.i18n('messagesHeader')];

    return LeftPane.RENDER_HEADER(
      labels,
      null,
      undefined,
      SessionIconType.Plus,
      this.handleNewSessionButtonClick
    );
  }

  public render(): JSX.Element {
    const { overlay } = this.state;

    return (
      <div className="session-left-pane-section-content">
        {this.renderHeader()}
        {overlay
          ? this.renderClosableOverlay(overlay)
          : this.renderConversations()}
      </div>
    );
  }

  public renderConversations() {
    return (
      <div className="module-conversations-list-content">
        <SessionSearchInput
          searchString={this.props.searchTerm}
          onChange={this.updateSearchBound}
          placeholder={window.i18n('searchForAKeyPhrase')}
        />
        {this.renderList()}
        {this.renderBottomButtons()}
      </div>
    );
  }

  public updateSearch(searchTerm: string) {
    const { updateSearchTerm, clearSearch } = this.props;

    if (!searchTerm) {
      clearSearch();

      return;
    }

    // reset our pubKeyPasted, we can either have a pasted sessionID or a sessionID got from a search
    this.setState({ valuePasted: '' });

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
    this.props.clearSearch();
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

  private renderClosableOverlay(overlay: SessionComposeToType) {
    const { searchTerm, searchResults } = this.props;
    const { loading } = this.state;

    const openGroupElement = (
      <SessionClosableOverlay
        overlayMode={SessionClosableOverlayType.OpenGroup}
        onChangeSessionID={this.handleOnPaste}
        onCloseClick={() => {
          this.handleToggleOverlay(undefined);
        }}
        onButtonClick={this.handleJoinChannelButtonClick}
        searchTerm={searchTerm}
        updateSearch={this.updateSearchBound}
        showSpinner={loading}
      />
    );

    const closedGroupElement = (
      <SessionClosableOverlay
        contacts={this.props.contacts}
        overlayMode={SessionClosableOverlayType.ClosedGroup}
        onChangeSessionID={this.handleOnPaste}
        onCloseClick={() => {
          this.handleToggleOverlay(undefined);
        }}
        onButtonClick={async (
          groupName: string,
          groupMembers: Array<ContactType>,
          senderKeys: boolean
        ) => this.onCreateClosedGroup(groupName, groupMembers, senderKeys)}
        searchTerm={searchTerm}
        updateSearch={this.updateSearchBound}
        showSpinner={loading}
      />
    );

    const messageElement = (
      <SessionClosableOverlay
        overlayMode={SessionClosableOverlayType.Message}
        onChangeSessionID={this.handleOnPaste}
        onCloseClick={() => {
          this.handleToggleOverlay(undefined);
        }}
        onButtonClick={this.handleMessageButtonClick}
        searchTerm={searchTerm}
        searchResults={searchResults}
        updateSearch={this.updateSearchBound}
      />
    );

    let overlayElement;
    switch (overlay) {
      case SessionComposeToType.OpenGroup:
        overlayElement = openGroupElement;
        break;
      case SessionComposeToType.ClosedGroup:
        overlayElement = closedGroupElement;
        break;
      default:
        overlayElement = messageElement;
    }

    return overlayElement;
  }

  private renderBottomButtons(): JSX.Element {
    const edit = window.i18n('edit');
    const joinOpenGroup = window.i18n('joinOpenGroup');
    const createClosedGroup = window.i18n('createClosedGroup');
    const showEditButton = false;

    return (
      <div className="left-pane-contact-bottom-buttons">
        {showEditButton && (
          <SessionButton
            text={edit}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.White}
          />
        )}

        <SessionButton
          text={joinOpenGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Green}
          onClick={() => {
            this.handleToggleOverlay(SessionComposeToType.OpenGroup);
          }}
        />
        <SessionButton
          text={createClosedGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
          onClick={() => {
            this.handleToggleOverlay(SessionComposeToType.ClosedGroup);
          }}
        />
      </div>
    );
  }

  private handleToggleOverlay(conversationType?: SessionComposeToType) {
    const { overlay } = this.state;

    const overlayState = overlay ? false : conversationType || false;

    this.setState({ overlay: overlayState });

    // empty our generalized searchedString (one for the whole app)
    this.updateSearch('');
  }

  private handleOnPaste(value: string) {
    this.setState({ valuePasted: value });
  }

  private handleMessageButtonClick() {
    const { openConversationInternal } = this.props;

    if (!this.state.valuePasted && !this.props.searchTerm) {
      window.pushToast({
        title: window.i18n('invalidNumberError'),
        type: 'error',
        id: 'invalidPubKey',
      });

      return;
    }
    let pubkey: string;
    pubkey = this.state.valuePasted || this.props.searchTerm;
    pubkey = pubkey.trim();

    const error = validateNumber(pubkey);
    if (!error) {
      openConversationInternal(pubkey);
    } else {
      window.pushToast({
        title: error,
        type: 'error',
        id: 'invalidPubKey',
      });
    }
  }

  private async handleJoinChannelButtonClick(serverUrl: string) {
    const { loading } = this.state;

    if (loading) {
      return;
    }

    // Server URL entered?
    if (serverUrl.length === 0) {
      return;
    }

    // Server URL valid?
    if (!OpenGroup.validate(serverUrl)) {
      window.pushToast({
        title: window.i18n('noServerURL'),
        id: 'connectToServer',
        type: 'error',
      });

      return;
    }

    // Already connected?
    if (Boolean(await OpenGroup.getConversation(serverUrl))) {
      window.pushToast({
        title: window.i18n('publicChatExists'),
        id: 'publicChatExists',
        type: 'error',
      });

      return;
    }

    // Connect to server
    try {
      await OpenGroup.join(serverUrl, async () => {
        if (await OpenGroup.serverExists(serverUrl)) {
          window.pushToast({
            title: window.i18n('connectingToServer'),
            id: 'connectToServer',
            type: 'success',
          });

          this.setState({ loading: true });
        }
      });
      const openGroupConversation = await OpenGroup.getConversation(serverUrl);

      if (openGroupConversation) {
        // if no errors happened, trigger a sync with just this open group
        // so our other devices joins it
        await window.textsecure.messaging.sendOpenGroupsSyncMessage(
          openGroupConversation
        );
      } else {
        window.console.error(
          'Joined an opengroup but did not find ther corresponding conversation'
        );
      }
    } catch (e) {
      window.console.error('Failed to connect to server:', e);
      window.pushToast({
        title: window.i18n('connectToServerFail'),
        id: 'connectToServer',
        type: 'error',
      });
    } finally {
      this.setState({
        loading: false,
      });
      this.handleToggleOverlay(undefined);
    }
  }

  private async onCreateClosedGroup(
    groupName: string,
    groupMembers: Array<ContactType>,
    senderKeys: boolean
  ) {
    await MainViewController.createClosedGroup(
      groupName,
      groupMembers,
      senderKeys,
      () => {
        this.handleToggleOverlay(undefined);

        window.pushToast({
          title: window.i18n('closedGroupCreatedToastTitle'),
          type: 'success',
        });
      }
    );
  }

  private handleNewSessionButtonClick() {
    this.handleToggleOverlay(SessionComposeToType.Message);
  }
}
