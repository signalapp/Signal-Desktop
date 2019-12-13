import React from 'react';
import classNames from 'classnames';

import { SessionInput } from './SessionInput';
import { SessionButton, SessionButtonType } from './SessionButton';
import { trigger } from '../../shims/events';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';

enum SignInMode {
  Default,
  UsingSeed,
  LinkingDevice,
}

enum SignUpMode {
  Default,
  SessionIDShown,
  EnterDetails,
}

enum TabType {
  Create,
  SignIn,
}

interface State {
  selectedTab: TabType;
  signInMode: SignInMode;
  signUpMode: SignUpMode;
  displayName: string;
  password: string;
  validatePassword: string;
  passwordErrorString: string;
  passwordFieldsMatch: boolean;
  mnemonicSeed: string;
  hexGeneratedPubKey: string;
  primaryDevicePubKey: string;
}

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: TabType) => void;
  type: TabType;
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect(type);
      }
    : undefined;

  return (
    <div
      className={classNames(
        'session-registration__tab',
        isSelected ? 'session-registration__tab--active' : null
      )}
      onClick={handleClick}
      role="tab"
    >
      {label}
    </div>
  );
};

export class RegistrationTabs extends React.Component<{}, State> {
  private readonly accountManager: any;

  constructor(props: any) {
    super(props);

    this.onSeedChanged = this.onSeedChanged.bind(this);
    this.onDisplayNameChanged = this.onDisplayNameChanged.bind(this);
    this.onPasswordChanged = this.onPasswordChanged.bind(this);
    this.onPasswordVerifyChanged = this.onPasswordVerifyChanged.bind(this);
    this.onSignUpGenerateSessionIDClick = this.onSignUpGenerateSessionIDClick.bind(
      this
    );
    this.onSignUpGetStartedClick = this.onSignUpGetStartedClick.bind(this);
    this.onSecondDeviceSessionIDChanged = this.onSecondDeviceSessionIDChanged.bind(
      this
    );
    this.onSecondaryDeviceRegistered = this.onSecondaryDeviceRegistered.bind(
      this
    );
    this.onCompleteSignUpClick = this.onCompleteSignUpClick.bind(this);
    this.handlePressEnter = this.handlePressEnter.bind(this);
    this.handleContinueYourSessionClick = this.handleContinueYourSessionClick.bind(
      this
    );

    this.state = {
      selectedTab: TabType.Create,
      signInMode: SignInMode.Default,
      signUpMode: SignUpMode.Default,
      displayName: '',
      password: '',
      validatePassword: '',
      passwordErrorString: '',
      passwordFieldsMatch: false,
      mnemonicSeed: '',
      hexGeneratedPubKey: '',
      primaryDevicePubKey: '',
    };

    this.accountManager = window.getAccountManager();
    // Clean status in case the app closed unexpectedly
    window.textsecure.storage.remove('secondaryDeviceStatus');
  }

  public render() {
    this.generateMnemonicAndKeyPair().ignore();

    return this.renderTabs();
  }

  private async generateMnemonicAndKeyPair() {
    if (this.state.mnemonicSeed === '') {
      const language = 'english';
      const mnemonic = await this.accountManager.generateMnemonic(language);

      let seedHex = window.mnemonic.mn_decode(mnemonic, language);
      // handle shorter than 32 bytes seeds
      const privKeyHexLength = 32 * 2;
      if (seedHex.length !== privKeyHexLength) {
        seedHex = seedHex.concat(seedHex);
        seedHex = seedHex.substring(0, privKeyHexLength);
      }
      const privKeyHex = window.mnemonic.sc_reduce32(seedHex);
      const privKey = window.dcodeIO.ByteBuffer.wrap(
        privKeyHex,
        'hex'
      ).toArrayBuffer();
      const keyPair = await window.libsignal.Curve.async.createKeyPair(privKey);
      const hexGeneratedPubKey = Buffer.from(keyPair.pubKey).toString('hex');

      this.setState({
        mnemonicSeed: mnemonic,
        hexGeneratedPubKey, // our 'frontend' sessionID
      });
    }
  }

  private renderTabs() {
    const { selectedTab } = this.state;

    const createAccount = window.i18n('createAccount');
    const signIn = window.i18n('signIn');
    const isCreateSelected = selectedTab === TabType.Create;
    const isSignInSelected = selectedTab === TabType.SignIn;

    return (
      <div className="session-registration-container">
        <div className="session-registration__tab-container">
          <Tab
            label={createAccount}
            type={TabType.Create}
            isSelected={isCreateSelected}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label={signIn}
            type={TabType.SignIn}
            isSelected={isSignInSelected}
            onSelect={this.handleTabSelect}
          />
        </div>
        {this.renderSections()}
      </div>
    );
  }

