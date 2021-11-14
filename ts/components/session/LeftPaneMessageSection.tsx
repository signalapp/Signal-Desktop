import React from 'react';
import { AutoSizer, List } from 'react-virtualized';
import { MainViewController } from '../MainViewController';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from '../ConversationListItem';
import {
  openConversationWithMessages,
  ReduxConversationType,
} from '../../state/ducks/conversations';
import { SearchResults, SearchResultsProps } from '../SearchResults';
import { SessionSearchInput } from './SessionSearchInput';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { RowRendererParamsType } from '../LeftPane';
import { SessionClosableOverlay, SessionClosableOverlayType } from './SessionClosableOverlay';
import { ContactType } from './SessionMemberListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from './SessionButton';
import { PubKey } from '../../session/types';
import { ToastUtils, UserUtils } from '../../session/utils';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { getConversationController } from '../../session/conversations';
import { ConversationTypeEnum } from '../../models/conversation';
import { openGroupV2CompleteURLRegex } from '../../opengroup/utils/OpenGroupUtils';
import { joinOpenGroupV2WithUIEvents } from '../../opengroup/opengroupV2/JoinOpenGroupV2';
import autoBind from 'auto-bind';
import { onsNameRegex } from '../../session/snode_api/SNodeAPI';
import { SNodeAPI } from '../../session/snode_api';
import { clearSearch, search, updateSearchTerm } from '../../state/ducks/search';
import _ from 'lodash';
import { MessageRequestsBanner } from './MessageRequestsBanner';
import { BlockedNumberController } from '../../util';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/syncUtils';

export interface Props {
  searchTerm: string;

  contacts: Array<ReduxConversationType>;
  conversations?: Array<ConversationListItemProps>;
  searchResults?: SearchResultsProps;
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
  overlay: false | SessionClosableOverlayType;
  valuePasted: string;
  approvedConversations: any[];
  unapprovedConversations: any[];
}

