import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';
import { SessionInput } from './SessionInput';
import { SessionButton, SessionButtonTypes } from './SessionButton';

interface Props {
  i18n: LocalizerType;
  //onItemClick?: (event: ItemClickEvent) => void;
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
  seed: string;
  displayName: string;
  password: string;
  validatePassword: string;
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
  constructor(props: any) {
    super(props);

    this.onSeedChanged = this.onSeedChanged.bind(this);
    this.onDisplayNameChanged = this.onDisplayNameChanged.bind(this);
    this.onPasswordChanged = this.onPasswordChanged.bind(this);
    this.onPasswordVerifyChanged = this.onPasswordVerifyChanged.bind(this);

    this.state = {
      selectedTab: 'create',
      signInMode: SignInMode.Default,
      signUpMode: SignUpMode.Default,
      seed: '',
      displayName: '',
      password: '',
      validatePassword: '',
    };
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
    this.setState({ seed: val });
  }

  private onDisplayNameChanged(val: string) {
    this.setState({ displayName: val });
  }

  private onPasswordChanged(val: string) {
    this.setState({ password: val });
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
          {this.renderEnterSessionID(false)}
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
        onClick={() => {
          this.setState({
            signUpMode: SignUpMode.SessionIDGenerated,
          });
        }}
        buttonType={buttonType}
        text={buttonText}
      />
    );
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
            value={this.state.seed}
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

  private renderEnterSessionID(contentEditable: boolean) {
    const { i18n } = this.props;
    const enterSessionIDHere = i18n('enterSessionIDHere');

    return (
      <div
        className="session-signin-enter-session-id"
        contentEditable={contentEditable}
        placeholder={enterSessionIDHere}
      />
    );
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;
    const { i18n } = this.props;

    const or = i18n('or');
    let greenButtonType: any;
    let greenText: string;
    let whiteButtonText: string;
    if (signInMode !== SignInMode.Default) {
      greenButtonType = SessionButtonTypes.FullGreen;
      greenText = i18n('continueYourSession');
    } else {
      greenButtonType = SessionButtonTypes.Green;
      greenText = i18n('restoreUsingSeed');
    }
    if (signInMode === SignInMode.LinkingDevice) {
      whiteButtonText = i18n('restoreUsingSeed');
    } else {
      whiteButtonText = i18n('linkDeviceToExistingAccount');
    }

    return (
      <div>
        <SessionButton
          onClick={() => {
            this.setState({
              signInMode: SignInMode.UsingSeed,
            });
          }}
          buttonType={greenButtonType}
          text={greenText}
        />
        <div className="session-registration__or">{or}</div>
        <SessionButton
          onClick={() => {
            this.setState({
              signInMode: SignInMode.LinkingDevice,
            });
          }}
          buttonType={SessionButtonTypes.White}
          text={whiteButtonText}
        />
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
}
