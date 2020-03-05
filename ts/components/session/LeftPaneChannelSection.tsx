import React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from '../ConversationListItem';

import { LeftPane, RowRendererParamsType } from '../LeftPane';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import {
  PropsData as SearchResultsProps,
  SearchResults,
} from '../SearchResults';
import { SearchOptions } from '../../types/Search';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SessionSearchInput } from './SessionSearchInput';
import { SessionClosableOverlay } from './SessionClosableOverlay';
import { MainViewController } from '../MainViewController';
import { ContactType } from './SessionMemberListItem';

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

export enum SessionGroupType {
  Open = 'open-group',
  Closed = 'closed-group',
}

interface State {
  channelUrlPasted: string;
  loading: boolean;
  connectSuccess: boolean;
  // The type of group that is being added. Undefined in default view.
  groupAddType: SessionGroupType | undefined;
}

export class LeftPaneChannelSection extends React.Component<Props, State> {
  private readonly updateSearchBound: (searchedString: string) => void;
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);
    this.state = {
      channelUrlPasted: '',
      loading: false,
      connectSuccess: false,
      groupAddType: undefined,
    };

    this.handleOnPasteUrl = this.handleOnPasteUrl.bind(this);
    this.handleJoinChannelButtonClick = this.handleJoinChannelButtonClick.bind(
      this
    );
    this.handleToggleOverlay = this.handleToggleOverlay.bind(this);
    this.updateSearchBound = this.updateSearch.bind(this);
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
        // a channel is either a public group or a rss group
        conversation =>
          conversation.type === 'group' &&
          (conversation.isPublic ||
            (conversation.lastMessage && conversation.lastMessage.isRss))
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

    const length = conversations.length;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    const list = (
      <div className="module-left-pane__list" key={0}>
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
    const labels = [window.i18n('groups')];

    return LeftPane.RENDER_HEADER(labels, null);
  }

  public componentDidMount() {
    MainViewController.renderMessageView();
  }

  public componentDidUpdate() {
    MainViewController.renderMessageView();
  }

  public render(): JSX.Element {
    return (
      <div className="session-left-pane-section-content">
        {this.renderHeader()}
        {this.state.groupAddType
          ? this.renderClosableOverlay(this.state.groupAddType)
          : this.renderGroups()}
      </div>
    );
  }

  public renderGroups() {
    return (
      <div className="module-conversations-list-content">
        <SessionSearchInput
          searchString={this.props.searchTerm}
          onChange={this.updateSearchBound}
          placeholder={window.i18n('search')}
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

    this.setState({ channelUrlPasted: '' });

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

  private handleToggleOverlay(groupType?: SessionGroupType) {
    // If no groupType, return to default view.
    // Close the overlay with handleToggleOverlay(undefined)

    switch (groupType) {
      case SessionGroupType.Open:
        this.setState({
          groupAddType: SessionGroupType.Open,
        });
        break;
      case SessionGroupType.Closed:
        this.setState({
          groupAddType: SessionGroupType.Closed,
        });
        break;
      default:
        // Exit overlay
        this.setState({
          groupAddType: undefined,
        });
    }
  }

  private renderClosableOverlay(groupType: SessionGroupType) {
    const { searchTerm } = this.props;
    const { loading } = this.state;

    const openGroupElement = (
      <SessionClosableOverlay
        overlayMode={SessionGroupType.Open}
        onChangeSessionID={this.handleOnPasteUrl}
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
        overlayMode={SessionGroupType.Closed}
        onChangeSessionID={this.handleOnPasteUrl}
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

    return groupType === SessionGroupType.Open
      ? openGroupElement
      : closedGroupElement;
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
            this.handleToggleOverlay(SessionGroupType.Open);
          }}
        />
        <SessionButton
          text={createClosedGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
          onClick={() => {
            this.handleToggleOverlay(SessionGroupType.Closed);
          }}
        />
      </div>
    );
  }

  private handleOnPasteUrl(value: string) {
    this.setState({ channelUrlPasted: value });
  }

  private handleJoinChannelButtonClick(groupUrl: string) {
    const { loading } = this.state;

    if (loading) {
      return false;
    }

    // longest TLD is now (20/02/06) 24 characters per https://jasontucker.blog/8945/what-is-the-longest-tld-you-can-get-for-a-domain-name
    const regexURL = /(http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,24}(:[0-9]{1,5})?(\/.*)?/;

    if (groupUrl.length <= 0) {
      window.pushToast({
        title: window.i18n('noServerURL'),
        type: 'error',
        id: 'connectToServerFail',
      });

      return false;
    }

    if (!regexURL.test(groupUrl)) {
      window.pushToast({
        title: window.i18n('noServerURL'),
        type: 'error',
        id: 'connectToServerFail',
      });

      return false;
    }

    joinChannelStateManager(this, groupUrl, () => {
      this.handleToggleOverlay(undefined);
    });

    return true;
  }

  private async onCreateClosedGroup(
    groupName: string,
    groupMembers: Array<ContactType>
  ) {
    // Validate groupName and groupMembers length
    if (
      groupName.length === 0 ||
      groupName.length > window.CONSTANTS.MAX_GROUP_NAME_LENGTH
    ) {
      window.pushToast({
        title: window.i18n(
          'invalidGroupName',
          window.CONSTANTS.MAX_GROUP_NAME_LENGTH
        ),
        type: 'error',
        id: 'invalidGroupName',
      });

      return;
    }

    // >= because we add ourself as a member after this. so a 10 group is already invalid as it will be 11 with ourself
    if (
      groupMembers.length === 0 ||
      groupMembers.length >= window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
    ) {
      window.pushToast({
        title: window.i18n(
          'invalidGroupSize',
          window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
        ),
        type: 'error',
        id: 'invalidGroupSize',
      });

      return;
    }

    const groupMemberIds = groupMembers.map(m => m.id);
    await window.doCreateGroup(groupName, groupMemberIds);
    this.handleToggleOverlay(undefined);

    window.pushToast({
      title: window.i18n('closedGroupCreatedToastTitle'),
      type: 'success',
    });

    return true;
  }
}

export function joinChannelStateManager(
  thisRef: any,
  serverURL: string,
  onSuccess?: any
) {
  // Any component that uses this function MUST have the keys [loading, connectSuccess]
  // in their State

  // TODO: Make this not hard coded
  const channelId = 1;
  thisRef.setState({ loading: true });
  const connectionResult = window.attemptConnection(serverURL, channelId);

  // Give 5s maximum for promise to revole. Else, throw error.
  const connectionTimeout = setTimeout(() => {
    if (!thisRef.state.connectSuccess) {
      thisRef.setState({ loading: false });
      window.pushToast({
        title: window.i18n('connectToServerFail'),
        type: 'error',
        id: 'connectToServerFail',
      });

      return;
    }
  }, window.CONSTANTS.MAX_CONNECTION_DURATION);

  connectionResult
    .then(() => {
      clearTimeout(connectionTimeout);

      if (thisRef.state.loading) {
        thisRef.setState({
          connectSuccess: true,
          loading: false,
        });
        window.pushToast({
          title: window.i18n('connectToServerSuccess'),
          id: 'connectToServerSuccess',
          type: 'success',
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    })
    .catch((connectionError: string) => {
      clearTimeout(connectionTimeout);
      thisRef.setState({
        connectSuccess: true,
        loading: false,
      });
      window.pushToast({
        title: connectionError,
        id: 'connectToServerFail',
        type: 'error',
      });

      return false;
    });

  return true;
}