export class LeftPaneMessageSection extends React.Component<Props, State> {
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);

    const approvedConversations = props.conversations?.filter(convo => Boolean(convo.isApproved));
    const unapprovedConversations = props.conversations?.filter(
      convo => !Boolean(convo.isApproved)
    );

    console.warn('convos updated');

    this.state = {
      loading: false,
      overlay: false,
      valuePasted: '',
      approvedConversations: approvedConversations || [],
      unapprovedConversations: unapprovedConversations || [],
    };

    autoBind(this);
    this.debouncedSearch = _.debounce(this.search.bind(this), 20);
  }

  public renderRow = ({ index, key, style }: RowRendererParamsType): JSX.Element | null => {
    const { conversations } = this.props;
    const conversationsToShow = conversations?.filter(async c => {
      return (
        Boolean(c.isApproved) === true &&
        (await BlockedNumberController.isBlockedAsync(c.id)) === false
      );
    });
    if (!conversations || !conversationsToShow) {
      throw new Error('renderRow: Tried to render without conversations');
    }

    // TODO: make this only filtered when the setting is enabled
    const messageRequestsEnabled =
      window.inboxStore?.getState().userConfig.messageRequests === true;

    let conversation;
    if (conversationsToShow?.length) {
      conversation = conversationsToShow[index];
    }

    if (!conversation) {
      return null;
    }

    // TODO: need to confirm what default setting is best here.
    if (messageRequestsEnabled && !Boolean(conversation.isApproved)) {
      return null;
    }
    return <MemoConversationListItemWithDetails key={key} style={style} {...conversation} />;
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const { conversations, searchResults } = this.props;
    const contacts = searchResults?.contacts || [];

    if (searchResults) {
      return <SearchResults {...searchResults} contacts={contacts} />;
    }

    if (!conversations) {
      throw new Error('render: must provided conversations if no search results are provided');
    }

    // TODO: make selectors for this instead.
    // TODO: only filter conversations if setting for requests is applied

    // TODO: readjust to be approved length as only approved convos will show here.
    const length = this.props.conversations ? this.props.conversations.length : 0;

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
              // conversations={this.state.approvedConversations}
              conversations={this.props.conversations}
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
        buttonIcon="plus"
        buttonClicked={this.handleNewSessionButtonClick}
      />
    );
  }

  public render(): JSX.Element {
    const { overlay } = this.state;

    return (
      <div className="session-left-pane-section-content">
        {this.renderHeader()}
        {overlay ? this.renderClosableOverlay() : this.renderConversations()}
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
        />
        <MessageRequestsBanner handleOnClick={this.handleMessageRequestsClick} />
        {this.renderList()}
        {this.renderBottomButtons()}
      </div>
    );
  }

  private handleMessageRequestsClick() {
    console.warn('handle msg req clicked');
    this.handleToggleOverlay(SessionClosableOverlayType.MessageRequests);
  }

  public updateSearch(searchTerm: string) {
    if (!searchTerm) {
      window.inboxStore?.dispatch(clearSearch());

      return;
    }

    // reset our pubKeyPasted, we can either have a pasted sessionID or a sessionID got from a search
    this.setState({ valuePasted: '' });

    window.inboxStore?.dispatch(updateSearchTerm(searchTerm));

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
    window.inboxStore?.dispatch(clearSearch());
  }

  public search() {
    const { searchTerm } = this.props;
    window.inboxStore?.dispatch(
      search(searchTerm, {
        noteToSelf: window.i18n('noteToSelf').toLowerCase(),
        ourNumber: UserUtils.getOurPubKeyStrFromCache(),
      })
    );
  }

  private renderClosableOverlay() {
    const { searchTerm, searchResults } = this.props;
    const { loading, overlay } = this.state;

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
        showSpinner={loading}
        updateSearch={this.updateSearch}
      />
    );

    const messageRequestsElement = (
      <SessionClosableOverlay
        overlayMode={SessionClosableOverlayType.MessageRequests}
        onChangeSessionID={this.handleOnPaste}
        onCloseClick={() => {
          this.handleToggleOverlay(undefined);
        }}
        onButtonClick={async () => {
          // TODO: msgrequest iterate all convos and block
          // iterate all conversations and set all to approve then
          const allConversations = getConversationController().getConversations();
          let syncRequired = false;

          _.forEach(allConversations, convo => {
            if (convo.isApproved() !== true) {
              BlockedNumberController.block(convo.id);
              syncRequired = true;
            }
          });
          if (syncRequired) {
            await forceSyncConfigurationNowIfNeeded();
          }
        }}
        searchTerm={searchTerm}
        searchResults={searchResults}
        showSpinner={loading}
        updateSearch={this.updateSearch}
      />
    );

    let overlayElement;
    switch (overlay) {
      case SessionClosableOverlayType.OpenGroup:
        overlayElement = openGroupElement;
        break;
      case SessionClosableOverlayType.ClosedGroup:
        overlayElement = closedGroupElement;
        break;
      case SessionClosableOverlayType.Message:
        overlayElement = messageElement;
        break;
      case SessionClosableOverlayType.MessageRequests:
        overlayElement = messageRequestsElement;
        break;
      default:
        overlayElement = false;
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
            this.handleToggleOverlay(SessionClosableOverlayType.OpenGroup);
          }}
        />
        <SessionButton
          text={newClosedGroup}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
          onClick={() => {
            this.handleToggleOverlay(SessionClosableOverlayType.ClosedGroup);
          }}
        />
      </div>
    );
  }

  private handleToggleOverlay(overlayType?: SessionClosableOverlayType) {
    const overlayState = overlayType || false;

    this.setState({ overlay: overlayState });

    // empty our generalized searchedString (one for the whole app)
    this.updateSearch('');
  }

  private handleOnPaste(value: string) {
    this.setState({ valuePasted: value });
  }

  private async handleMessageButtonClick() {
    if (!this.state.valuePasted && !this.props.searchTerm) {
      ToastUtils.pushToastError('invalidPubKey', window.i18n('invalidNumberError')); // or ons name
      return;
    }
    let pubkeyorOns: string;
    pubkeyorOns = this.state.valuePasted || this.props.searchTerm;
    pubkeyorOns = pubkeyorOns.trim();

    const errorOnPubkey = PubKey.validateWithError(pubkeyorOns);
    if (!errorOnPubkey) {
      // this is a pubkey
      await getConversationController().getOrCreateAndWait(
        pubkeyorOns,
        ConversationTypeEnum.PRIVATE
      );

      await openConversationWithMessages({ conversationKey: pubkeyorOns });
      this.handleToggleOverlay(undefined);
    } else {
      // this might be an ONS, validate the regex first
      const mightBeOnsName = new RegExp(onsNameRegex, 'g').test(pubkeyorOns);
      if (!mightBeOnsName) {
        ToastUtils.pushToastError('invalidPubKey', window.i18n('invalidNumberError'));
        return;
      }
      this.setState({ loading: true });
      try {
        const resolvedSessionID = await SNodeAPI.getSessionIDForOnsName(pubkeyorOns);
        if (PubKey.validateWithError(resolvedSessionID)) {
          throw new Error('Got a resolved ONS but the returned entry is not a vlaid SessionID');
        }
        // this is a pubkey
        await getConversationController().getOrCreateAndWait(
          resolvedSessionID,
          ConversationTypeEnum.PRIVATE
        );

        await openConversationWithMessages({ conversationKey: resolvedSessionID });

        this.handleToggleOverlay(undefined);
      } catch (e) {
        window?.log?.warn('failed to resolve ons name', pubkeyorOns, e);
        ToastUtils.pushToastError('invalidPubKey', window.i18n('failedResolveOns'));
      } finally {
        this.setState({ loading: false });
      }
    }
  }

  private async handleOpenGroupJoinV2(serverUrlV2: string) {
    const loadingCallback = (loading: boolean) => {
      this.setState({ loading });
    };
    const joinSuccess = await joinOpenGroupV2WithUIEvents(
      serverUrlV2,
      true,
      false,
      loadingCallback
    );

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
      window.log.warn('Invalid opengroupv2 url');
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
    this.handleToggleOverlay(SessionClosableOverlayType.Message);
  }
}
