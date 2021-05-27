import React from 'react';

import { AutoSizer, List } from 'react-virtualized';

import { MainViewController } from '../MainViewController';
import {
  ConversationListItemProps,
  ConversationListItemWithDetails,
} from '../ConversationListItem';
import { ConversationType as ReduxConversationType } from '../../state/ducks/conversations';
import { SearchResults, SearchResultsProps } from '../SearchResults';
import { SessionSearchInput } from './SessionSearchInput';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { RowRendererParamsType } from '../LeftPane';
import { SessionClosableOverlay, SessionClosableOverlayType } from './SessionClosableOverlay';
import { SessionIconType } from './icon';
import { ContactType } from './SessionMemberListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from './SessionButton';
import { PubKey } from '../../session/types';
import { ToastUtils, UserUtils } from '../../session/utils';
import { DefaultTheme } from 'styled-components';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { ConversationController } from '../../session/conversations';
import { OpenGroup } from '../../opengroup/opengroupV1/OpenGroup';
import { ConversationTypeEnum } from '../../models/conversation';
import { openGroupV2CompleteURLRegex } from '../../opengroup/utils/OpenGroupUtils';
import { joinOpenGroupV2WithUIEvents } from '../../opengroup/opengroupV2/JoinOpenGroupV2';
import autoBind from 'auto-bind';

export interface Props {
  searchTerm: string;

