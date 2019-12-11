import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';
import { SessionInput } from './SessionInput';
import { SessionButton, SessionButtonTypes } from './SessionButton';
import { trigger } from '../../shims/events';

interface Props {
  i18n: LocalizerType;
}

enum SignInMode {
  Default = 'Default',
  UsingSeed = 'UsingSeed',
  LinkingDevice = 'LinkingDevice',
}

enum SignUpMode {
  Default = 'Default',
  SessionIDGenerated = 'SessionIDGenerated',
}
interface State {
  selectedTab: 'create' | 'signin';
  signInMode: SignInMode;
  signUpMode: SignUpMode;
  displayName: string;
  password: string;
  validatePassword: string;
  passwordErrorString: string;
  passwordFieldsMatch: boolean;
  mnemonicSeed: string;
  hexEncodedPubKey: string;
}

interface TabSelectEvent {
  type: 'create' | 'signin';
}

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: TabSelectEvent) => void;
  type: 'create' | 'signin';
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect({ type });
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

export class RegistrationTabs extends React.Component<Props, State> {
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

    this.state = {
      selectedTab: 'create',
      signInMode: SignInMode.Default,
      signUpMode: SignUpMode.Default,
      displayName: '',
      password: '',
      validatePassword: '',
      passwordErrorString: '',
      passwordFieldsMatch: false,
      mnemonicSeed: '',
      hexEncodedPubKey: '',
    };

