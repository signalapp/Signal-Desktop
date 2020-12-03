import React from 'react';

import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { PasswordUtil } from '../../util/';
import { ToastUtils } from '../../session/utils';
import { toast } from 'react-toastify';
import { SessionToast, SessionToastType } from './SessionToast';
import { SessionIconType } from './icon';
import { DefaultTheme, withTheme } from 'styled-components';
export enum PasswordAction {
  Set = 'set',
  Change = 'change',
  Remove = 'remove',
}

interface Props {
  action: PasswordAction;
  onOk: any;
  onClose: any;
  theme: DefaultTheme;
}

interface State {
  error: string | null;
  currentPasswordEntered: string | null;
  currentPasswordConfirmEntered: string | null;
}

class SessionPasswordModalInner extends React.Component<Props, State> {
  private passportInput: HTMLInputElement | null = null;

  constructor(props: any) {
    super(props);

    this.state = {
      error: null,
      currentPasswordEntered: null,
      currentPasswordConfirmEntered: null,
    };

    this.showError = this.showError.bind(this);

    this.setPassword = this.setPassword.bind(this);
    this.closeDialog = this.closeDialog.bind(this);

    this.onPasswordInput = this.onPasswordInput.bind(this);
    this.onPasswordConfirmInput = this.onPasswordConfirmInput.bind(this);

    this.onPaste = this.onPaste.bind(this);
  }

  public componentDidMount() {
    setTimeout(() => {
      // tslint:disable-next-line: no-unused-expression
      this.passportInput && this.passportInput.focus();
    }, 1);
  }

  public render() {
    const { action, onOk } = this.props;
    const placeholders =
      action === PasswordAction.Change
        ? [window.i18n('typeInOldPassword'), window.i18n('enterPassword')]
        : [window.i18n('enterPassword'), window.i18n('confirmPassword')];

    const confirmButtonColor =
      action === PasswordAction.Remove
        ? SessionButtonColor.Danger
        : SessionButtonColor.Primary;

    return (
      <SessionModal
        title={window.i18n(`${action}Password`)}
        onOk={() => null}
        onClose={this.closeDialog}
        theme={this.props.theme}
      >
        <div className="spacer-sm" />

        <div className="session-modal__input-group">
          <input
            type="password"
            id="password-modal-input"
            ref={input => {
              this.passportInput = input;
            }}
            placeholder={placeholders[0]}
            onKeyUp={this.onPasswordInput}
            maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
            onPaste={this.onPaste}
          />
          {action !== PasswordAction.Remove && (
            <input
              type="password"
              id="password-modal-input-confirm"
              placeholder={placeholders[1]}
              onKeyUp={this.onPasswordConfirmInput}
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
    if (hash && !PasswordUtil.matchesHash(password, hash)) {
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

  // tslint:disable-next-line: cyclomatic-complexity
  private async setPassword(onSuccess?: any) {
    const { action } = this.props;
    const {
      currentPasswordEntered,
      currentPasswordConfirmEntered,
    } = this.state;
    const { Set, Remove, Change } = PasswordAction;

    // Trim leading / trailing whitespace for UX
    const enteredPassword = (currentPasswordEntered || '').trim();
    const enteredPasswordConfirm = (currentPasswordConfirmEntered || '').trim();

    // if user did not fill the first password field, we can't do anything
    const errorFirstInput = PasswordUtil.validatePassword(
      enteredPassword,
      window.i18n
    );
    if (errorFirstInput !== null) {
      this.setState({
        error: errorFirstInput,
      });
      return;
    }

    // if action is Set or Change, we need a valid ConfirmPassword
    if (action === Set || action === Change) {
      const errorSecondInput = PasswordUtil.validatePassword(
        enteredPasswordConfirm,
        window.i18n
      );
      if (errorSecondInput !== null) {
        this.setState({
          error: errorSecondInput,
        });
        return;
      }
    }

    // Passwords match or remove password successful
    const newPassword = action === Remove ? null : enteredPasswordConfirm;
    const oldPassword = action === Set ? null : enteredPassword;

    // Check if password match, when setting, changing or removing
    let valid;
    if (action === Set) {
      valid = enteredPassword === enteredPasswordConfirm;
    } else {
      valid = Boolean(await this.validatePasswordHash(oldPassword));
    }

    if (!valid) {
      let str;
      switch (action) {
        case Set:
          str = window.i18n('setPasswordInvalid');
          break;
        case Change:
          str = window.i18n('changePasswordInvalid');
          break;
        case Remove:
          str = window.i18n('removePasswordInvalid');
          break;
        default:
          throw new Error(`Invalid action ${action}`);
      }
      this.setState({
        error: str,
      });

      return;
    }

    await window.setPassword(newPassword, oldPassword);
    let title;
    let description;
    switch (action) {
      case Set:
        title = window.i18n('setPasswordTitle');
        description = window.i18n('setPasswordToastDescription');
        break;
      case Change:
        title = window.i18n('changePasswordTitle');
        description = window.i18n('changePasswordToastDescription');
        break;
      case Remove:
        title = window.i18n('removePasswordTitle');
        description = window.i18n('removePasswordToastDescription');
        break;
      default:
        throw new Error(`Invalid action ${action}`);
    }

    if (action !== Remove) {
      ToastUtils.pushToastSuccess(
        'setPasswordSuccessToast',
        title,
        description,
        SessionIconType.Lock
      );
    } else {
      ToastUtils.pushToastWarning(
        'setPasswordSuccessToast',
        title,
        description
      );
    }

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
      ToastUtils.pushToastWarning('passwordModal', title);
    }

    // Prevent pating into input
    return false;
  }

  private async onPasswordInput(event: any) {
    if (event.key === 'Enter') {
      return this.setPassword(this.props.onOk);
    }
    this.setState({ currentPasswordEntered: event.target.value });
  }

  private async onPasswordConfirmInput(event: any) {
    if (event.key === 'Enter') {
      return this.setPassword(this.props.onOk);
    }
    this.setState({ currentPasswordConfirmEntered: event.target.value });
  }
}

export const SessionPasswordModal = withTheme(SessionPasswordModalInner);
