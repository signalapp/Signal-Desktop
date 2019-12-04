import React from 'react';
import { Avatar } from './Avatar';

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

interface State {
  isEnlargeImageShown: boolean;
}

export class UserDetailsDialog extends React.Component<Props, State> {
  private modalRef: any;

  constructor(props: any) {
    super(props);

    this.closeDialog = this.closeDialog.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onClickStartConversation = this.onClickStartConversation.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
    this.modalRef = React.createRef();
    this.state = { isEnlargeImageShown: false };
  }

  public componentWillMount() {
    document.addEventListener('mousedown', this.handleClick, false);
  }

  public componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClick, false);
  }

  public render() {
    const i18n = this.props.i18n;

    const cancelText = i18n('cancel');
    const startConversation = i18n('startConversation');

    return (
      <div ref={element => (this.modalRef = element)}>
        <div className="content">
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
      </div>
    );
  }

  private renderAvatar() {
    const avatarPath = this.props.avatarPath;
    const color = this.props.avatarColor;
    const size = this.state.isEnlargeImageShown ? 300 : 80;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={this.props.i18n}
        name={this.props.profileName}
        phoneNumber={this.props.pubkey}
        profileName={this.props.profileName}
        size={size}
        onAvatarClick={this.handleShowEnlargedDialog}
        borderWidth={size / 2}
      />
    );
  }

  private readonly handleShowEnlargedDialog = () => {
    this.setState({ isEnlargeImageShown: !this.state.isEnlargeImageShown });
  };

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

  private readonly handleClick = (e: any) => {
    if (this.modalRef.contains(e.target)) {
      return;
    }
    this.closeDialog();
  };
}
