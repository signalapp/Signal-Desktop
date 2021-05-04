import React from 'react';

import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { missingCaseError, PasswordUtil } from '../../util/';
import { ToastUtils } from '../../session/utils';
import { SessionIconType } from './icon';
import { DefaultTheme, withTheme } from 'styled-components';
import { getPasswordHash } from '../../data/data';
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
      action === PasswordAction.Remove ? SessionButtonColor.Danger : SessionButtonColor.Primary;

    return (
      <SessionModal
        title={window.i18n(`${action}Password`)}
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
          />
          {action !== PasswordAction.Remove && (
            <input
              type="password"
              id="password-modal-input-confirm"
              placeholder={placeholders[1]}
              onKeyUp={this.onPasswordConfirmInput}
            />
          )}
        </div>

        <div className="spacer-sm" />
        {this.showError()}

        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('ok')}
            buttonColor={confirmButtonColor}
            onClick={this.setPassword}
          />

          <SessionButton text={window.i18n('cancel')} onClick={this.closeDialog} />
        </div>
      </SessionModal>
    );
  }

  public async validatePasswordHash(password: string | null) {
    // Check if the password matches the hash we have stored
    const hash = await getPasswordHash();
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

  /**
   * Returns false and set the state error field in the input is not a valid password
   * or returns true
   */
  private validatePassword(firstPassword: string) {
    // if user did not fill the first password field, we can't do anything
    const errorFirstInput = PasswordUtil.validatePassword(firstPassword, window.i18n);
    if (errorFirstInput !== null) {
      this.setState({
        error: errorFirstInput,
      });
      return false;
    }
    return true;
  }

  private async handleActionSet(enteredPassword: string, enteredPasswordConfirm: string) {
    // be sure both password are valid
    if (!this.validatePassword(enteredPassword)) {
      return;
    }
    // no need to validate second password. we just need to check that enteredPassword is valid, and that both password matches

    if (enteredPassword !== enteredPasswordConfirm) {
      this.setState({
        error: window.i18n('setPasswordInvalid'),
      });
      return;
    }
    await window.setPassword(enteredPassword, null);
    ToastUtils.pushToastSuccess(
      'setPasswordSuccessToast',
      window.i18n('setPasswordTitle'),
      window.i18n('setPasswordToastDescription'),
      SessionIconType.Lock
    );

    this.props.onOk(this.props.action);
    this.closeDialog();
  }

  private async handleActionChange(oldPassword: string, newPassword: string) {
    // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
    // we only validate the newPassword here
    if (!this.validatePassword(newPassword)) {
      return;
    }
    const isValidWithStoredInDB = Boolean(await this.validatePasswordHash(oldPassword));
    if (!isValidWithStoredInDB) {
      this.setState({
        error: window.i18n('changePasswordInvalid'),
      });
      return;
    }
    await window.setPassword(newPassword, oldPassword);

    ToastUtils.pushToastSuccess(
      'setPasswordSuccessToast',
      window.i18n('changePasswordTitle'),
      window.i18n('changePasswordToastDescription'),
      SessionIconType.Lock
    );

    this.props.onOk(this.props.action);
    this.closeDialog();
  }

  private async handleActionRemove(oldPassword: string) {
    // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
    const isValidWithStoredInDB = Boolean(await this.validatePasswordHash(oldPassword));
    if (!isValidWithStoredInDB) {
      this.setState({
        error: window.i18n('removePasswordInvalid'),
      });
      return;
    }
    await window.setPassword(null, oldPassword);

    ToastUtils.pushToastWarning(
      'setPasswordSuccessToast',
      window.i18n('removePasswordTitle'),
      window.i18n('removePasswordToastDescription')
    );

    this.props.onOk(this.props.action);
    this.closeDialog();
  }

  // tslint:disable-next-line: cyclomatic-complexity
  private async setPassword() {
    const { action } = this.props;
    const { currentPasswordEntered, currentPasswordConfirmEntered } = this.state;
    const { Set, Remove, Change } = PasswordAction;

    // Trim leading / trailing whitespace for UX
    const firstPasswordEntered = (currentPasswordEntered || '').trim();
    const secondPasswordEntered = (currentPasswordConfirmEntered || '').trim();

    switch (action) {
      case Set: {
        await this.handleActionSet(firstPasswordEntered, secondPasswordEntered);
        return;
      }
      case Change: {
        await this.handleActionChange(firstPasswordEntered, secondPasswordEntered);
        return;
      }
      case Remove: {
        await this.handleActionRemove(firstPasswordEntered);
        return;
      }
      default:
        throw missingCaseError(action);
    }
  }

  private closeDialog() {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  private async onPasswordInput(event: any) {
    if (event.key === 'Enter') {
      return this.setPassword();
    }
    const currentPasswordEntered = event.target.value;

    this.setState({ currentPasswordEntered });
  }

  private async onPasswordConfirmInput(event: any) {
    if (event.key === 'Enter') {
      return this.setPassword();
    }
    const currentPasswordConfirmEntered = event.target.value;

    this.setState({ currentPasswordConfirmEntered });
  }
}

export const SessionPasswordModal = withTheme(SessionPasswordModalInner);
