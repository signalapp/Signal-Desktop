import React from 'react';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionIdEditable } from './SessionIdEditable';
import { UserSearchDropdown } from './UserSearchDropdown';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { SessionSpinner } from './SessionSpinner';

interface Props {
  overlayMode: 'message' | 'contact' | 'channel';
  onChangeSessionID: any;
  onCloseClick: any;
  onButtonClick: any;
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
    // const isChannelView = overlayMode === 'channel';

    let title;
    let buttonText;
    let descriptionLong;
    let subtitle;
    let placeholder;
    switch (overlayMode) {
      case 'message':
        title = window.i18n('enterRecipient');
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
      case 'channel':
      default:
        title = window.i18n('addChannel');
        buttonText = window.i18n('joinChannel');
        descriptionLong = window.i18n('addChannelDescription');
        subtitle = window.i18n('enterChannelURL');
        placeholder = window.i18n('channelUrlPlaceholder');
    }

    const ourSessionID = window.textsecure.storage.user.getNumber();

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
        <h3>
          {subtitle}
          <hr className="green-border" />
        </h3>
        <hr className="white-border" />
        <SessionIdEditable
          ref={this.inputRef}
          editable={true}
          placeholder={placeholder}
          onChange={onChangeSessionID}
        />
        {showSpinner && <SessionSpinner />}
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