  contacts: Array<ReduxConversationType>;
  conversations?: Array<ConversationListItemProps>;
  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationExternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
  theme: DefaultTheme;
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
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);

    this.state = {
      loading: false,
      overlay: false,
      valuePasted: '',
    };

    autoBind(this);
    this.debouncedSearch = debounce(this.search.bind(this), 20);
  }

  public renderRow = ({ index, key, style }: RowRendererParamsType): JSX.Element => {
    const { conversations, openConversationExternal } = this.props;

    if (!conversations) {
      throw new Error('renderRow: Tried to render without conversations');
    }

    const conversation = conversations[index];

    return (
      <ConversationListItemWithDetails
        key={key}
        style={style}
        {...conversation}
        onClick={openConversationExternal}
        i18n={window.i18n}
      />
    );
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const { conversations, openConversationExternal, searchResults } = this.props;
    const contacts = searchResults?.contacts || [];

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          contacts={contacts}
          openConversationExternal={openConversationExternal}
          i18n={window.i18n}
        />
      );
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

  public closeOverlay({ pubKey }: { pubKey: string }) {
    if (this.state.valuePasted === pubKey) {
      this.setState({ overlay: false, valuePasted: '' });
    }
  }

  public renderHeader(): JSX.Element {
    return (
      <LeftPaneSectionHeader
        label={window.i18n('messagesHeader')}
        theme={this.props.theme}
        buttonIcon={SessionIconType.Plus}
        buttonClicked={this.handleNewSessionButtonClick}
      />
    );
  }

  public render(): JSX.Element {
    const { overlay } = this.state;

    return (
      <div className="session-left-pane-section-content">
        {this.renderHeader()}
        {overlay ? this.renderClosableOverlay(overlay) : this.renderConversations()}
      </div>
    );
  }

  public renderConversations() {
    return (
      <div className="module-conversations-list-content">
        <SessionSearchInput
          searchString={this.props.searchTerm}
          onChange={this.updateSearch}
          placeholder={window.i18n('searchFor...')}
          theme={this.props.theme}
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
    const { searchTerm } = this.props;

    if (search) {
      search(searchTerm, {
        noteToSelf: window.i18n('noteToSelf').toLowerCase(),
        ourNumber: UserUtils.getOurPubKeyStrFromCache(),
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
        updateSearch={this.updateSearch}
        showSpinner={loading}
        theme={this.props.theme}
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
        onButtonClick={async (groupName: string, groupMembers: Array<ContactType>) =>
          this.onCreateClosedGroup(groupName, groupMembers)
        }
        searchTerm={searchTerm}
        updateSearch={this.updateSearch}
        showSpinner={loading}
        theme={this.props.theme}
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
        updateSearch={this.updateSearch}
        theme={this.props.theme}
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
    const overlayState = conversationType || false;

    this.setState({ overlay: overlayState });

    // empty our generalized searchedString (one for the whole app)
    this.updateSearch('');
  }

  private handleOnPaste(value: string) {
    this.setState({ valuePasted: value });
  }

  private async handleMessageButtonClick() {
    const { openConversationExternal } = this.props;

    if (!this.state.valuePasted && !this.props.searchTerm) {
      ToastUtils.pushToastError('invalidPubKey', window.i18n('invalidNumberError'));
      return;
    }
    let pubkey: string;
    pubkey = this.state.valuePasted || this.props.searchTerm;
    pubkey = pubkey.trim();

    const error = PubKey.validateWithError(pubkey);
    if (!error) {
      await ConversationController.getInstance().getOrCreateAndWait(
        pubkey,
        ConversationTypeEnum.PRIVATE
      );
      openConversationExternal(pubkey);
      this.handleToggleOverlay(undefined);
    } else {
      ToastUtils.pushToastError('invalidPubKey', error);
    }
  }

  private async handleOpenGroupJoinV1(serverUrlV1: string) {
    // Server URL valid?
    if (serverUrlV1.length === 0 || !OpenGroup.validate(serverUrlV1)) {
      ToastUtils.pushToastError('connectToServer', window.i18n('invalidOpenGroupUrl'));
      return;
    }

    // Already connected?
    if (OpenGroup.getConversation(serverUrlV1)) {
      ToastUtils.pushToastError('publicChatExists', window.i18n('publicChatExists'));
      return;
    }
    // Connect to server
    try {
      ToastUtils.pushToastInfo('connectingToServer', window.i18n('connectingToServer'));

      this.setState({ loading: true });
      await OpenGroup.join(serverUrlV1);
      if (await OpenGroup.serverExists(serverUrlV1)) {
        ToastUtils.pushToastSuccess(
          'connectToServerSuccess',
          window.i18n('connectToServerSuccess')
        );
      } else {
        throw new Error('Open group joined but the corresponding server does not exist');
      }
      this.setState({ loading: false });
      const openGroupConversation = OpenGroup.getConversation(serverUrlV1);

      if (!openGroupConversation) {
        window?.log?.error('Joined an opengroup but did not find ther corresponding conversation');
      }
      this.handleToggleOverlay(undefined);
    } catch (e) {
      window?.log?.error('Failed to connect to server:', e);
      ToastUtils.pushToastError('connectToServerFail', window.i18n('connectToServerFail'));
      this.setState({ loading: false });
    }
  }

  private async handleOpenGroupJoinV2(serverUrlV2: string) {
    const loadingCallback = (loading: boolean) => {
      this.setState({ loading });
    };
    const joinSuccess = await joinOpenGroupV2WithUIEvents(serverUrlV2, true, loadingCallback);

    return joinSuccess;
  }

  private async handleJoinChannelButtonClick(serverUrl: string) {
    const { loading } = this.state;

    if (loading) {
      return;
    }

    // guess if this is an open
    if (serverUrl.match(openGroupV2CompleteURLRegex)) {
      const groupCreated = await this.handleOpenGroupJoinV2(serverUrl);
      if (groupCreated) {
        this.handleToggleOverlay(undefined);
      }
    } else {
      // this is an open group v1
      await this.handleOpenGroupJoinV1(serverUrl);
    }
  }

  private async onCreateClosedGroup(groupName: string, groupMembers: Array<ContactType>) {
    if (this.state.loading) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }
    this.setState({ loading: true }, async () => {
      const groupCreated = await MainViewController.createClosedGroup(groupName, groupMembers);

      if (groupCreated) {
        this.handleToggleOverlay(undefined);
      }
      this.setState({ loading: false });
    });
  }

  private handleNewSessionButtonClick() {
    this.handleToggleOverlay(SessionComposeToType.Message);
  }
}
