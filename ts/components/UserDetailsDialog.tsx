import React from 'react';
import { Avatar } from './Avatar';

import { SessionModal } from './session/SessionModal';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './session/SessionButton';
import { SessionIdEditable } from './session/SessionIdEditable';

interface Props {
  i18n: any;
  isRss: boolean;
  profileName: string;
  avatarPath: string;
  avatarColor: string;
  pubkey: string;
  onClose: any;
  onStartConversation: any;
}

interface State {
  isEnlargedImageShown: boolean;
}

export class UserDetailsDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.closeDialog = this.closeDialog.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onClickStartConversation = this.onClickStartConversation.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
    this.state = { isEnlargedImageShown: false };
  }

  public render() {
    const { i18n, isRss } = this.props;

    return (
      <SessionModal
        title={this.props.profileName}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        <div className="avatar-center">
          <div className="avatar-center-inner">{this.renderAvatar()}</div>
        </div>
        <SessionIdEditable editable={false} text={this.props.pubkey} />

        <div className="session-modal__button-group__center">
          {!isRss && (
            <SessionButton
              text={i18n('startConversation')}
              buttonType={SessionButtonType.Default}
              buttonColor={SessionButtonColor.Primary}
              onClick={this.onClickStartConversation}
            />
          )}
        </div>
      </SessionModal>
    );
  }

  private renderAvatar() {
    const avatarPath = this.props.avatarPath;
    const color = this.props.avatarColor;
    const size = this.state.isEnlargedImageShown ? 300 : 80;

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
    this.setState({ isEnlargedImageShown: !this.state.isEnlargedImageShown });
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
}
