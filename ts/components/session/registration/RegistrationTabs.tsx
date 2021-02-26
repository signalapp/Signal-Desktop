import React from 'react';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { trigger } from '../../../shims/events';
import { StringUtils, ToastUtils, UserUtils } from '../../../session/utils';
import { ConversationController } from '../../../session/conversations';
import { PasswordUtil } from '../../../util';
import { removeAll } from '../../../data/data';
import { SignUpMode, SignUpTab } from './SignUpTab';
import { SignInMode } from './SignInTab';
import { RegistrationUserDetails } from './RegistrationUserDetails';
import { TermsAndConditions } from './TermsAndConditions';
import { TabLabel, TabType } from './TabLabel';

export const MAX_USERNAME_LENGTH = 20;

interface State {
  selectedTab: TabType;
  signInMode: SignInMode;
  signUpMode: SignUpMode;
  secretWords: string | undefined;
  displayName: string;
  password: string;
  validatePassword: string;
  passwordErrorString: string;
  passwordFieldsMatch: boolean;
  recoveryPhrase: string;
  generatedRecoveryPhrase: string;
  hexGeneratedPubKey: string;
  mnemonicError: string | undefined;
  displayNameError: string | undefined;
}

export class RegistrationTabs extends React.Component<any, State> {
  constructor(props: any) {
    super(props);

    this.onSeedChanged = this.onSeedChanged.bind(this);
    this.onDisplayNameChanged = this.onDisplayNameChanged.bind(this);
    this.onPasswordChanged = this.onPasswordChanged.bind(this);
    this.onPasswordVerifyChanged = this.onPasswordVerifyChanged.bind(this);
    this.handlePressEnter = this.handlePressEnter.bind(this);
    this.handleContinueYourSessionClick = this.handleContinueYourSessionClick.bind(
      this
    );
    this.onCompleteSignUpClick = this.onCompleteSignUpClick.bind(this);

    this.state = {
      selectedTab: TabType.SignUp,
      signInMode: SignInMode.Default,
      signUpMode: SignUpMode.Default,
      secretWords: undefined,
      displayName: '',
      password: '',
      validatePassword: '',
      passwordErrorString: '',
      passwordFieldsMatch: false,
      recoveryPhrase: '',
      generatedRecoveryPhrase: '',
      hexGeneratedPubKey: '',
      mnemonicError: undefined,
      displayNameError: undefined,
    };
  }

  public componentDidMount() {
    void this.generateMnemonicAndKeyPair();
    void this.resetRegistration();
  }

  public render() {
    const { selectedTab } = this.state;
    // tslint:disable: use-simple-attributes

    return (
      <div className="session-registration-container">
        <div className="session-registration__tab-container">
          <TabLabel
            type={TabType.SignUp}
            isSelected={selectedTab === TabType.SignUp}
            onSelect={this.handleTabSelect}
          />
          <TabLabel
            type={TabType.SignIn}
            isSelected={selectedTab === TabType.SignIn}
            onSelect={this.handleTabSelect}
          />
        </div>
        {this.renderSections()}
      </div>
    );
  }

  private async generateMnemonicAndKeyPair() {
    if (this.state.generatedRecoveryPhrase === '') {
      const language = 'english';
      const mnemonic = await window
        .getAccountManager()
        .generateMnemonic(language);

      let seedHex = window.mnemonic.mn_decode(mnemonic, language);
      // handle shorter than 32 bytes seeds
      const privKeyHexLength = 32 * 2;
      if (seedHex.length !== privKeyHexLength) {
        seedHex = seedHex.concat('0'.repeat(32));
        seedHex = seedHex.substring(0, privKeyHexLength);
      }
      const seed = window.dcodeIO.ByteBuffer.wrap(
        seedHex,
        'hex'
      ).toArrayBuffer();
      const keyPair = await window.sessionGenerateKeyPair(seed);
      const hexGeneratedPubKey = StringUtils.decode(keyPair.pubKey, 'hex');

      this.setState({
        generatedRecoveryPhrase: mnemonic,
        hexGeneratedPubKey, // our 'frontend' sessionID
      });
    }
  }

  private readonly handleTabSelect = (tabType: TabType): void => {
    this.setState({
      selectedTab: tabType,
      signInMode: SignInMode.Default,
      signUpMode: SignUpMode.Default,
      displayName: '',
      password: '',
      validatePassword: '',
      passwordErrorString: '',
      passwordFieldsMatch: false,
      recoveryPhrase: '',
      mnemonicError: undefined,
      displayNameError: undefined,
    });
  };

  private onSeedChanged(val: string) {
    this.setState({
      recoveryPhrase: val,
      mnemonicError: !val ? window.i18n('recoveryPhraseEmpty') : undefined,
    });
  }

