import React from 'react';
import classNames from 'classnames';

import { SessionInput } from './SessionInput';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { trigger } from '../../shims/events';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import { SessionIdEditable } from './SessionIdEditable';
import { SessionSpinner } from './SessionSpinner';
import { StringUtils, ToastUtils } from '../../session/utils';
import { lightTheme } from '../../state/ducks/SessionTheme';

enum SignInMode {
  Default,
  UsingRecoveryPhrase,
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
  secretWords: string | undefined;
  displayName: string;
  password: string;
  validatePassword: string;
  passwordErrorString: string;
  passwordFieldsMatch: boolean;
  recoveryPhrase: string;
  generatedRecoveryPhrase: string;
  hexGeneratedPubKey: string;
  primaryDevicePubKey: string;
  mnemonicError: string | undefined;
  displayNameError: string | undefined;
  loading: boolean;
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

export class RegistrationTabs extends React.Component<any, State> {
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
      secretWords: undefined,
      displayName: '',
      password: '',
      validatePassword: '',
      passwordErrorString: '',
      passwordFieldsMatch: false,
      recoveryPhrase: '',
      generatedRecoveryPhrase: '',
      hexGeneratedPubKey: '',
      primaryDevicePubKey: '',
      mnemonicError: undefined,
      displayNameError: undefined,
      loading: false,
    };