  private readonly handleTabSelect = (tabType: TabType): void => {
    if (tabType !== TabType.SignIn) {
      this.cancelSecondaryDevice().ignore();
    }
    this.setState({
      selectedTab: tabType,
      signInMode: SignInMode.Default,
      signUpMode: SignUpMode.Default,
      displayName: '',
      password: '',
      validatePassword: '',
      passwordErrorString: '',
      passwordFieldsMatch: false,
      mnemonicSeed: '',
      hexGeneratedPubKey: '',
      primaryDevicePubKey: '',
    });
  };

  private onSeedChanged(val: string) {
    this.setState({ mnemonicSeed: val });
  }

  private onDisplayNameChanged(val: string) {
    const sanitizedName = this.sanitiseNameInput(val);
    this.setState({ displayName: sanitizedName });
  }

  private onPasswordChanged(val: string) {
    this.setState({ password: val });
    this.onValidatePassword(); // FIXME add bubbles or something to help the user know what he did wrong
  }

  private onPasswordVerifyChanged(val: string) {
    this.setState({ validatePassword: val });
  }

  private renderSections() {
    const { selectedTab } = this.state;
    if (selectedTab === TabType.Create) {
      return this.renderSignUp();
    }

    return this.renderSignIn();
  }

  private renderSignUp() {
    const { signUpMode } = this.state;
    switch (signUpMode) {
      case SignUpMode.Default:
        return (
          <div className="session-registration__content">
            {this.renderSignUpHeader()}
            {this.renderSignUpButton()}
          </div>
        );
      case SignUpMode.SessionIDShown:
        return (
          <div className="session-registration__content">
            {this.renderSignUpHeader()}
            <div className="session-registration__unique-session-id">
              {window.i18n('yourUniqueSessionID')}
            </div>
            {this.renderEnterSessionID(false, this.state.hexGeneratedPubKey)}
            {this.renderSignUpButton()}
            {this.getRenderTermsConditionAgreement()}
          </div>
        );

      default:
        return (
          <div className="session-registration__content">
            <div className="session-registration__welcome-session">
              {window.i18n('welcomeToYourSession')}
            </div>

            {this.renderRegistrationContent()}
            <SessionButton
              onClick={() => {
                this.onCompleteSignUpClick();
              }}
              buttonType={SessionButtonType.FullGreen}
              text={window.i18n('completeSignUp')}
            />
          </div>
        );
    }
  }

  private getRenderTermsConditionAgreement() {
    const { selectedTab, signInMode, signUpMode } = this.state;
    if (selectedTab === TabType.Create) {
      return signUpMode !== SignUpMode.Default
        ? this.renderTermsConditionAgreement()
        : null;
    } else {
      return signInMode !== SignInMode.Default
        ? this.renderTermsConditionAgreement()
        : null;
    }
  }

  private renderSignUpHeader() {
    const allUsersAreRandomly = window.i18n('allUsersAreRandomly...');

    return <div className="session-signup-header">{allUsersAreRandomly}</div>;
  }

  private renderSignUpButton() {
    const { signUpMode } = this.state;

    let buttonType: any;
    let buttonText: string;
    if (signUpMode !== SignUpMode.Default) {
      buttonType = SessionButtonType.FullGreen;
      buttonText = window.i18n('getStarted');
    } else {
      buttonType = SessionButtonType.Green;
      buttonText = window.i18n('generateSessionID');
    }

    return (
      <SessionButton
        onClick={() => {
          if (signUpMode === SignUpMode.Default) {
            this.onSignUpGenerateSessionIDClick().ignore();
          } else {
            this.onSignUpGetStartedClick();
          }
        }}
        buttonType={buttonType}
        text={buttonText}
      />
    );
  }

  private async onSignUpGenerateSessionIDClick() {
    this.setState(
      {
        signUpMode: SignUpMode.SessionIDShown,
      },
      () => {
        window.Session.setNewSessionID(this.state.hexGeneratedPubKey);
      }
    );
  }

  private onSignUpGetStartedClick() {
    this.setState({
      signUpMode: SignUpMode.EnterDetails,
    });
  }