  private onDisplayNameChanged(val: string) {
    const sanitizedName = this.sanitiseNameInput(val);
    const trimName = sanitizedName.trim();

    this.setState({
      displayName: sanitizedName,
      displayNameError: !trimName ? window.i18n('displayNameEmpty') : undefined,
    });
  }

  private onPasswordChanged(val: string) {
    this.setState({ password: val }, () => {
      this.validatePassword();
    });
  }

  private onPasswordVerifyChanged(val: string) {
    this.setState({ validatePassword: val });
    this.setState({ validatePassword: val }, () => {
      this.validatePassword();
    });
  }

  private renderSections() {
    const { selectedTab } = this.state;
    if (selectedTab === TabType.SignUp) {
      return (
        <SignUpTab
          signUpMode={this.state.signUpMode}
          continueSignUp={() => {
            this.setState({
              signUpMode: SignUpMode.EnterDetails,
            });
          }}
          createSessionID={() => {
            this.setState(
              {
                signUpMode: SignUpMode.SessionIDShown,
              },
              () => {
                window.Session.setNewSessionID(this.state.hexGeneratedPubKey);
              }
            );
          }}
          onCompleteSignUpClick={this.onCompleteSignUpClick}
          displayName={this.state.displayName}
          password={this.state.password}
          passwordErrorString={this.state.passwordErrorString}
          passwordFieldsMatch={this.state.passwordFieldsMatch}
          displayNameError={this.state.displayNameError}
          recoveryPhrase={this.state.recoveryPhrase}
          onPasswordVerifyChanged={this.onPasswordVerifyChanged}
          handlePressEnter={this.handlePressEnter}
          onPasswordChanged={this.onPasswordChanged}
          onDisplayNameChanged={this.onDisplayNameChanged}
          onSeedChanged={this.onSeedChanged}
        />
      );
    }

    return this.renderSignIn();
  }

  private getRenderTermsConditionAgreement() {
    const { selectedTab, signInMode } = this.state;
    if (selectedTab !== TabType.SignUp) {
      return signInMode !== SignInMode.Default ? <TermsAndConditions /> : null;
    }
    return <></>;
  }

  private onCompleteSignUpClick() {
    void this.register();
  }

  private renderSignIn() {
    return (
      <div className="session-registration__content">
        {this.renderRegistrationContent()}

        {this.renderSignInButtons()}
        {this.getRenderTermsConditionAgreement()}
      </div>
    );
  }

  private renderRegistrationContent() {
    const { signInMode } = this.state;

    const isSignInNotDefault = signInMode !== SignInMode.Default;

    if (isSignInNotDefault) {
      const sharedProps = {
        displayName: this.state.displayName,
        handlePressEnter: this.handlePressEnter,
        onDisplayNameChanged: this.onDisplayNameChanged,
        onPasswordChanged: this.onPasswordChanged,
        onPasswordVerifyChanged: this.onPasswordVerifyChanged,
        onSeedChanged: this.onSeedChanged,
        password: this.state.password,
        passwordErrorString: this.state.passwordErrorString,
        passwordFieldsMatch: this.state.passwordFieldsMatch,
        recoveryPhrase: this.state.recoveryPhrase,
        stealAutoFocus: true,
      };

      if (signInMode === SignInMode.UsingRecoveryPhrase) {
        return (
          <RegistrationUserDetails
            showDisplayNameField={true}
            showSeedField={true}
            {...sharedProps}
          />
        );
      }

      if (signInMode === SignInMode.LinkDevice) {
        return (
          <RegistrationUserDetails
            showDisplayNameField={false}
            showSeedField={true}
            {...sharedProps}
          />
        );
      }
    }

    return null;
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;

    const or = window.i18n('or');

    if (signInMode === SignInMode.Default) {
      return (
        <div>
          {this.renderRestoreUsingRecoveryPhraseButton()}
          <div className="or">{or}</div>
          {this.renderLinkDeviceButton()}
        </div>
      );
    }

    return (
      <SessionButton
        onClick={this.handleContinueYourSessionClick}
        buttonType={SessionButtonType.Brand}
        buttonColor={SessionButtonColor.Green}
        text={window.i18n('continueYourSession')}
      />
    );
  }

  private renderTermsConditionAgreement() {
    return <TermsAndConditions />;
  }

  private handleContinueYourSessionClick() {
    if (this.state.signInMode === SignInMode.UsingRecoveryPhrase) {
      void this.register();
    }
  }

