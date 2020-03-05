import React from 'react';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionIdEditable } from './SessionIdEditable';
import { UserSearchDropdown } from './UserSearchDropdown';
import { ContactType, SessionMemberListItem } from './SessionMemberListItem';
import { ConversationType } from '../../state/ducks/conversations';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { SessionSpinner } from './SessionSpinner';
import { SessionGroupType } from './LeftPaneChannelSection';
import { PillDivider } from './PillDivider';

interface Props {
  overlayMode: 'message' | 'contact' | SessionGroupType;
  onChangeSessionID: any;
  onCloseClick: any;
  onButtonClick: any;
  contacts?: Array<ConversationType>;
  searchTerm?: string;
  searchResults?: any;
  updateSearch?: any;
  showSpinner?: boolean;
}

interface State {
  groupName: string;
  selectedMembers: Array<ContactType>;
}

export class SessionClosableOverlay extends React.Component<Props, State> {
  private readonly inputRef: React.RefObject<SessionIdEditable>;

  public constructor(props: Props) {
    super(props);

    this.state = {
      groupName: '',
      selectedMembers: [],
    };

    this.inputRef = React.createRef();
    this.onGroupNameChanged = this.onGroupNameChanged.bind(this);
  }

  public componentDidMount() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  public getContacts() {
    const conversations = window.getConversations() || [];

    const conversationList = conversations.filter((conversation: any) => {
      return (
        !conversation.isMe() &&
        conversation.isPrivate() &&
        !conversation.isSecondaryDevice() &&
        conversation.isFriend()
      );
    });

    return conversationList.map((d: any) => {
      const lokiProfile = d.getLokiProfile();
      const name = lokiProfile ? lokiProfile.displayName : 'Anonymous';

      // TODO: should take existing members into account
      const existingMember = false;

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: name,
        selected: false,
        authorName: name,
        authorColor: d.getColor(),
        checkmarked: false,
        existingMember,
      };
    });
  }

  // tslint:disable-next-line max-func-body-length */
  public render(): JSX.Element {
    const {
      overlayMode,
      onCloseClick,
      onChangeSessionID,
      showSpinner,
      searchTerm,
      updateSearch,
      searchResults,
      onButtonClick,
    } = this.props;

    const isAddContactView = overlayMode === 'contact';
    const isMessageView = overlayMode === 'message';

    const isOpenGroupView = overlayMode === SessionGroupType.Open;
    const isClosedGroupView = overlayMode === SessionGroupType.Closed;

    let title;
    let buttonText;
    let descriptionLong;
    let subtitle;
    let placeholder;
    switch (overlayMode) {
      case 'message':
        title = window.i18n('newSession');
        buttonText = window.i18n('next');
        descriptionLong = window.i18n('usersCanShareTheir...');
        subtitle = window.i18n('enterSessionID');
        placeholder = window.i18n('pasteSessionIDRecipient');
        break;
      case 'contact':
        title = window.i18n('addContact');
        buttonText = window.i18n('next');
        descriptionLong = window.i18n('usersCanShareTheir...');
        subtitle = window.i18n('enterSessionID');
        placeholder = window.i18n('pasteSessionIDRecipient');
        break;
      case 'open-group':
        title = window.i18n('addChannel');
        buttonText = window.i18n('joinChannel');
        descriptionLong = window.i18n('addChannelDescription');
        subtitle = window.i18n('enterChannelURL');
        placeholder = window.i18n('channelUrlPlaceholder');
        break;
      case 'closed-group':
        title = window.i18n('newClosedGroup');
        buttonText = window.i18n('createClosedGroup');
        descriptionLong = window.i18n('createClosedGroupDescription');
        subtitle = window.i18n('createClosedGroupNamePrompt');
        placeholder = window.i18n('createClosedGroupPlaceholder');
        break;
      default:
    }

    const { groupName, selectedMembers } = this.state;
    const ourSessionID = window.textsecure.storage.user.getNumber();

    const contacts = this.getContacts();
    const noContactsForClosedGroup =
      overlayMode === SessionGroupType.Closed && contacts.length === 0;

    return (
      <div className="module-left-pane-overlay">
        <div className="exit">
          <SessionIconButton
            iconSize={SessionIconSize.Small}
            iconType={SessionIconType.Exit}
            onClick={onCloseClick}
          />
        </div>

        <div className="spacer-md" />

        <h2>{title}</h2>

        <h3>
          {subtitle}
          <hr className="green-border" />
        </h3>
        <hr className="white-border" />

        {isOpenGroupView || isClosedGroupView ? (
          <div className="create-group-name-input">
            <SessionIdEditable
              ref={this.inputRef}
              editable={!noContactsForClosedGroup}
              placeholder={placeholder}
              value={this.state.groupName}
              maxLength={window.CONSTANTS.MAX_GROUPNAME_LENGTH}
              onChange={this.onGroupNameChanged}
            />

            {/*  */}
          </div>
        ) : (
          <SessionIdEditable
            ref={this.inputRef}
            editable={true}
            placeholder={placeholder}
            onChange={onChangeSessionID}
          />
        )}

        {showSpinner && <SessionSpinner />}

        {isClosedGroupView && (
          <>
            <div className="spacer-lg" />

            <div className="group-member-list__container">
              {noContactsForClosedGroup ? (
                <div className="group-member-list__no-contacts">
                  {window.i18n('noContactsForGroup')}
                </div>
              ) : (
                <div className="group-member-list__selection">
                  {this.renderMemberList()}
                </div>
              )}
            </div>

            <div className="spacer-lg" />
          </>
        )}

        <div className="session-description-long">{descriptionLong}</div>
        {isMessageView && <h4>{window.i18n('or')}</h4>}

        {isMessageView && (
          <UserSearchDropdown
            searchTerm={searchTerm || ''}
            updateSearch={updateSearch}
            placeholder={window.i18n('searchByIDOrDisplayName')}
            searchResults={searchResults}
          />
        )}

        {isAddContactView && (
          <PillDivider text={window.i18n('yourPublicKey')} />
        )}

        {isAddContactView && (
          <SessionIdEditable
            editable={false}
            placeholder=""
            text={ourSessionID}
          />
        )}

        <SessionButton
          buttonColor={SessionButtonColor.Green}
          buttonType={SessionButtonType.BrandOutline}
          text={buttonText}
          disabled={noContactsForClosedGroup}
          onClick={() => onButtonClick(groupName, selectedMembers)}
        />
      </div>
    );
  }

  private renderMemberList() {
    const members = this.getContacts();

    return members.map((member: ContactType) => (
      <SessionMemberListItem
        member={member}
        isSelected={false}
        onSelect={(selectedMember: ContactType) => {
          this.handleSelectMember(selectedMember);
        }}
        onUnselect={(selectedMember: ContactType) => {
          this.handleUnselectMember(selectedMember);
        }}
      />
    ));
  }

  private handleSelectMember(member: ContactType) {
    if (this.state.selectedMembers.includes(member)) {
      return;
    }

    this.setState({
      selectedMembers: [...this.state.selectedMembers, member],
    });
  }

  private handleUnselectMember(member: ContactType) {
    this.setState({
      selectedMembers: this.state.selectedMembers.filter(selectedMember => {
        return selectedMember.id !== member.id;
      }),
    });
  }

  private onGroupNameChanged(event: any) {
    this.setState({
      groupName: event,
    });
  }
}
