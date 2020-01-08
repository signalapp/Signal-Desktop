import React from 'react';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from '../ConversationListItem';
import { PropsData as SearchResultsProps } from '../SearchResults';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { LeftPane, RowRendererParamsType } from '../LeftPane';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { AutoSizer, List } from 'react-virtualized';
import { validateNumber } from '../../types/PhoneNumber';
import { ActionsPanel } from './ActionsPanel';
import { ConversationType } from '../../state/ducks/conversations';

export interface Props {
  searchTerm: string;
  isSecondaryDevice: boolean;

  conversations: Array<ConversationListItemPropsType>;
  friends: Array<ConversationType>;

  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
}

export class LeftPaneContactSection extends React.Component<Props, any> {
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);
    this.state = {
      showAddContactView: false,
      selectedTab: 0,
      addContactRecipientID: '',
    };

    this.debouncedSearch = debounce(this.search.bind(this), 20);
    this.handleTabSelected = this.handleTabSelected.bind(this);
    this.handleToggleOverlay = this.handleToggleOverlay.bind(this);
    this.handleOnAddContact = this.handleOnAddContact.bind(this);
    this.handleRecipientSessionIDChanged = this.handleRecipientSessionIDChanged.bind(
      this
    );
  }

  public componentWillUnmount() {
    this.updateSearch('');
    this.setState({ addContactRecipientID: '' });
  }

  public handleTabSelected(tabType: number) {
    this.setState({ selectedTab: tabType, showAddContactView: false });
  }

  public renderHeader(): JSX.Element | undefined {
    const labels = [window.i18n('contactsHeader'), window.i18n('lists')];
    const friendRequestCount = ActionsPanel.GET_FRIEND_REQUESTS_COUNT(
      this.props.conversations
    );

    return LeftPane.RENDER_HEADER(
      labels,
      this.handleTabSelected,
      undefined,
      undefined,
      friendRequestCount
    );
  }

  public render(): JSX.Element {
    return (
      <div className="left-pane-contact-section">
        {this.renderHeader()}
        {this.state.showAddContactView
          ? LeftPane.RENDER_CLOSABLE_OVERLAY(
              true,
              this.handleRecipientSessionIDChanged,
              this.handleToggleOverlay,
              this.handleOnAddContact,
              ''
            )
          : this.renderContacts()}
      </div>
    );
  }

  public getCurrentFriends(): Array<ConversationType> {
    const { friends } = this.props;

    let friendList = friends;
    if (friendList !== undefined) {
      friendList = friendList.filter(
        friend => friend.type === 'direct' && !friend.isMe
      );
    }

    return friendList;
  }

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element | undefined => {
    const receivedFriendsRequest = this.getFriendRequests(true);
    const sentFriendsRequest = this.getFriendRequests(false);
    const friends = this.getCurrentFriends();

    const combined = [
      ...receivedFriendsRequest,
      ...sentFriendsRequest,
      ...friends,
    ];

    const item = combined[index];
    let onClick;
    if (index >= receivedFriendsRequest.length) {
      onClick = this.props.openConversationInternal;
    }

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...item}
        i18n={window.i18n}
        onClick={onClick}
      />
    );
  };

  public updateSearch(searchTerm: string) {
    const { updateSearchTerm, clearSearch } = this.props;

    if (!searchTerm) {
      clearSearch();

      return;
    }
    
    this.setState({ pubKeyPasted: '' }, () => {
      window.Session.emptyContentEditableDivs();
    });

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

  private handleToggleOverlay() {
    this.setState((prevState: { showAddContactView: any }) => ({
      showAddContactView: !prevState.showAddContactView,
    }));
  }

  private handleOnAddContact() {
    const sessionID = this.state.addContactRecipientID;
    const error = validateNumber(sessionID, window.i18n);

    if (error) {
      window.pushToast({
        title: error,
        type: 'error',
        id: 'addContact',
      });
    } else {
      window.Whisper.events.trigger('showConversation', sessionID);
    }
  }

  private handleRecipientSessionIDChanged(event: any) {
    if (event.target.innerHTML) {
      // remove br elements or div elements
      const cleanText = event.target.innerHTML.replace(/<\/?[^>]+(>|$)/g, '');
      this.setState({ addContactRecipientID: cleanText });
    }
  }

  private renderContacts() {
    return (
      <div className="left-pane-contact-content">
        {this.renderList()}
        {this.renderBottomButtons()}
      </div>
    );
  }

  private renderBottomButtons(): JSX.Element {
    const { selectedTab } = this.state;
    const edit = window.i18n('edit');
    const addContact = window.i18n('addContact');
    const createGroup = window.i18n('createGroup');

    return (
      <div className="left-pane-contact-bottom-buttons">
        <SessionButton
          text={edit}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
        />
        {selectedTab === 0 ? (
          <SessionButton
            text={addContact}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.Green}
            onClick={this.handleToggleOverlay}
          />
        ) : (
          <SessionButton
            text={createGroup}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.Green}
            onClick={this.handleToggleOverlay}
          />
        )}
      </div>
    );
  }

  // true: received only, false: sent only
  private getFriendRequests(
    received: boolean
  ): Array<ConversationListItemPropsType> {
    const { conversations } = this.props;

    let conversationsList = conversations;
    if (conversationsList !== undefined) {
      if (received) {
        conversationsList = conversationsList.filter(
          conversation => conversation.hasReceivedFriendRequest
        );
      } else {
        conversationsList = conversationsList.filter(
          conversation => conversation.hasSentFriendRequest
        );
      }
    }

    return conversationsList;
  }

  private renderList() {
    const receivedFriendsRequest = this.getFriendRequests(true);
    const sentFriendsRequest = this.getFriendRequests(false);
    const friends = this.getCurrentFriends();

    const combined = [
      ...receivedFriendsRequest,
      ...sentFriendsRequest,
      ...friends,
    ];

    const length = combined.length;

    const list = (
      <div className="module-left-pane__list" key={0}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
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
}