    this.accountManager = window.getAccountManager();
    // Clean status in case the app closed unexpectedly
  }

  public componentDidMount() {
    this.generateMnemonicAndKeyPair().ignore();
    window.textsecure.storage.remove('secondaryDeviceStatus');
    this.resetRegistration().ignore();
  }

  public render() {
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

  private async generateMnemonicAndKeyPair() {
    if (this.state.generatedRecoveryPhrase === '') {
      const language = 'english';
      const mnemonic = await this.accountManager.generateMnemonic(language);

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
      recoveryPhrase: '',
      primaryDevicePubKey: '',
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
            {this.renderEnterSessionID(false)}
            {this.renderSignUpButton()}
            {this.getRenderTermsConditionAgreement()}
          </div>
        );

      default:
        const {
          passwordErrorString,
          passwordFieldsMatch,
          displayNameError,
          displayName,
          password,
        } = this.state;

        let enableCompleteSignUp = true;
        const displayNameOK = !displayNameError && !!displayName; //display name required
        const passwordsOK =
          !password || (!passwordErrorString && passwordFieldsMatch); // password is valid if empty, or if no error and fields are matching

        enableCompleteSignUp = displayNameOK && passwordsOK;

        return (
          <div className="session-registration__content">
            <div className="session-registration__welcome-session">
              {window.i18n('welcomeToYourSession')}
            </div>

            {this.renderRegistrationContent()}
            <SessionButton
              onClick={this.onCompleteSignUpClick}
              buttonType={SessionButtonType.Brand}
              buttonColor={SessionButtonColor.Green}
              text={window.i18n('getStarted')}
              disabled={!enableCompleteSignUp}
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

    return (
      <div className="session-description-long">{allUsersAreRandomly}</div>
    );
  }

  private renderSignUpButton() {
    const { signUpMode } = this.state;

    let buttonType: SessionButtonType;
    let buttonColor: SessionButtonColor;
    let buttonText: string;
    if (signUpMode !== SignUpMode.Default) {
      buttonType = SessionButtonType.Brand;
      buttonColor = SessionButtonColor.Green;
      buttonText = window.i18n('continue');
    } else {
      buttonType = SessionButtonType.BrandOutline;
      buttonColor = SessionButtonColor.Green;
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
        buttonColor={buttonColor}
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

    if (signInMode === SignInMode.UsingRecoveryPhrase) {
      return (
        <div className={classNames('session-registration__entry-fields')}>
          <SessionInput
            label={window.i18n('recoveryPhrase')}
            type="password"
            autoFocus={true}
            placeholder={window.i18n('enterRecoveryPhrase')}
            enableShowHide={true}
            onValueChanged={(val: string) => {
              this.onSeedChanged(val);
            }}
            onEnterPressed={() => {
              this.handlePressEnter();
            }}
            theme={lightTheme}
          />
          {this.renderNamePasswordAndVerifyPasswordFields(false)}
        </div>
      );
    }
    if (signInMode === SignInMode.LinkingDevice) {
      return (
        <div className="registration-content-centered">
          <div className="session-signin-device-pairing-header">
            {!!this.state.secretWords ? (
              <p>{window.i18n('devicePairingHeaderReassure')}</p>
            ) : (
              <ol>
                <li>
                  <SessionHtmlRenderer
                    html={window.i18n('devicePairingHeader_Step1')}
                  />
                </li>
                <li>
                  <SessionHtmlRenderer
                    html={window.i18n('devicePairingHeader_Step2')}
                  />
                </li>
                <li>
                  <SessionHtmlRenderer
                    html={window.i18n('devicePairingHeader_Step3')}
                  />
                </li>
                <li>
                  <SessionHtmlRenderer
                    html={window.i18n('devicePairingHeader_Step4')}
                  />
                </li>
              </ol>
            )}
          </div>
          {this.renderEnterSessionID(!this.state.secretWords)}
          {this.state.secretWords && (
            <div
              className={classNames(
                'session-registration__content__secret-words',
                'session-info-box'
              )}
            >
              <label>Secret words</label>
              <div className="subtle">{this.state.secretWords}</div>
            </div>
          )}
          <SessionSpinner loading={!!this.state.secretWords} />
        </div>
      );
    }
    if (signUpMode === SignUpMode.EnterDetails) {
      return (
        <div className={classNames('session-registration__entry-fields')}>
          {this.renderNamePasswordAndVerifyPasswordFields(true)}
        </div>
      );
    }

    return null;
  }

  private renderNamePasswordAndVerifyPasswordFields(
    stealAutoFocus: boolean = false
  ) {
    const { password, passwordFieldsMatch } = this.state;
    const passwordsDoNotMatch =
      !passwordFieldsMatch && this.state.password
        ? window.i18n('passwordsDoNotMatch')
        : undefined;

    return (
      <div className="inputfields">
        <SessionInput
          autoFocus={stealAutoFocus}
          label={window.i18n('displayName')}
          type="text"
          placeholder={window.i18n('enterDisplayName')}
          value={this.state.displayName}
          maxLength={window.CONSTANTS.MAX_USERNAME_LENGTH}
          onValueChanged={(val: string) => {
            this.onDisplayNameChanged(val);
          }}
          onEnterPressed={() => {
            this.handlePressEnter();
          }}
          theme={lightTheme}
        />

        <SessionInput
          label={window.i18n('password')}
          error={this.state.passwordErrorString}
          type="password"
          placeholder={window.i18n('enterOptionalPassword')}
          maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
          onValueChanged={(val: string) => {
            this.onPasswordChanged(val);
          }}
          onEnterPressed={() => {
            this.handlePressEnter();
          }}
          theme={lightTheme}
        />

        {!!password && (
          <SessionInput
            label={window.i18n('confirmPassword')}
            error={passwordsDoNotMatch}
            type="password"
            placeholder={window.i18n('confirmPassword')}
            maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
            onValueChanged={(val: string) => {
              this.onPasswordVerifyChanged(val);
            }}
            onEnterPressed={() => {
              this.handlePressEnter();
            }}
            theme={lightTheme}
          />
        )}
      </div>
    );
  }

  private renderEnterSessionID(contentEditable: boolean) {
    const enterSessionIDHere = window.i18n('enterSessionIDHere');

    return (
      <SessionIdEditable
        editable={contentEditable}
        placeholder={enterSessionIDHere}
        onChange={(value: string) => {
          this.onSecondDeviceSessionIDChanged(value);
        }}
      />
    );
  }

  private onSecondDeviceSessionIDChanged(value: string) {
    this.setState({
      primaryDevicePubKey: value,
    });
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;

    const or = window.i18n('or');

    if (signInMode === SignInMode.Default) {
      return (
        <div>
          {this.renderRestoreUsingRecoveryPhraseButton(
            SessionButtonType.BrandOutline,
            SessionButtonColor.Green
          )}
          {window.lokiFeatureFlags.useMultiDevice && (
            <>
              <h4>{or}</h4>
              {this.renderLinkDeviceToExistingAccountButton()}
            </>
          )}
        </div>
      );
    }

    if (signInMode === SignInMode.LinkingDevice) {
      return (
        <div>
          {this.renderContinueYourSessionButton()}
          {!this.state.secretWords && (
            <>
              <h4>{or}</h4>
              {this.renderRestoreUsingRecoveryPhraseButton(
                SessionButtonType.BrandOutline,
                SessionButtonColor.White
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <div>
        {this.renderContinueYourSessionButton()}
        {window.lokiFeatureFlags.useMultiDevice && (
          <>
            <h4>{or}</h4>
            {this.renderLinkDeviceToExistingAccountButton()}
          </>
        )}
      </div>
    );
  }

  private renderTermsConditionAgreement() {
    return (
      <div className="session-terms-conditions-agreement">
        <SessionHtmlRenderer html={window.i18n('ByUsingThisService...')} />
      </div>
    );
  }

  private handleContinueYourSessionClick() {
    if (this.state.signInMode === SignInMode.UsingRecoveryPhrase) {
      this.register('english').ignore();
    } else {
      this.registerSecondaryDevice().ignore();
    }
  }

  private renderContinueYourSessionButton() {
    const {
      signUpMode,
      signInMode,
      passwordErrorString,
      passwordFieldsMatch,
      displayNameError,
      mnemonicError,
      primaryDevicePubKey,
      displayName,
      recoveryPhrase,
      password,
    } = this.state;

    let enableContinue = true;
    let text = window.i18n('continueYourSession');
    const displayNameOK = !displayNameError && !!displayName; // Display name required
    const mnemonicOK = !mnemonicError && !!recoveryPhrase; // Mnemonic required
    const passwordsOK =
      !password || (!passwordErrorString && passwordFieldsMatch); // password is valid if empty, or if no error and fields are matching
    if (signInMode === SignInMode.UsingRecoveryPhrase) {
      enableContinue = displayNameOK && mnemonicOK && passwordsOK;
    } else if (signInMode === SignInMode.LinkingDevice) {
      enableContinue = !!primaryDevicePubKey;
      text = window.i18n('linkDevice');
    } else if (signUpMode === SignUpMode.EnterDetails) {
      enableContinue = displayNameOK && passwordsOK;
    }

    const shouldRenderCancel =
      this.state.signInMode === SignInMode.LinkingDevice &&
      !!this.state.secretWords;

    text = shouldRenderCancel ? window.i18n('cancel') : text;
    const buttonColor = shouldRenderCancel
      ? SessionButtonColor.White
      : SessionButtonColor.Green;
    const buttonType = shouldRenderCancel
      ? SessionButtonType.BrandOutline
      : SessionButtonType.Brand;
    const onClick = () => {
      shouldRenderCancel
        ? this.cancelSecondaryDevice()
        : this.handleContinueYourSessionClick();
    };

    return (
      <SessionButton
        onClick={onClick}
        buttonType={buttonType}
        buttonColor={buttonColor}
        text={text}
        disabled={!enableContinue}
      />
    );
  }

  private renderRestoreUsingRecoveryPhraseButton(
    buttonType: SessionButtonType,
    buttonColor: SessionButtonColor
  ) {
    return (
      <SessionButton
        onClick={() => {
          this.cancelSecondaryDevice().ignore();
          this.setState({
            signInMode: SignInMode.UsingRecoveryPhrase,
            primaryDevicePubKey: '',
            recoveryPhrase: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={buttonType}
        buttonColor={buttonColor}
        text={window.i18n('restoreUsingRecoveryPhrase')}
      />
    );
  }

  private renderLinkDeviceToExistingAccountButton() {
    return (
      <SessionButton
        onClick={() => {
          this.setState({
            signInMode: SignInMode.LinkingDevice,
            recoveryPhrase: '',
            displayName: '',
            signUpMode: SignUpMode.Default,
          });
        }}
        buttonType={SessionButtonType.BrandOutline}
        buttonColor={SessionButtonColor.White}
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

    const error = window.passwordUtil.validatePassword(input, window.i18n);
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
    await window.Signal.Data.removeAll();
    await window.storage.fetch();
    window.ConversationController.reset();
    await window.ConversationController.load();
    window.Whisper.RotateSignedPreKeyListener.stop(window.Whisper.events);

    this.setState({
      loading: false,
      secretWords: undefined,
    });
  }

  private async register(language: string) {
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

    // Ensure we clear the secondary device registration status
    window.textsecure.storage.remove('secondaryDeviceStatus');

    const seedToUse =
      signInMode === SignInMode.UsingRecoveryPhrase
        ? recoveryPhrase
        : generatedRecoveryPhrase;

    try {
      await this.resetRegistration();

      await window.setPassword(password);
      await this.accountManager.registerSingleDevice(
        seedToUse,
        language,
        trimName
      );
      trigger('openInbox');
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

  private async cancelSecondaryDevice() {
    window.Whisper.events.off(
      'secondaryDeviceRegistration',
      this.onSecondaryDeviceRegistered
    );

    await this.resetRegistration();
  }

  private async registerSecondaryDevice() {
    window.log.warn('starting registerSecondaryDevice');

    // tslint:disable-next-line: no-backbone-get-set-outside-model
    if (window.textsecure.storage.get('secondaryDeviceStatus') === 'ongoing') {
      window.log.warn('registering secondary device already ongoing');
      ToastUtils.pushToastError(
        'pairingOngoing',
        window.i18n('pairingOngoing')
      );
      return;
    }
    this.setState({
      loading: true,
    });
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
      window.log.error(error);
      // clear the ... to make sure the user realize we're not doing anything
      this.setState({
        loading: false,
      });
      await this.resetRegistration();
    };

    const c = new window.Whisper.Conversation({
      id: primaryPubKey,
      type: 'private',
    });

    const validationError = c.validateNumber();
    if (validationError) {
      onError('Invalid public key').ignore();
      ToastUtils.pushToastError(
        'invalidNumberError',
        window.i18n('invalidNumberError')
      );
      return;
    }
    try {
      const fakeMnemonic = this.state.recoveryPhrase;

      await this.accountManager.registerSingleDevice(
        fakeMnemonic,
        'english',
        null
      );

      await this.accountManager.requestPairing(primaryPubKey);
      const pubkey = window.textsecure.storage.user.getNumber();
      const secretWords = window.mnemonic.pubkey_to_secret_words(pubkey);
      this.setState({ secretWords });
    } catch (e) {
      window.log.log(e);
      await this.resetRegistration();

      this.setState({
        loading: false,
      });
    }
  }

  private async onSecondaryDeviceRegistered() {
    // Ensure the left menu is updated
    this.setState({
      loading: false,
    });
    trigger('userChanged', { isSecondaryDevice: true });
    // will re-run the background initialisation
    trigger('registration_done');
    trigger('openInbox');
  }
}
