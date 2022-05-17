import React from 'react';

import { missingCaseError } from '../../util';
import { ToastUtils } from '../../session/utils';
import { getPasswordHash } from '../../data/data';
import { SpacerLG, SpacerSM } from '../basic/Text';
import autoBind from 'auto-bind';
import { sessionPassword } from '../../state/ducks/modalDialog';
import { LocalizerKeys } from '../../types/LocalizerKeys';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { matchesHash, validatePassword } from '../../util/passwordUtils';

export type PasswordAction = 'set' | 'change' | 'remove';

interface Props {
  passwordAction: PasswordAction;
  onOk: () => void;
}

interface State {
  error: string | null;
  currentPasswordEntered: string | null;
  currentPasswordConfirmEntered: string | null;
  currentPasswordRetypeEntered: string | null;
}

export class SessionPasswordDialog extends React.Component<Props, State> {
  private passportInput: HTMLInputElement | null = null;

  constructor(props: any) {
    super(props);

    this.state = {
      error: null,
      currentPasswordEntered: null,
      currentPasswordConfirmEntered: null,
      currentPasswordRetypeEntered: null,
    };

    autoBind(this);
  }

  public componentDidMount() {
    setTimeout(() => {
      // tslint:disable-next-line: no-unused-expression
      this.passportInput && this.passportInput.focus();
    }, 1);
  }

  public render() {
    const { passwordAction } = this.props;
    const placeholders =
      passwordAction === 'change'
        ? [
            window.i18n('typeInOldPassword'),
            window.i18n('enterPassword'),
            window.i18n('confirmPassword'),
          ]
        : [window.i18n('enterPassword'), window.i18n('confirmPassword')];

    const confirmButtonColor =
      passwordAction === 'remove' ? SessionButtonColor.Danger : SessionButtonColor.Green;
    // do this separately so typescript's compiler likes it
    const localizedKeyAction: LocalizerKeys =
      passwordAction === 'change'
        ? 'changePassword'
        : passwordAction === 'remove'
        ? 'removePassword'
        : 'setPassword';

    return (
      <SessionWrapperModal title={window.i18n(localizedKeyAction)} onClose={this.closeDialog}>
        <SpacerSM />

        <div className="session-modal__input-group">
          <input
            type="password"
            id="password-modal-input"
            ref={input => {
              this.passportInput = input;
            }}
            placeholder={placeholders[0]}
            onKeyUp={this.onPasswordInput}
            data-testid="password-input"
          />
          {passwordAction !== 'remove' && (
            <input
              type="password"
              id="password-modal-input-confirm"
              placeholder={placeholders[1]}
              onKeyUp={this.onPasswordConfirmInput}
              data-testid="password-input-confirm"
            />
          )}
          {passwordAction === 'change' && (
            <input
              type="password"
              id="password-modal-input-reconfirm"
              placeholder={placeholders[2]}
              onKeyUp={this.onPasswordRetypeInput}
              data-testid="password-input-reconfirm"
            />
          )}
        </div>

        <SpacerSM />
        {this.showError()}

        <div className="session-modal__button-group">
          <SessionButton text={window.i18n('cancel')} onClick={this.closeDialog} />
          <SessionButton
            text={window.i18n('ok')}
            buttonColor={confirmButtonColor}
            onClick={this.setPassword}
          />
        </div>
      </SessionWrapperModal>
    );
  }

  public async validatePasswordHash(password: string | null) {
    // Check if the password matches the hash we have stored
    const hash = await getPasswordHash();
    if (hash && !matchesHash(password, hash)) {
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
            <SpacerLG />
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
    const errorFirstInput = validatePassword(firstPassword);
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
      'lock'
    );

    this.props.onOk();
    this.closeDialog();
  }

  private async handleActionChange(
    oldPassword: string,
    newPassword: string,
    newConfirmedPassword: string
  ) {
    // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
    // we only validate the newPassword here
    if (!this.validatePassword(newPassword)) {
      return;
    }

    // Check the retyped password matches the new password
    if (newPassword !== newConfirmedPassword) {
      this.setState({
        error: window.i18n('passwordsDoNotMatch'),
      });
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
      'lock'
    );

    this.props.onOk();
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

    this.props.onOk();
    this.closeDialog();
  }

  // tslint:disable-next-line: cyclomatic-complexity
  private async setPassword() {
    const { passwordAction } = this.props;
    const {
      currentPasswordEntered,
      currentPasswordConfirmEntered,
      currentPasswordRetypeEntered,
    } = this.state;

    // Trim leading / trailing whitespace for UX
    const firstPasswordEntered = (currentPasswordEntered || '').trim();
    const secondPasswordEntered = (currentPasswordConfirmEntered || '').trim();
    const thirdPasswordEntered = (currentPasswordRetypeEntered || '').trim();

    switch (passwordAction) {
      case 'set': {
        await this.handleActionSet(firstPasswordEntered, secondPasswordEntered);
        return;
      }
      case 'change': {
        await this.handleActionChange(
          firstPasswordEntered,
          secondPasswordEntered,
          thirdPasswordEntered
        );
        return;
      }
      case 'remove': {
        await this.handleActionRemove(firstPasswordEntered);
        return;
      }
      default:
        throw missingCaseError(passwordAction);
    }
  }

  private closeDialog() {
    window.inboxStore?.dispatch(sessionPassword(null));
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

  private async onPasswordRetypeInput(event: any) {
    if (event.key === 'Enter') {
      return this.setPassword();
    }
    const currentPasswordRetypeEntered = event.target.value;

    this.setState({ currentPasswordRetypeEntered });
  }
}
