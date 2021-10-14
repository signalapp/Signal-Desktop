import React from 'react';

import { SessionIconButton } from './icon';
import { SessionIdEditable } from './SessionIdEditable';
import { ContactType, SessionMemberListItem } from './SessionMemberListItem';
import { ReduxConversationType } from '../../state/ducks/conversations';
import { SessionButton, SessionButtonColor, SessionButtonType } from './SessionButton';
import { SessionSpinner } from './SessionSpinner';
import { ConversationTypeEnum } from '../../models/conversation';
import { SessionJoinableRooms } from './SessionJoinableDefaultRooms';
import { SpacerLG, SpacerMD } from '../basic/Text';
import { useSelector } from 'react-redux';
import { getLeftPaneLists } from '../../state/selectors/conversations';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from '../ConversationListItem';

export enum SessionClosableOverlayType {
  Message = 'message',
  OpenGroup = 'open-group',
  ClosedGroup = 'closed-group',
  MessageRequests = 'message-requests',
}

interface Props {
  overlayMode: SessionClosableOverlayType;
  onChangeSessionID: any;
  onCloseClick: any;
  onButtonClick: any;
  contacts?: Array<ReduxConversationType>;
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
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onGroupNameChanged = this.onGroupNameChanged.bind(this);
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);

    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }
  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
  }

  public getContacts() {
    const { overlayMode } = this.props;
    const contactsList = this.props.contacts ?? [];
    // Depending on the rendered overlay type we have to filter the contact list.
    let filteredContactsList = contactsList;
    const isClosedGroupView = overlayMode === SessionClosableOverlayType.ClosedGroup;
    if (isClosedGroupView) {
      filteredContactsList = filteredContactsList.filter(
        c => c.type === ConversationTypeEnum.PRIVATE && !c.isMe
      );
    }

    return filteredContactsList.map((d: any) => {
      // TODO: should take existing members into account
      const existingMember = false;
      // if it has a profilename, use it and the shortened pubkey will be added automatically
      // if no profile name, Anonymous and the shortened pubkey will be added automatically
      let title;
      if (d.profileName) {
        title = `${d.profileName}`;
      } else {
        title = `${window.i18n('anonymous')}`;
      }

      return {
        id: d.id,
        authorPhoneNumber: d.id,
        authorProfileName: title,
        authorAvatarPath: d.avatarPath,
        selected: false,
        authorName: name,
        checkmarked: false,
        existingMember,
      };
    });
  }

  // tslint:disable-next-line max-func-body-length cyclomatic-complexity */
  public render(): JSX.Element {
    const { overlayMode, onCloseClick, onChangeSessionID, showSpinner, onButtonClick } = this.props;

    const { groupName, selectedMembers } = this.state;

    const isMessageView = overlayMode === SessionClosableOverlayType.Message;
    const isOpenGroupView = overlayMode === SessionClosableOverlayType.OpenGroup;
    const isClosedGroupView = overlayMode === SessionClosableOverlayType.ClosedGroup;
    const isMessageRequestView = overlayMode === SessionClosableOverlayType.MessageRequests;

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
        subtitle = window.i18n('enterSessionIDOrONSName');
        placeholder = window.i18n('enterSessionIDOfRecipient');
        break;
      case 'open-group':
        title = window.i18n('joinOpenGroup');
        buttonText = window.i18n('next');
        // descriptionLong = '';
        subtitle = window.i18n('openGroupURL');
        placeholder = window.i18n('enterAnOpenGroupURL');
        break;
      case 'closed-group':
        title = window.i18n('newClosedGroup');
        buttonText = window.i18n('done');
        subtitle = window.i18n('createClosedGroupNamePrompt');
        placeholder = window.i18n('createClosedGroupPlaceholder');
        break;
      case SessionClosableOverlayType.MessageRequests:
        title = 'Message Requests';
        buttonText = 'requests done';
        subtitle = 'Pending Requests';
        placeholder = 'placeholder';
        break;
      default:
    }

    const contacts = this.getContacts();

    const noContactsForClosedGroup =
      overlayMode === SessionClosableOverlayType.ClosedGroup && contacts.length === 0;

    const showLoadingSpinner = showSpinner === undefined ? false : showSpinner;

    return (
      <div className="module-left-pane-overlay">
        <div className="exit">
          <SessionIconButton iconSize={'small'} iconType="exit" onClick={onCloseClick} />
        </div>

        <SpacerMD />

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
              value={groupName}
              isGroup={true}
              maxLength={window.CONSTANTS.MAX_GROUPNAME_LENGTH}
              onChange={this.onGroupNameChanged}
              onPressEnter={() => onButtonClick(groupName, selectedMembers)}
            />
          </div>
        ) : null}

        {isMessageView ? (
          <SessionIdEditable
            ref={this.inputRef}
            editable={!showLoadingSpinner}
            placeholder={placeholder}
            onChange={onChangeSessionID}
          />
        ) : null}

        {isMessageRequestView ? (
          <>
            <SpacerLG />
            <div className="message-request-list__container"></div>
            <MessageRequestList />
            <SpacerLG />
          </>
        ) : null}

        <SessionSpinner loading={showLoadingSpinner} />

        {isClosedGroupView && (
          <>
            <SpacerLG />
            <div className="group-member-list__container">
              {noContactsForClosedGroup ? (
                <div className="group-member-list__no-contacts">
                  {window.i18n('noContactsForGroup')}
                </div>
              ) : (
                <div className="group-member-list__selection">
                  {this.renderMemberList(contacts)}
                </div>
              )}
            </div>

            <SpacerLG />
          </>
        )}

        {descriptionLong && <div className="session-description-long">{descriptionLong}</div>}
        {isMessageView && false && <h4>{window.i18n('or')}</h4>}
        {isOpenGroupView && <SessionJoinableRooms onRoomClicked={this.props.onCloseClick} />}

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

  private renderMemberList(members: any) {
    return members.map((member: ContactType, index: number) => (
      // tslint:disable-next-line: use-simple-attributes
      <SessionMemberListItem
        member={member}
        index={index}
        isSelected={this.state.selectedMembers.some(m => m.id === member.id)}
        key={member.id}
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

  private onKeyUp(event: any) {
    if (event.key === 'Escape') {
      window.removeEventListener('keyup', this.onKeyUp);
      this.props.onCloseClick();
    }
  }
}

const MessageRequestList = () => {
  // get all conversations with (accepted / known)
  // const convos = useSelector(getConversationLookup);

  const lists = useSelector(getLeftPaneLists);
  const conversationx = lists?.conversations as Array<ConversationListItemProps>;
  console.warn({ conversationx });

  // console.warn({ convos });
  // const allConversations = getConversationController().getConversations();
  // const messageRequests = allConversations.filter(convo => convo.get('isApproved') !== true);

  return (
    <>
      {/* {messageRequests.map(convoOfMessage => { */}
      {conversationx.map(convoOfMessage => {
        return <MessageRequestListItem conversation={convoOfMessage} />;
      })}
    </>
  );
};

// const MessageRequestListItem = (props: { conversation: ConversationModel }) => {
const MessageRequestListItem = (props: { conversation: ConversationListItemProps }) => {
  const { conversation } = props;
  // const { id: conversationId } = conversation;

  // TODO: add hovering
  // TODO: add styling

  /**
   * open the conversation selected
   */
  // const openConvo = useCallback(
  //   async (e: React.MouseEvent<HTMLDivElement>) => {
  //     // mousedown is invoked sooner than onClick, but for both right and left click
  //     if (e.button === 0) {
  //       await openConversationWithMessages({ conversationKey: conversationId });
  //     }
  //   },
  //   [conversationId]
  // );

  // /**
  //  * show basic highlight animation
  //  */
  // const handleMouseOver = () => {
  //   console.warn('hovered');
  // };

  return (
    // <div
    //   onMouseOver={handleMouseOver}
    //   onMouseDown={openConvo}
    //   onMouseUp={e => {
    //     e.stopPropagation();
    //     e.preventDefault();
    //   }}
    //   // className="message-request__item"

    //   // className={classNames(
    //   //     'module-conversation-list-item',
    //   //     unreadCount && unreadCount > 0 ? 'module-conversation-list-item--has-unread' : null,
    //   //     unreadCount && unreadCount > 0 && mentionedUs
    //   //       ? 'module-conversation-list-item--mentioned-us'
    //   //       : null,
    //   //     isSelected ? 'module-conversation-list-item--is-selected' : null,
    //   //     isBlocked ? 'module-conversation-list-item--is-blocked' : null
    //   //   )}
    // >
    //   {conversation.getName()}
    // </div>

    <MemoConversationListItemWithDetails {...conversation}></MemoConversationListItemWithDetails>
  );
};
