import React from 'react';
import classNames from 'classnames';

import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { Avatar, AvatarSize } from '../Avatar';
import { SessionWrapperModal } from '../session/SessionWrapperModal';
import { SpacerMD } from '../basic/Text';
import { updateGroupNameModal } from '../../state/ducks/modalDialog';
import autoBind from 'auto-bind';
import { ConversationModel } from '../../models/conversation';
import { getConversationController } from '../../session/conversations';
import { ClosedGroup } from '../../session';

type Props = {
  conversationId: string;
};

interface State {
  groupName: string | undefined;
  errorDisplayed: boolean;
  errorMessage: string;
  avatar: string | null;
}

export class UpdateGroupNameDialog extends React.Component<Props, State> {
  private readonly inputEl: any;
  private readonly convo: ConversationModel;

  constructor(props: Props) {
    super(props);

    autoBind(this);
    this.convo = getConversationController().get(props.conversationId);

    this.state = {
      groupName: this.convo.getName(),
      errorDisplayed: false,
      errorMessage: 'placeholder',
      avatar: this.convo.getAvatarPath(),
    };
    this.inputEl = React.createRef();
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    if (!this.state.groupName?.trim()) {
      this.onShowError(window.i18n('emptyGroupNameError'));

      return;
    }

    const newAvatarPath =
      this?.inputEl?.current?.files?.length > 0 ? this.inputEl.current.files[0] : null; // otherwise use the current avatar

    if (this.state.groupName !== this.convo.getName() || newAvatarPath !== this.state.avatar) {
      const members = this.convo.get('members') || [];

      void ClosedGroup.initiateGroupUpdate(
        this.convo.id,
        this.state.groupName,
        members,
        newAvatarPath
      );
    }

    this.closeDialog();
  }

  public render() {
    const okText = window.i18n('ok');
    const cancelText = window.i18n('cancel');
    const titleText = window.i18n('updateGroupDialogTitle', [this.convo.getName() || 'Unknown']);

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    const isAdmin = this.convo.isPublic()
      ? false // disable editing of opengroup rooms as we don't handle them for now
      : true;

    return (
      <SessionWrapperModal
        title={titleText}
        // tslint:disable-next-line: no-void-expression
        onClose={() => this.closeDialog()}
        additionalClassName="update-group-dialog"
      >
        {this.state.errorDisplayed ? (
          <>
            <SpacerMD />
            <p className={errorMessageClasses}>{errorMsg}</p>
            <SpacerMD />
          </>
        ) : null}

        {this.renderAvatar()}
        <SpacerMD />

        {isAdmin ? (
          <input
            type="text"
            className="profile-name-input"
            value={this.state.groupName}
            placeholder={window.i18n('groupNamePlaceholder')}
            onChange={this.onGroupNameChanged}
            tabIndex={0}
            required={true}
            aria-required={true}
            autoFocus={true}
          />
        ) : null}

        <div className="session-modal__button-group">
          <SessionButton text={cancelText} onClick={this.closeDialog} />

          <SessionButton
            text={okText}
            onClick={this.onClickOK}
            buttonColor={SessionButtonColor.Green}
          />
        </div>
      </SessionWrapperModal>
    );
  }

  private onShowError(msg: string) {
    if (this.state.errorDisplayed) {
      return;
    }

    this.setState({
      errorDisplayed: true,
      errorMessage: msg,
    });

    setTimeout(() => {
      this.setState({
        errorDisplayed: false,
      });
    }, 3000);
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.onClickOK();
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

    window.inboxStore?.dispatch(updateGroupNameModal(null));
  }

  private onGroupNameChanged(event: any) {
    const groupName = event.target.value;
    this.setState(state => {
      return {
        ...state,
        groupName,
      };
    });
  }

  private renderAvatar() {
    const isPublic = this.convo.isPublic();
    const pubkey = this.convo.id;

    if (!isPublic) {
      return undefined;
    }
    // tslint:disable: use-simple-attributes

    return (
      <div className="avatar-center">
        <div className="avatar-center-inner">
          <Avatar forcedAvatarPath={this.state.avatar || ''} size={AvatarSize.XL} pubkey={pubkey} />
          <div
            className="image-upload-section"
            role="button"
            onClick={() => {
              const el = this.inputEl.current;
              if (el) {
                el.click();
              }
            }}
          />
          <input
            type="file"
            ref={this.inputEl}
            className="input-file"
            placeholder="input file"
            name="name"
            onChange={this.onFileSelected}
          />
        </div>
      </div>
    );
  }

  private onFileSelected() {
    const file = this.inputEl.current.files[0];
    const url = window.URL.createObjectURL(file);

    this.setState({
      avatar: url,
    });
  }
}
