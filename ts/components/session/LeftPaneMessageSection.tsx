import React from 'react';

import { AutoSizer, List } from 'react-virtualized';

import { MainViewController } from '../MainViewController';
import {
  ConversationListItemWithDetails,
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
import { ToastUtils } from '../../session/utils';

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
    this.closeOverlay = this.closeOverlay.bind(this);
  }

  public componentDidMount() {
    MainViewController.renderMessageView();
    window.Whisper.events.on('calculatingPoW', this.closeOverlay);
  }

  public componentDidUpdate() {
    MainViewController.renderMessageView();
  }

  public componentWillUnmount() {
    this.updateSearch('');
    window.Whisper.events.off('calculatingPoW', this.closeOverlay);
  }

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const { conversations, openConversationInternal } = this.props;

    if (!conversations) {
      throw new Error('renderRow: Tried to render without conversations');
    }

    const conversation = conversations[index];
    const conversationKey = conversation.id;

    return (
      <ConversationListItemWithDetails
        key={key}
        style={style}
        {...conversation}
        onClick={openConversationInternal}
        i18n={window.i18n}
      />
    );
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const {
      conversations,
      openConversationInternal,
      searchResults,
    } = this.props;
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
              autoHeight={false}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public closeOverlay({ pubKey }: { pubKey: string }) {
    if (this.state.valuePasted === pubKey) {
      this.setState({ overlay: false, valuePasted: '' });
    }
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
          placeholder={window.i18n('searchFor...')}
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
          groupMembers: Array<ContactType>
        ) => this.onCreateClosedGroup(groupName, groupMembers)}
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
    const joinOpenGroup = window.i18n('joinOpenGroup');
    const newClosedGroup = window.i18n('newClosedGroup');

    return (
      <div className="left-pane-contact-bottom-buttons">
        <SessionButton
          text={joinOpenGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Green}
          onClick={() => {
            this.handleToggleOverlay(SessionComposeToType.OpenGroup);
          }}
        />
        <SessionButton
          text={newClosedGroup}
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
      ToastUtils.push({
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
      ToastUtils.push({
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

    // Server URL valid?
    if (serverUrl.length === 0 || !OpenGroup.validate(serverUrl)) {
      ToastUtils.push({
        title: window.i18n('invalidOpenGroupUrl'),
        id: 'connectToServer',
        type: 'error',
      });

      return;
    }

    // Already connected?
    if (Boolean(await OpenGroup.getConversation(serverUrl))) {
      ToastUtils.push({
        title: window.i18n('publicChatExists'),
        id: 'publicChatExists',
        type: 'error',
      });

      return;
    }

    // Connect to server
    try {
      ToastUtils.push({
        title: window.i18n('connectingToServer'),
        id: 'connectToServer',
        type: 'success',
      });
      this.setState({ loading: true });
      await OpenGroup.join(serverUrl, async () => {
        if (await OpenGroup.serverExists(serverUrl)) {
          ToastUtils.push({
            title: window.i18n('connectToServerSuccess'),
            id: 'connectToServer',
            type: 'success',
          });
        }
        this.setState({ loading: false });
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
      ToastUtils.push({
        title: window.i18n('connectToServerFail'),
        id: 'connectToServer',
        type: 'error',
      });
      this.setState({ loading: false });
    } finally {
      this.setState({
        loading: false,
      });
      this.handleToggleOverlay(undefined);
    }
  }

  private async onCreateClosedGroup(
    groupName: string,
    groupMembers: Array<ContactType>
  ) {
    await MainViewController.createClosedGroup(groupName, groupMembers, () => {
      this.handleToggleOverlay(undefined);
    });
  }

  private handleNewSessionButtonClick() {
    this.handleToggleOverlay(SessionComposeToType.Message);
  }
}
