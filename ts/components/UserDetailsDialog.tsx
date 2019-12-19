import React from 'react';
import { Avatar } from './Avatar';

import { SessionDropdown } from './session/SessionDropdown';

declare global {
  interface Window {
    displayNameRegex: any;
  }
}

interface Props {
  i18n: any;
  profileName: string;
  avatarPath: string;
  avatarColor: string;
  pubkey: string;
  onClose: any;
  onStartConversation: any;
}

export class UserDetailsDialog extends React.Component<Props> {
  constructor(props: any) {
    super(props);

    this.closeDialog = this.closeDialog.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onClickStartConversation = this.onClickStartConversation.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const i18n = this.props.i18n;

    const cancelText = i18n('cancel');
    const startConversation = i18n('startConversation');

    const items = [
      {
        content: 'sdgsdfg',
        display: true, //!isPublic && !isMe,
      },
      {
        content: i18n('changeNickname'),
        display: true, //!isPublic && !isMe,
      },
      {
        content: i18n('clearNickname'),
        display: true, //!isPublic && !isMe && hasNickname,
      },
      {
        content: i18n('copyPublicKey'),
        display: false, //!isPublic,
      },
      {
        content: i18n('deleteMessages'),
      },
      {
        content: i18n('deleteContact'),
        display: true, //!isMe && isClosable && !isPublic,
      },
      {
        content: i18n('deletePublicChannel'),
        display: true, //!isMe && isClosable && !isPublic,
      },
    ];

    return (
      <div className="content">
        <SessionDropdown items={items} />

        <div className="avatar-center">
          <div className="avatar-center-inner">{this.renderAvatar()}</div>
        </div>
        <div className="profile-name">{this.props.profileName}</div>
        <div className="message">{this.props.pubkey}</div>

        <div className="buttons">
          <button className="cancel" tabIndex={0} onClick={this.closeDialog}>
            {cancelText}
          </button>

          <button
            className="ok"
            tabIndex={0}
            onClick={this.onClickStartConversation}
          >
            {startConversation}
          </button>
        </div>
      </div>
    );
  }

  private renderAvatar() {
    const avatarPath = this.props.avatarPath;
    const color = this.props.avatarColor;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={this.props.i18n}
        name={this.props.profileName}
        phoneNumber={this.props.pubkey}
        profileName={this.props.profileName}
        size={80}
      />
    );
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.onClickStartConversation();
        break;
      case 'Esc':
      case 'Escape':
        this.closeDialog();
        break;
      default:
    }
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.props.onClose();
  }

  private onClickStartConversation() {
    this.props.onStartConversation();
    this.closeDialog();
  }
}
