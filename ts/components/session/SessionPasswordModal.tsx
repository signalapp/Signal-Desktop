import React from 'react';

import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';

export enum PasswordAction {
  Set = 'set',
  Change = 'change',
  Remove = 'remove',
}

interface Props {
  action: PasswordAction;
  onOk: any;
  onClose: any;
}

interface State {
  error: string | null;
}

export class SessionPasswordModal extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      error: null,
    };

    this.showError = this.showError.bind(this);

    this.setPassword = this.setPassword.bind(this);
    this.closeDialog = this.closeDialog.bind(this);

    this.onKeyUp = this.onKeyUp.bind(this);
  }

  public componentDidMount() {
    setTimeout(() => $('#password-modal-input').focus(), 100);
  }

  public render() {
    const { action, onOk } = this.props;
    const placeholders =
      this.props.action === PasswordAction.Change
        ? [window.i18n('typeInOldPassword'), window.i18n('enterPassword')]
        : [window.i18n('enterPassword'), window.i18n('confirmPassword')];

    const confirmButtonColor =
      this.props.action === PasswordAction.Remove
        ? SessionButtonColor.Danger
        : SessionButtonColor.Primary;

    return (
      <SessionModal
        title={window.i18n(`${action}Password`)}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        <div className="spacer-sm" />

        <div className="session-modal__input-group">
          <input
            type="password"
            id="password-modal-input"
            placeholder={placeholders[0]}
            onKeyUp={this.onKeyUp}
            maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
          />
          {action !== PasswordAction.Remove && (
            <input
              type="password"
              id="password-modal-input-confirm"
              placeholder={placeholders[1]}
              onKeyUp={this.onKeyUp}
              maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
            />
          )}
        </div>

        <div className="spacer-sm" />
        {this.showError()}

        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('ok')}
            buttonColor={confirmButtonColor}
            onClick={async () => this.setPassword(onOk)}
          />

          <SessionButton
            text={window.i18n('cancel')}
            onClick={this.closeDialog}
          />
        </div>
      </SessionModal>
    );
  }

  public async validatePasswordHash(password: string | null) {
    // Check if the password matches the hash we have stored
    const hash = await window.Signal.Data.getPasswordHash();
    if (hash && !window.passwordUtil.matchesHash(password, hash)) {
      return false;
    }

    return true;
  }

  private showError() {
    const message = this.state.error;

    return (
      <>
        {message && (
          <>
            <div className="session-label warning">{message}</div>
            <div className="spacer-lg" />
          </>
        )}
      </>
    );
  }

  private async setPassword(onSuccess: any) {
    const enteredPassword = String($('#password-modal-input').val());
    const enteredPasswordConfirm = String(
      $('#password-modal-input-confirm').val()
    );

    if (enteredPassword.length === 0 || enteredPasswordConfirm.length === 0) {
      return;
    }

    // Check passwords enntered
    if (
      enteredPassword.length === 0 ||
      (this.props.action === PasswordAction.Change &&
        enteredPasswordConfirm.length === 0)
    ) {
      this.setState({
        error: window.i18n('noGivenPassword'),
      });

      return;
    }

    // Passwords match or remove password successful
    const newPassword =
      this.props.action === PasswordAction.Remove
        ? null
        : enteredPasswordConfirm;
    const oldPassword =
      this.props.action === PasswordAction.Set ? null : enteredPassword;

    // Check if password match, when setting, changing or removing
    const valid =
      this.props.action !== PasswordAction.Set
        ? !!await this.validatePasswordHash(oldPassword)
        : enteredPassword === enteredPasswordConfirm;

    if (!valid) {
      this.setState({
        error: window.i18n(`${this.props.action}PasswordInvalid`),
      });

      return;
    }

    await window.setPassword(newPassword, oldPassword);

    const toastParams = {
      title: window.i18n(`${this.props.action}PasswordTitle`),
      description: window.i18n(`${this.props.action}PasswordToastDescription`),
      type: this.props.action !== PasswordAction.Remove ? 'success' : 'warning',
      icon: this.props.action !== PasswordAction.Remove ? 'lock' : undefined,
    };

    window.pushToast({
      id: 'set-password-success-toast',
      ...toastParams,
    });

    onSuccess(this.props.action);
    this.closeDialog();
  }

  private closeDialog() {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  private async onKeyUp(event: any) {
    const { onOk } = this.props;

    if (event.key === 'Enter') {
      await this.setPassword(onOk);
    }

    event.preventDefault();
  }
}
