import React from 'react';
import classNames from 'classnames';

import { SessionModal } from '../session/SessionModal';
import { SessionButton } from '../session/SessionButton';
import { Avatar } from '../Avatar';

interface Props {
  titleText: string;
  isPublic: boolean;
  groupName: string;
  okText: string;
  cancelText: string;
  isAdmin: boolean;
  i18n: any;
  onSubmit: any;
  onClose: any;
  // avatar stuff
  avatarPath: string;
}

interface State {
  groupName: string;
  errorDisplayed: boolean;
  errorMessage: string;
  avatar: string;
}

export class UpdateGroupNameDialog extends React.Component<Props, State> {
  private readonly inputEl: any;

  constructor(props: any) {
    super(props);

    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onFileSelected = this.onFileSelected.bind(this);
    this.onGroupNameChanged = this.onGroupNameChanged.bind(this);

    this.state = {
      groupName: this.props.groupName,
      errorDisplayed: false,
      errorMessage: 'placeholder',
      avatar: this.props.avatarPath,
    };
    this.inputEl = React.createRef();
    window.addEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    if (!this.state.groupName.trim()) {
      this.onShowError(this.props.i18n('emptyGroupNameError'));

      return;
    }

    const avatar =
      this.inputEl &&
      this.inputEl.current &&
      this.inputEl.current.files &&
      this.inputEl.current.files.length > 0
        ? this.inputEl.current.files[0]
        : null; // otherwise use the current avatar

    this.props.onSubmit(this.state.groupName, avatar);

    this.closeDialog();
  }

  public render() {
    const { okText, cancelText } = this.props;

    const titleText = `${this.props.titleText}`;

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    return (
      <SessionModal
        title={titleText}
        // tslint:disable-next-line: no-void-expression
        onClose={() => this.closeDialog()}
        onOk={() => null}
      >
        <div className="spacer-md" />
        <p className={errorMessageClasses}>{errorMsg}</p>
        <div className="spacer-md" />
        {this.renderAvatar()}
        <div className="spacer-md" />

        <input
          type="text"
          className="profile-name-input"
          value={this.state.groupName}
          placeholder={this.props.i18n('groupNamePlaceholder')}
          onChange={this.onGroupNameChanged}
          tabIndex={0}
          required={true}
          aria-required={true}
          autoFocus={true}
          disabled={!this.props.isAdmin}
        />

        <div className="session-modal__button-group">
          <SessionButton text={okText} onClick={this.onClickOK} />

          <SessionButton text={cancelText} onClick={this.closeDialog} />
        </div>
      </SessionModal>
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

    this.props.onClose();
  }

  private onGroupNameChanged(event: any) {
    event.persist();

    this.setState(state => {
      return {
        ...state,
        groupName: event.target.value,
      };
    });
  }

  private renderAvatar() {
    const avatarPath = this.state.avatar;
    const isPublic = this.props.isPublic;

    if (!isPublic) {
      return undefined;
    }

    return (
      <div className="avatar-center">
        <div className="avatar-center-inner">
          <Avatar
            avatarPath={avatarPath}
            conversationType="group"
            i18n={this.props.i18n}
            size={80}
          />
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
