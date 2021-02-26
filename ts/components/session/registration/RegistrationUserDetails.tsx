import classNames from 'classnames';
import React from 'react';
import { lightTheme } from '../../../state/ducks/SessionTheme';
import { SessionInput } from '../SessionInput';
import { MAX_USERNAME_LENGTH } from './RegistrationTabs';

const DisplayNameInput = (props: {
  stealAutoFocus?: boolean;
  displayName: string;
  onDisplayNameChanged: (val: string) => any;
  handlePressEnter: () => any;
}) => {
  return (
    // tslint:disable-next-line: use-simple-attributes
    <SessionInput
      autoFocus={props.stealAutoFocus || false}
      label={window.i18n('displayName')}
      type="text"
      placeholder={window.i18n('enterDisplayName')}
      value={props.displayName}
      maxLength={MAX_USERNAME_LENGTH}
      onValueChanged={props.onDisplayNameChanged}
      onEnterPressed={props.handlePressEnter}
      theme={lightTheme}
    />
  );
};

const RecoveryPhraseInput = (props: {
  recoveryPhrase: string;
  onSeedChanged: (val: string) => any;
  handlePressEnter: () => any;
}) => {
  return (
    <SessionInput
      label={window.i18n('recoveryPhrase')}
      type="password"
      value={props.recoveryPhrase}
      autoFocus={true}
      placeholder={window.i18n('enterRecoveryPhrase')}
      enableShowHide={true}
      onValueChanged={props.onSeedChanged}
      onEnterPressed={props.handlePressEnter}
      theme={lightTheme}
    />
  );
};

const PasswordAndVerifyPasswordFields = (props: {
  password: string;
  passwordFieldsMatch: boolean;
  passwordErrorString: string;
  onPasswordChanged: (val: string) => any;
  onPasswordVerifyChanged: (val: string) => any;
  handlePressEnter: () => any;
}) => {
  const { password, passwordFieldsMatch, passwordErrorString } = props;
  const passwordsDoNotMatch =
    !passwordFieldsMatch && password
      ? window.i18n('passwordsDoNotMatch')
      : undefined;

  return (
    <>
      <SessionInput
        label={window.i18n('password')}
        error={passwordErrorString}
        type="password"
        placeholder={window.i18n('enterOptionalPassword')}
        onValueChanged={props.onPasswordChanged}
        onEnterPressed={props.handlePressEnter}
        theme={lightTheme}
      />

      {!!password && (
        <SessionInput
          label={window.i18n('confirmPassword')}
          error={passwordsDoNotMatch}
          type="password"
          placeholder={window.i18n('confirmPassword')}
          onValueChanged={props.onPasswordVerifyChanged}
          onEnterPressed={props.handlePressEnter}
          theme={lightTheme}
        />
      )}
    </>
  );
};

export interface Props {
  // tslint:disable: react-unused-props-and-state
  showDisplayNameField: boolean;
  showSeedField: boolean;
  stealAutoFocus?: boolean;
  recoveryPhrase: string;
  displayName: string;
  password: string;
  passwordErrorString: string;
  passwordFieldsMatch: boolean;
  handlePressEnter: () => any;
  onSeedChanged: (val: string) => any;
  onDisplayNameChanged: (val: string) => any;
  onPasswordChanged: (val: string) => any;
  onPasswordVerifyChanged: (val: string) => any;
}

export const RegistrationUserDetails = (props: Props) => {
  return (
    <div className={classNames('session-registration__entry-fields')}>
      {props.showSeedField && (
        <RecoveryPhraseInput
          recoveryPhrase={props.recoveryPhrase}
          handlePressEnter={props.handlePressEnter}
          onSeedChanged={props.onSeedChanged}
        />
      )}
      <div className="inputfields">
        {props.showDisplayNameField && (
          <DisplayNameInput
            stealAutoFocus={props.stealAutoFocus}
            displayName={props.displayName}
            handlePressEnter={props.handlePressEnter}
            onDisplayNameChanged={props.onDisplayNameChanged}
          />
        )}
        <PasswordAndVerifyPasswordFields
          handlePressEnter={props.handlePressEnter}
          onPasswordChanged={props.onPasswordChanged}
          onPasswordVerifyChanged={props.onPasswordVerifyChanged}
          passwordErrorString={props.passwordErrorString}
          password={props.password}
          passwordFieldsMatch={props.passwordFieldsMatch}
        />
      </div>
    </div>
  );
};
