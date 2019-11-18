import React from 'react';
import classNames from 'classnames';
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
  onOk: any;
}

interface State {
  profileName: string;
  errorDisplayed: boolean;
  errorMessage: string;
  avatar: string;
}

export class EditProfileDialog extends React.Component<Props, State> {
  private readonly inputEl: any;

  constructor(props: any) {
    super(props);

    this.onNameEdited = this.onNameEdited.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.showError = this.showError.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onFileSelected = this.onFileSelected.bind(this);

    this.state = {
      profileName: this.props.profileName,
      errorDisplayed: false,
      errorMessage: 'placeholder',
      avatar: this.props.avatarPath,
    };

    this.inputEl = React.createRef();

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const i18n = this.props.i18n;

    const cancelText = i18n('cancel');
    const okText = i18n('ok');
    const placeholderText = i18n('profileName');

    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    return (
      <div className="content">
        <div className="avatar-upload">
          <div className="avatar-upload-inner">
            {this.renderAvatar()}
            <div className="upload-btn-background">
              <input
                type="file"
                ref={this.inputEl}
                className="input-file"
                placeholder="input file"
                name="name"
                onChange={this.onFileSelected}
              />
              <div
                role="button"
                className={'module-message__buttons__upload'}
                onClick={() => {
                  const el = this.inputEl.current;
                  if (el) {
                    el.click();
                  }
                }}
              />
            </div>
          </div>
        </div>
        <input
          type="text"
          className="profile-name"
          value={this.state.profileName}
          placeholder={placeholderText}
          onChange={this.onNameEdited}
          tabIndex={0}
          required={true}
          aria-required={true}
        />
        <div className="message">{i18n('editProfileDisplayNameWarning')}</div>
        <span className={errorMessageClasses}>{this.state.errorMessage}</span>
        <div className="buttons">
          <button className="cancel" tabIndex={0} onClick={this.closeDialog}>
            {cancelText}
          </button>
          <button className="ok" tabIndex={0} onClick={this.onClickOK}>
            {okText}
          </button>
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

  private renderAvatar() {
    const avatarPath = this.state.avatar;
    const color = this.props.avatarColor;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={this.props.i18n}
        name={this.state.profileName}
        phoneNumber={this.props.pubkey}
        profileName={this.state.profileName}
        size={80}
      />
    );
  }

  private onNameEdited(e: any) {
    e.persist();

    const newName = e.target.value.replace(window.displayNameRegex, '');

    this.setState(state => {
      return {
        ...state,
        profileName: newName,
      };
    });
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

  private showError(msg: string) {
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

  private onClickOK() {
    const newName = this.state.profileName.trim();

    if (newName === '') {
      this.showError(this.props.i18n('emptyProfileNameError'));

      return;
    }

    const avatar =
      this.inputEl &&
      this.inputEl.current &&
      this.inputEl.current.files &&
      this.inputEl.current.files.length > 0
        ? this.inputEl.current.files[0]
        : null;

    this.props.onOk(newName, avatar);
    this.closeDialog();
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }
}
