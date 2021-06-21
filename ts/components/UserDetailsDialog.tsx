import React from 'react';
import { Avatar, AvatarSize } from './Avatar';

import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';
import { SessionIdEditable } from './session/SessionIdEditable';
import { ConversationController } from '../session/conversations';
import { ConversationModel, ConversationTypeEnum } from '../models/conversation';
import { SessionWrapperModal } from './session/SessionWrapperModal';
import { SpacerMD } from './basic/Text';
import autoBind from 'auto-bind';
import { updateUserDetailsModal } from '../state/ducks/modalDialog';
import { openConversationExternal } from '../state/ducks/conversations';

type Props = {
  conversationId: string;
  authorAvatarPath?: string;
  userName: string;
};

interface State {
  isEnlargedImageShown: boolean;
}

export class UserDetailsDialog extends React.Component<Props, State> {
  private readonly convo: ConversationModel;
  constructor(props: Props) {
    super(props);

    autoBind(this);
    this.convo = ConversationController.getInstance().get(props.conversationId);
    window.addEventListener('keyup', this.onKeyUp);

    this.state = { isEnlargedImageShown: false };
  }

  public render() {
    return (
      <SessionWrapperModal title={this.props.userName} onClose={this.closeDialog}>
        <div className="avatar-center">
          <div className="avatar-center-inner">{this.renderAvatar()}</div>
        </div>

        <SpacerMD />
        <SessionIdEditable editable={false} text={this.convo.id} />

        <div className="session-modal__button-group__center">
          <SessionButton
            text={window.i18n('startConversation')}
            buttonType={SessionButtonType.Default}
            buttonColor={SessionButtonColor.Primary}
            onClick={this.onClickStartConversation}
          />
        </div>
      </SessionWrapperModal>
    );
  }

  private renderAvatar() {
    const size = this.state.isEnlargedImageShown ? AvatarSize.HUGE : AvatarSize.XL;
    const userName = this.props.userName || this.props.conversationId;

    return (
      <Avatar
        avatarPath={this.props.authorAvatarPath}
        name={userName}
        size={size}
        onAvatarClick={this.handleShowEnlargedDialog}
        pubkey={this.props.conversationId}
      />
    );
  }

  private readonly handleShowEnlargedDialog = () => {
    this.setState({ isEnlargedImageShown: !this.state.isEnlargedImageShown });
  };

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        void this.onClickStartConversation();
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

    window.inboxStore?.dispatch(updateUserDetailsModal(null));
  }

  private async onClickStartConversation() {
    // this.props.onStartConversation();
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      this.convo.id,
      ConversationTypeEnum.PRIVATE
    );

    window.inboxStore?.dispatch(openConversationExternal(conversation.id));

    this.closeDialog();
  }
}
