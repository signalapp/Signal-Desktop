import React from 'react';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionIdEditable } from './SessionIdEditable';
import { UserSearchDropdown } from './UserSearchDropdown';
import { MemberList } from '../conversation/MemberList';
import { ConversationType } from '../../state/ducks/conversations';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { SessionSpinner } from './SessionSpinner';
import { SessionGroupType } from './LeftPaneChannelSection';

interface Props {
  overlayMode: 'message' | 'contact' | SessionGroupType;
  onChangeSessionID: any;
  onCloseClick: any;
  onButtonClick: any;
  friends?: Array<ConversationType>;
  searchTerm?: string;
  searchResults?: any;
  updateSearch?: any;
  showSpinner?: boolean;
}

export class SessionClosableOverlay extends React.Component<Props> {
  private readonly inputRef: React.RefObject<SessionIdEditable>;

  public constructor(props: Props) {
    super(props);

    this.inputRef = React.createRef();
  }

  public componentDidMount() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

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

    // const isOpenGroupView = overlayMode === SessionGroupType.Open;
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
        title = window.i18n('createClosedGroup');
        buttonText = window.i18n('createClosedGroup');
        descriptionLong = window.i18n('createClosedGroupDescription');
        subtitle = window.i18n('createClosedGroupNamePrompt');
        placeholder = window.i18n('createClosedGroupPlaceholder');
        break;
      default:
        break;
    }

    const ourSessionID = window.textsecure.storage.user.getNumber();
    const friends = window.getFriendsFromContacts(this.props.friends);
    console.log(this.props.friends);
    console.log(window.getFriendsFromContacts(this.props.friends));

    return (
      <div className="module-left-pane-overlay">
        <div className="exit">
          <SessionIconButton
            iconSize={SessionIconSize.Small}
            iconType={SessionIconType.Exit}
            onClick={onCloseClick}
          />
        </div>
        <h2>{title}</h2>
        <h3>{subtitle}</h3>
        <div className="module-left-pane-overlay-border-container">
          <hr className="white" />
          <hr className="green" />
        </div>
        <SessionIdEditable
          ref={this.inputRef}
          editable={true}
          placeholder={placeholder}
          onChange={onChangeSessionID}
        />
        {showSpinner && <SessionSpinner />}

        {isClosedGroupView && (
          <div className="friend-selection-list">
            <MemberList
              members={friends}
              selected={{}}
              i18n={window.i18n}
              onMemberClicked={() => null }//this.onMemberClicked}
            />
          </div>
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
          <div className="panel-text-divider">
            <span>{window.i18n('yourPublicKey')}</span>
          </div>
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
          onClick={onButtonClick}
        />
      </div>
    );
  }
}