  private onCompleteSignUpClick() {
    this.register('english').ignore();
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
    const { signInMode, signUpMode } = this.state;

    if (signInMode === SignInMode.UsingSeed) {
      return (
        <div className={classNames('session-registration__entry-fields')}>
          <SessionInput
            label={window.i18n('mnemonicSeed')}
            type="password"
            placeholder={window.i18n('enterSeed')}
            enableShowHide={true}
            onValueChanged={(val: string) => {
              this.onSeedChanged(val);
            }}
            onEnterPressed={() => {
              this.handlePressEnter();
            }}
          />
          {this.renderNamePasswordAndVerifyPasswordFields()}
        </div>
      );
    }
    if (signInMode === SignInMode.LinkingDevice) {
      return (
        <div className="">
          <div className="session-signin-device-pairing-header">
            {window.i18n('devicePairingHeader')}
          </div>
          {this.renderEnterSessionID(true)}
        </div>
      );
    }
    if (signUpMode === SignUpMode.EnterDetails) {
      return (
        <div className={classNames('session-registration__entry-fields')}>
          {this.renderNamePasswordAndVerifyPasswordFields()};
        </div>
      );
    }

    return null;
  }

  private renderNamePasswordAndVerifyPasswordFields() {
    return (
      <div className="inputfields">
        <SessionInput
          label={window.i18n('displayName')}
          type="text"
          placeholder={window.i18n('enterDisplayName')}
          value={this.state.displayName}
          onValueChanged={(val: string) => {
            this.onDisplayNameChanged(val);
          }}
          onEnterPressed={() => {
            this.handlePressEnter();
          }}
        />

        <SessionInput
          label={window.i18n('optionalPassword')}
          type="password"
          placeholder={window.i18n('enterOptionalPassword')}
          onValueChanged={(val: string) => {
            this.onPasswordChanged(val);
          }}
          onEnterPressed={() => {
            this.handlePressEnter();
          }}
        />

        <SessionInput
          label={window.i18n('verifyPassword')}
          type="password"
          placeholder={window.i18n('optionalPassword')}
          onValueChanged={(val: string) => {
            this.onPasswordVerifyChanged(val);
          }}
          onEnterPressed={() => {
            this.handlePressEnter();
          }}
        />
      </div>
    );
  }

  private renderEnterSessionID(contentEditable: boolean, text?: string) {
    const enterSessionIDHere = window.i18n('enterSessionIDHere');

    return (
      <div
        className="session-signin-enter-session-id"
        contentEditable={contentEditable}
        placeholder={enterSessionIDHere}
        onInput={(e: any) => {
          if (contentEditable) {
            this.onSecondDeviceSessionIDChanged(e);
          }
        }}
      >
        {text}
      </div>
    );
  }

  private onSecondDeviceSessionIDChanged(e: any) {
    e.preventDefault();
    const hexEncodedPubKey = e.target.innerHTML;
    this.setState({
      primaryDevicePubKey: hexEncodedPubKey,
    });
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;

    const or = window.i18n('or');

    if (signInMode === SignInMode.Default) {
      return (
        <div>
          {this.renderRestoreUsingSeedButton(SessionButtonType.Green)}
          <div className="session-registration__or">{or}</div>
          {this.renderLinkDeviceToExistingAccountButton()}
        </div>
      );
    }

    if (signInMode === SignInMode.LinkingDevice) {
      return (
        <div>
          {this.renderContinueYourSessionButton()}
          <div className="session-registration__or">{or}</div>
          {this.renderRestoreUsingSeedButton(SessionButtonType.White)}
        </div>
      );
    }

    return (
      <div>
        {this.renderContinueYourSessionButton()}
        <div className="session-registration__or">{or}</div>
        {this.renderLinkDeviceToExistingAccountButton()}
      </div>
    );
  }

  private renderTermsConditionAgreement() {
    // FIXME link to our Terms and Conditions and privacy statement

    return (
      <div className="session-terms-conditions-agreement">
        <SessionHtmlRenderer html={window.i18n('ByUsingThiService...')} />
      </div>
    );
  }

  private handleContinueYourSessionClick() {
    if (this.state.signInMode === SignInMode.UsingSeed) {
      this.register('english').ignore();
    } else {
      this.registerSecondaryDevice().ignore();
    }
  }

  private renderContinueYourSessionButton() {
    return (
      <SessionButton
        onClick={() => {
          this.handleContinueYourSessionClick();
        }}
        buttonType={SessionButtonType.FullGreen}
        text={window.i18n('continueYourSession')}
      />
    );
  }

