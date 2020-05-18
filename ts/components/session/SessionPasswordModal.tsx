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
  private readonly passwordInput: React.RefObject<HTMLInputElement>;
  private readonly passwordInputConfirm: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);

    this.state = {
      error: null,
    };

    this.showError = this.showError.bind(this);

    this.setPassword = this.setPassword.bind(this);
    this.closeDialog = this.closeDialog.bind(this);

    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPaste = this.onPaste.bind(this);

    this.passwordInput = React.createRef();
    this.passwordInputConfirm = React.createRef();
  }

  public componentDidMount() {
    setTimeout(() => {
      if (!this.passwordInput.current) {
        return;
      }

      this.passwordInput.current.focus();
    }, 100);
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
            ref={this.passwordInput}
            placeholder={placeholders[0]}
            onKeyUp={this.onKeyUp}
            maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
            onPaste={this.onPaste}
          />
          {action !== PasswordAction.Remove && (
            <input
              type="password"
              id="password-modal-input-confirm"
              ref={this.passwordInputConfirm}
              placeholder={placeholders[1]}
              onKeyUp={this.onKeyUp}
              maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
              onPaste={this.onPaste}
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

  private async setPassword(onSuccess?: any) {
    // Only initial input required for PasswordAction.Remove
    if (
      !this.passwordInput.current ||
      (!this.passwordInputConfirm.current &&
        this.props.action !== PasswordAction.Remove)
    ) {
      return;
    }

    // Trim leading / trailing whitespace for UX
    const enteredPassword = String(this.passwordInput.current.value).trim();
    const enteredPasswordConfirm =
      (this.passwordInputConfirm.current &&
        String(this.passwordInputConfirm.current.value).trim()) ||
      '';

    if (
      enteredPassword.length === 0 ||
      (enteredPasswordConfirm.length === 0 &&
        this.props.action !== PasswordAction.Remove)
    ) {
      return;
    }

    // Check passwords entered
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
        ? Boolean(await this.validatePasswordHash(oldPassword))
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

  private onPaste(event: any) {
    const clipboard = event.clipboardData.getData('text');

    if (clipboard.length > window.CONSTANTS.MAX_PASSWORD_LENGTH) {
      const title = String(
        window.i18n(
          'pasteLongPasswordToastTitle',
          window.CONSTANTS.MAX_PASSWORD_LENGTH
        )
      );

      window.pushToast({
        title,
        type: 'warning',
      });
    }

    // Prevent pating into input
    return false;
  }

  private async onKeyUp(event: any) {
    const { onOk } = this.props;

    if (event.key === 'Enter') {
      await this.setPassword(onOk);
    }

    event.preventDefault();
  }
}
