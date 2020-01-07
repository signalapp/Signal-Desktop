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
import { ConversationType } from '../../state/ducks/conversations';

export interface Props {
  searchTerm: string;
  isSecondaryDevice: boolean;

  conversations: Array<ConversationListItemPropsType>;
  friends: Array<ConversationType>;
  receivedFriendsRequest: Array<ConversationListItemPropsType>;
  receivedFriendRequestCount: number;
  sentFriendsRequest: Array<ConversationListItemPropsType>;

  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
}

interface State {
  showAddContactView: boolean;
  selectedTab: number;
  addContactRecipientID: string;
  showFriendRequestsPopup: boolean;
  pubKeyPasted: string;
}

export class LeftPaneContactSection extends React.Component<Props, State> {
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);
    this.state = {
      showAddContactView: false,
      selectedTab: 0,
      addContactRecipientID: '',
      pubKeyPasted: '',
      showFriendRequestsPopup: false,
    };

    this.debouncedSearch = debounce(this.search.bind(this), 20);
    this.handleTabSelected = this.handleTabSelected.bind(this);
    this.handleToggleOverlay = this.handleToggleOverlay.bind(this);
    this.handleOnAddContact = this.handleOnAddContact.bind(this);
    this.handleRecipientSessionIDChanged = this.handleRecipientSessionIDChanged.bind(
      this
    );
    this.handleToggleFriendRequestPopup = this.handleToggleFriendRequestPopup.bind(
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
    const { receivedFriendRequestCount } = this.props;
    const labels = [window.i18n('contactsHeader'), window.i18n('lists')];

    return LeftPane.RENDER_HEADER(
      labels,
      this.handleTabSelected,
      undefined,
      this.handleToggleFriendRequestPopup,
      receivedFriendRequestCount
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

  public renderRowFriendRequest = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element | undefined => {
    const receivedFriendsRequest = this.props.receivedFriendsRequest;

    const item = receivedFriendsRequest[index];
    const onClick = this.props.openConversationInternal;

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

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element | undefined => {
    const { sentFriendsRequest } = this.props;
    const friends = this.getCurrentFriends();
    const combined = [...sentFriendsRequest, ...friends];
    const item = combined[index];
    const onClick = this.props.openConversationInternal;

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

  private getCurrentFriends(): Array<ConversationType> {
    const { friends } = this.props;

    let friendList = friends;
    if (friendList !== undefined) {
      friendList = friendList.filter(
        friend => friend.type === 'direct' && !friend.isMe
      );
    }

    return friendList;
  }

  private handleToggleOverlay() {
    this.setState((prevState: { showAddContactView: boolean }) => ({
      showAddContactView: !prevState.showAddContactView,
    }));
  }

  private handleToggleFriendRequestPopup() {
    this.setState((prevState: { showFriendRequestsPopup: boolean }) => ({
      showFriendRequestsPopup: !prevState.showFriendRequestsPopup,
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
    const { showFriendRequestsPopup } = this.state;
    const hasReceivedFriendRequest =
      this.props.receivedFriendsRequest.length > 0;

    return (
      <div className="left-pane-contact-content">
        {this.renderList()}
        {showFriendRequestsPopup &&
          hasReceivedFriendRequest &&
          this.renderFriendRequestPopup()}
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

  private renderFriendRequestPopup() {
    const frTitle = window.i18n('youHaveFriendRequestFrom');
    const length = this.props.receivedFriendsRequest.length;

    return (
      <div className="module-left-pane__list-popup">
        <div className="friend-request-title">{frTitle}</div>
        <div className="module-left-pane__list" key={0}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                className="module-left-pane__virtual-list"
                height={height}
                rowCount={length}
                rowHeight={64}
                rowRenderer={this.renderRowFriendRequest}
                width={width}
                autoHeight={true}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  }

  private renderList() {
    const { sentFriendsRequest } = this.props;
    const friends = this.getCurrentFriends();
    const length = sentFriendsRequest.length + friends.length;

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
