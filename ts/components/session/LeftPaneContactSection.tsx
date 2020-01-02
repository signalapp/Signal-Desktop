import React from 'react';

import {
  PropsData as ConversationListItemPropsType,
  ConversationListItem,
} from '../ConversationListItem';
import { PropsData as SearchResultsProps } from '../SearchResults';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { LeftPane, RowRendererParamsType } from '../LeftPane';
import {
  SessionButton,
  SessionButtonType,
  SessionButtonColor,
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
    const friendRequestCount = ActionsPanel.getFriendRequestsCount(this.props.conversations);

    return LeftPane.renderHeader(
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
          ? LeftPane.renderClosableOverlay(
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

  public getCurrentFriends():
    | Array<ConversationType> {
    const { friends } = this.props;

    let friendList = friends;
    console.log('friends:', friendList);
    if (friendList !== undefined) {
      friendList = friendList.filter(
        friend =>
        friend.type ==='direct' && !friend.isMe
      );
    }

    return friendList;
  }


  public getFriendRequests(): Array<ConversationListItemPropsType> {
    const { conversations } = this.props;

    let conversationsList = conversations;
    console.log('conversations:', conversationsList);
    if (conversationsList !== undefined) {
      // ignore friend request we made ourself
      conversationsList = conversationsList.filter(
        conversation => conversation.showFriendRequestIndicator && conversation.lastMessage && conversation.lastMessage.status !== 'sent' && conversation.lastMessage.status !== 'sending'
      );
    }

    return conversationsList;
  }

  private renderList() {
    const friends = this.getCurrentFriends();
    const friendsRequest = this.getFriendRequests();

    if (!friends) {
      throw new Error(
        'render: must provided friends if no search results are provided'
      );
    }
    const length = friends.length + (friendsRequest ? friendsRequest.length : 0);
    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
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

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element | undefined => {

    const friends = this.getCurrentFriends();
    const friendRequest = this.getFriendRequests();

    let item;
    if(index<friendRequest.length) {
      item = friendRequest[index];
    }
    else {
      item = friends[index-friendRequest.length];
    }

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...item}
        i18n={window.i18n}
      />
    );
  };

  public updateSearch(searchTerm: string) {
    const { updateSearchTerm, clearSearch } = this.props;

    if (!searchTerm) {
      clearSearch();

      return;
    }
    // reset our pubKeyPasted, we can either have a pasted sessionID or a sessionID got from a search
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
}