    this.accountManager = window.getAccountManager();
    // Clean status in case the app closed unexpectedly
    window.textsecure.storage.remove('secondaryDeviceStatus');
  }

  public render() {
    return this.renderTabs();
  }

  private renderTabs() {
    const { selectedTab } = this.state;
    const { i18n } = this.props;

    const createAccount = i18n('createAccount');
    const signIn = i18n('signIn');

    return (
      <div className="session-registration-container">
        <div className="session-registration__tab-container">
          <Tab
            label={createAccount}
            type="create"
            isSelected={selectedTab === 'create'}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label={signIn}
            type="signin"
            isSelected={selectedTab === 'signin'}
            onSelect={this.handleTabSelect}
          />
        </div>
        {this.renderSections()}
      </div>
    );
  }

  private readonly handleTabSelect = (event: TabSelectEvent): void => {
    this.setState({ selectedTab: event.type });
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
    if (selectedTab === 'create') {
      return this.renderSignUp();
    }

    return this.renderSignIn();
  }

  private renderSignUp() {
    const { signUpMode } = this.state;
    const { i18n } = this.props;
    if (signUpMode === SignUpMode.Default) {
      return (
        <div className="session-registration__content">
          {this.renderSignUpHeader()}
          {this.renderSignUpButton()}
        </div>
      );
    } else {
      return (
        <div className="session-registration__content">
          {this.renderSignUpHeader()}
          <div className="session-registration__unique-session-id">
            {i18n('yourUniqueSessionID')}
          </div>
          {this.renderEnterSessionID(false, this.state.hexEncodedPubKey)}
          {this.renderSignUpButton()}
          {this.getRenderTermsConditionAgreement()}
        </div>
      );
    }
  }

  private getRenderTermsConditionAgreement() {
    const { selectedTab, signInMode, signUpMode } = this.state;
    if (selectedTab === 'create') {
      if (signUpMode !== SignUpMode.Default) {
        return this.renderTermsConditionAgreement();
      } else {
        return null;
      }
    } else {
      if (signInMode !== SignInMode.Default) {
        return this.renderTermsConditionAgreement();
      } else {
        return null;
      }
    }
  }

  private renderSignUpHeader() {
    const allUsersAreRandomly = this.props.i18n('allUsersAreRandomly...');

    return <div className="session-signup-header">{allUsersAreRandomly}</div>;
  }

  private renderSignUpButton() {
    const { signUpMode } = this.state;
    const { i18n } = this.props;

    let buttonType: any;
    let buttonText: string;
    if (signUpMode !== SignUpMode.Default) {
      buttonType = SessionButtonTypes.FullGreen;
      buttonText = i18n('getStarted');
    } else {
      buttonType = SessionButtonTypes.Green;
      buttonText = i18n('generateSessionID');
    }

    return (
      <SessionButton
        onClick={async () => {
          if (signUpMode === SignUpMode.Default) {
            await this.onSignUpGenerateSessionIDClick();
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
    this.setState({
      signUpMode: SignUpMode.SessionIDGenerated,
    });

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
    const hexEncodedPubKey = Buffer.from(keyPair.pubKey).toString('hex');

    this.setState({
      mnemonicSeed: mnemonic,
      hexEncodedPubKey, // our 'frontend' sessionID
    });
  }

  private onSignUpGetStartedClick() {
    this.setState({
      selectedTab: 'signin',
      signInMode: SignInMode.UsingSeed,
    });
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
    const { i18n } = this.props;

    if (signInMode === SignInMode.UsingSeed) {
      return (
        <div className={classNames('session-registration__entry-fields')}>
          <SessionInput
            label={i18n('mnemonicSeed')}
            type="password"
            placeholder={i18n('enterSeed')}
            value={this.state.mnemonicSeed}
            enableShowHide={true}
            onValueChanged={(val: string) => {
              this.onSeedChanged(val);
            }}
          />
          <SessionInput
            label={i18n('displayName')}
            type="text"
            placeholder={i18n('enterOptionalDisplayName')}
            value={this.state.displayName}
            onValueChanged={(val: string) => {
              this.onDisplayNameChanged(val);
            }}
          />
          <SessionInput
            label={i18n('optionalPassword')}
            type="password"
            placeholder={i18n('enterOptionalPassword')}
            onValueChanged={(val: string) => {
              this.onPasswordChanged(val);
            }}
          />

          <SessionInput
            label={i18n('verifyPassword')}
            type="password"
            placeholder={i18n('optionalPassword')}
            onValueChanged={(val: string) => {
              this.onPasswordVerifyChanged(val);
            }}
          />
        </div>
      );
    } else if (signInMode === SignInMode.LinkingDevice) {
      return (
        <div className="">
          <div className="session-signin-device-pairing-header">
            {i18n('devicePairingHeader')}
          </div>
          {this.renderEnterSessionID(true)}
        </div>
      );
    } else {
      return <div />;
    }
  }

  private renderEnterSessionID(contentEditable: boolean, text?: string) {
    const { i18n } = this.props;
    const enterSessionIDHere = i18n('enterSessionIDHere');

    return (
      <div
        className="session-signin-enter-session-id"
        contentEditable={contentEditable}
        placeholder={enterSessionIDHere}
      >
        {text}
      </div>
    );
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;
    const { i18n } = this.props;

    const or = i18n('or');

    if (signInMode === SignInMode.Default) {
      return (
        <div>
          {this.renderRestoreUsingSeedButton(SessionButtonTypes.Green)}
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
          {this.renderRestoreUsingSeedButton(SessionButtonTypes.White)}
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
    // FIXME find a better way than dangerouslySetInnerHTML to set this in a localized way

    return (
      <div className="session-terms-conditions-agreement">
        By using this service, you agree to our <a>Terms and Conditions</a> and{' '}
        <a>Privacy Statement</a>
      </div>
    );
  }

  private renderContinueYourSessionButton() {
    return (
      <SessionButton
        // tslint:disable-next-line: no-empty
        onClick={async () => {
          await this.register('english');
        }}
        buttonType={SessionButtonTypes.FullGreen}
        text={this.props.i18n('continueYourSession')}
      />
    );
  }

  private renderRestoreUsingSeedButton(buttonType: SessionButtonTypes) {
    return (
      <SessionButton
        onClick={() => {
          this.setState({
            signInMode: SignInMode.UsingSeed,
            hexEncodedPubKey: '',
            mnemonicSeed: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={buttonType}
        text={this.props.i18n('restoreUsingSeed')}
      />
    );
  }

  private renderLinkDeviceToExistingAccountButton() {
    return (
      <SessionButton
        onClick={() => {
          this.setState({
            signInMode: SignInMode.LinkingDevice,
            hexEncodedPubKey: '',
            mnemonicSeed: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={SessionButtonTypes.White}
        text={this.props.i18n('linkDeviceToExistingAccount')}
      />
    );
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

    const error = window.passwordUtil.validatePassword(input, this.props.i18n);
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

      /*this.$passwordInput.addClass('error-input');
      this.$passwordConfirmationInput.addClass('error-input');

      this.$passwordInput.removeClass('match-input');
      this.$passwordConfirmationInput.removeClass('match-input');

      this.$passwordInputError.text(passwordValidation);
      this.$passwordInputError.show();*/
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

      /*
      this.$passwordInput.addClass('match-input'); //if password matches each other
      this.$passwordInput.removeClass('error-input');
      this.$passwordConfirmationInput.removeClass('error-input');
      this.$passwordInputError.text('');
      this.$passwordInputError.hide();*/
    }
  }

  private sanitiseNameInput(val: string) {
    return val.trim().replace(window.displayNameRegex, '');

    /* if (_.isEmpty(newVal)) {
      this.$('#save-button').attr('disabled', 'disabled');

    }
    this.$('#save-button').removeAttr('disabled'); */
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
      //this.showToast(i18n('invalidPassword'));

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
}