  private renderRestoreUsingRecoveryPhraseButton() {
    return (
      <SessionButton
        onClick={() => {
          this.setState({
            signInMode: SignInMode.UsingRecoveryPhrase,
            recoveryPhrase: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={SessionButtonType.BrandOutline}
        buttonColor={SessionButtonColor.Green}
        text={window.i18n('restoreUsingRecoveryPhrase')}
      />
    );
  }

  private renderLinkDeviceButton() {
    return (
      <SessionButton
        onClick={() => {
          this.setState({
            signInMode: SignInMode.LinkDevice,
            recoveryPhrase: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={SessionButtonType.BrandOutline}
        buttonColor={SessionButtonColor.Green}
        text={window.i18n('linkDevice')}
      />
    );
  }

  private handlePressEnter() {
    const { signInMode, signUpMode } = this.state;
    if (signUpMode === SignUpMode.EnterDetails) {
      this.onCompleteSignUpClick();

      return;
    }

    if (signInMode === SignInMode.UsingRecoveryPhrase) {
      this.handleContinueYourSessionClick();

      return;
    }
  }

  private trim(value: string) {
    return value ? value.trim() : value;
  }

  private validatePassword() {
    const input = this.trim(this.state.password);
    const confirmationInput = this.trim(this.state.validatePassword);

    // If user hasn't set a value then skip
    if (!input && !confirmationInput) {
      this.setState({
        passwordErrorString: '',
        passwordFieldsMatch: true,
      });

      return;
    }

    const error = PasswordUtil.validatePassword(input, window.i18n);
    if (error) {
      this.setState({
        passwordErrorString: error,
        passwordFieldsMatch: true,
      });

      return;
    }

    if (input !== confirmationInput) {
      this.setState({
        passwordErrorString: '',
        passwordFieldsMatch: false,
      });

      return;
    }

    this.setState({
      passwordErrorString: '',
      passwordFieldsMatch: true,
    });
  }

  private sanitiseNameInput(val: string) {
    return val.replace(window.displayNameRegex, '');
  }

  private async resetRegistration() {
    await removeAll();
    await window.storage.reset();
    await window.storage.fetch();
    ConversationController.getInstance().reset();
    await ConversationController.getInstance().load();

    this.setState({
      secretWords: undefined,
    });
  }

  private async register() {
    const {
      password,
      recoveryPhrase,
      generatedRecoveryPhrase,
      signInMode,
      displayName,
      passwordErrorString,
      passwordFieldsMatch,
    } = this.state;
    // Make sure the password is valid
    window.log.info('starting registration');

    const trimName = displayName.trim();

    if (!trimName) {
      window.log.warn('invalid trimmed name for registration');
      ToastUtils.pushToastError(
        'invalidDisplayName',
        window.i18n('displayNameEmpty')
      );
      return;
    }

    if (passwordErrorString) {
      window.log.warn('invalid password for registration');
      ToastUtils.pushToastError(
        'invalidPassword',
        window.i18n('invalidPassword')
      );
      return;
    }

    if (!!password && !passwordFieldsMatch) {
      window.log.warn('passwords does not match for registration');
      ToastUtils.pushToastError(
        'invalidPassword',
        window.i18n('passwordsDoNotMatch')
      );
      return;
    }

    if (signInMode === SignInMode.UsingRecoveryPhrase && !recoveryPhrase) {
      window.log.warn('empty mnemonic seed passed in seed restoration mode');

      return;
    } else if (!generatedRecoveryPhrase) {
      window.log.warn('empty generated seed');

      return;
    }

    const seedToUse =
      signInMode === SignInMode.UsingRecoveryPhrase
        ? recoveryPhrase
        : generatedRecoveryPhrase;

    try {
      await this.resetRegistration();

      await window.setPassword(password);
      const isRestoringFromSeed = signInMode === SignInMode.UsingRecoveryPhrase;
      UserUtils.setRestoringFromSeed(isRestoringFromSeed);

      await window
        .getAccountManager()
        .registerSingleDevice(seedToUse, 'english', trimName);
      // if we are just creating a new account, no need to wait for a configuration message
      if (!isRestoringFromSeed) {
        trigger('openInbox');
      } else {
        // We have to pull for all messages of the user of this menmonic
        // We are looking for the most recent ConfigurationMessage he sent to himself.
        // When we find it, we can just get the displayName, avatar and groups saved in it.
        // If we do not find one, we will need to ask for a display name.
        window.log.warn('isRestoringFromSeed');
      }
    } catch (e) {
      ToastUtils.pushToastError(
        'registrationError',
        `Error: ${e.message || 'Something went wrong'}`
      );
      let exmsg = '';
      if (e.message) {
        exmsg += e.message;
      }
      if (e.stack) {
        exmsg += ` | stack:  + ${e.stack}`;
      }
      window.log.warn('exception during registration:', exmsg);
    }
  }
}