  private renderRestoreUsingSeedButton(buttonType: SessionButtonType) {
    return (
      <SessionButton
        onClick={() => {
          this.cancelSecondaryDevice().ignore();
          this.setState({
            signInMode: SignInMode.UsingSeed,
            primaryDevicePubKey: '',
            mnemonicSeed: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={buttonType}
        text={window.i18n('restoreUsingSeed')}
      />
    );
  }

  private renderLinkDeviceToExistingAccountButton() {
    return (
      <SessionButton
        onClick={() => {
          this.setState({
            signInMode: SignInMode.LinkingDevice,
            mnemonicSeed: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={SessionButtonType.White}
        text={window.i18n('linkDeviceToExistingAccount')}
      />
    );
  }

  private handlePressEnter() {
    const { signInMode, signUpMode } = this.state;
    if (signUpMode === SignUpMode.EnterDetails) {
      this.onCompleteSignUpClick();

      return;
    }

    if (signInMode === SignInMode.UsingSeed) {
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
      return null;
    }

    const error = window.passwordUtil.validatePassword(input, window.i18n);
    if (error) {
      return error;
    }

    if (input !== confirmationInput) {
      return "Password don't match";
    }

    return null;
  }

  private onValidatePassword() {
    const passwordValidation = this.validatePassword();
    if (passwordValidation) {
      this.setState({ passwordErrorString: passwordValidation });
    } else {
      // Show green box around inputs that match
      const input = this.trim(this.state.password);
      const confirmationInput = this.trim(this.state.validatePassword);
      const passwordFieldsMatch =
        input !== undefined && input === confirmationInput;

      this.setState({
        passwordErrorString: '',
        passwordFieldsMatch,
      });
    }
  }

  private sanitiseNameInput(val: string) {
    return val.trim().replace(window.displayNameRegex, '');
  }

  private async resetRegistration() {
    await window.Signal.Data.removeAllIdentityKeys();
    await window.Signal.Data.removeAllPrivateConversations();
    window.Whisper.Registration.remove();
    // Do not remove all items since they are only set
    // at startup.
    window.textsecure.storage.remove('identityKey');
    window.textsecure.storage.remove('secondaryDeviceStatus');
    window.ConversationController.reset();
    await window.ConversationController.load();
    window.Whisper.RotateSignedPreKeyListener.stop(window.Whisper.events);
  }

  private async register(language: string) {
    const { password, mnemonicSeed, displayName } = this.state;
    // Make sure the password is valid
    if (this.validatePassword()) {
      //this.showToast(window.i18n('invalidPassword'));
      return;
    }
    if (!mnemonicSeed) {
      return;
    }
    if (!displayName) {
      return;
    }

    // Ensure we clear the secondary device registration status
    window.textsecure.storage.remove('secondaryDeviceStatus');

    try {
      await this.resetRegistration();

      await window.setPassword(password);
      await this.accountManager.registerSingleDevice(
        mnemonicSeed,
        language,
        displayName
      );
      trigger('openInbox');
    } catch (e) {
      if (typeof e === 'string') {
        //this.showToast(e);
      }
      //this.log(e);
    }
  }

  private async cancelSecondaryDevice() {
    window.Whisper.events.off(
      'secondaryDeviceRegistration',
      this.onSecondaryDeviceRegistered
    );

    await this.resetRegistration();
  }

  private async registerSecondaryDevice() {
    // tslint:disable-next-line: no-backbone-get-set-outside-model
    if (window.textsecure.storage.get('secondaryDeviceStatus') === 'ongoing') {
      return;
    }
    await this.resetRegistration();
    window.textsecure.storage.put('secondaryDeviceStatus', 'ongoing');

    const primaryPubKey = this.state.primaryDevicePubKey;

    // Ensure only one listener
    window.Whisper.events.off(
      'secondaryDeviceRegistration',
      this.onSecondaryDeviceRegistered
    );
    window.Whisper.events.once(
      'secondaryDeviceRegistration',
      this.onSecondaryDeviceRegistered
    );

    const onError = async (error: any) => {
      window.console.error(error);

      await this.resetRegistration();
    };

    const c = new window.Whisper.Conversation({
      id: primaryPubKey,
      type: 'private',
    });

    const validationError = c.validateNumber();
    if (validationError) {
      onError('Invalid public key').ignore();

      return;
    }
    try {
      const fakeMnemonic = this.state.mnemonicSeed;

      await this.accountManager.registerSingleDevice(
        fakeMnemonic,
        'english',
        null
      );

      await this.accountManager.requestPairing(primaryPubKey);
      const pubkey = window.textsecure.storage.user.getNumber();
      const words = window.mnemonic.pubkey_to_secret_words(pubkey);
      window.console.log('pubkey_to_secret_words');
      window.console.log(`Here is your secret:\n${words}`);
    } catch (e) {
      window.console.log(e);
      //onError(e);
    }
  }

  private async onSecondaryDeviceRegistered() {
    // Ensure the left menu is updated
    trigger('userChanged', { isSecondaryDevice: true });
    // will re-run the background initialisation
    trigger('registration_done');
    trigger('openInbox');
  }
}
