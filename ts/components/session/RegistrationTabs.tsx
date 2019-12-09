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
        'registration-container__tab',
        isSelected ? 'registration-container__tab--active' : null
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

    return (
      <div className="registration-container">
        <div className="registration-container__tab-container">
          <Tab
            label="Create Account"
            type="create"
            isSelected={selectedTab === 'create'}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label="Sign In"
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
    return (
      <div className="registration-container__content">
        {this.renderSignUpHeader()}

        {this.renderSignUpButton()}
        {this.getRenderTermsConditionAgreement()}
      </div>
    );
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
    return (
      <div className="signup-header">
        All users are randomly generated a set of numbers that act as their
        unique Session ID. Share your Session ID in order to chat with your
        friends!
      </div>
    );
  }

  private renderSignUpButton() {
    const { signUpMode } = this.state;

    let buttonType: any;
    let buttonText: string;
    if (signUpMode !== SignUpMode.Default) {
      buttonType = SessionButtonTypes.FullGreen;
      buttonText = 'Continue Your Session';
    } else {
      buttonType = SessionButtonTypes.Green;
      buttonText = 'Restore Using Seed';
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
      <div className="registration-container__content">
        {this.renderRegistrationContent()}

        {this.renderSignInButtons()}
        {this.getRenderTermsConditionAgreement()}
      </div>
    );
  }

  private renderRegistrationContent() {
    const { signInMode } = this.state;

    if (signInMode === SignInMode.UsingSeed) {
      return (
        <div className={classNames('entry-fields')}>
          <SessionInput
            label="Mnemonic Seed"
            type="password"
            placeholder="Enter Seed"
            i18n={this.props.i18n}
            value={this.state.seed}
            enableShowHide={true}
            onValueChanged={(val: string) => {
              this.onSeedChanged(val);
            }}
          />
          <SessionInput
            label="Display Name"
            type="text"
            placeholder="Enter Optional Display Name"
            i18n={this.props.i18n}
            value={this.state.displayName}
            onValueChanged={(val: string) => {
              this.onDisplayNameChanged(val);
            }}
          />
          <SessionInput
            label="Optional Password"
            type="password"
            placeholder="Enter Optional Password"
            i18n={this.props.i18n}
            onValueChanged={(val: string) => {
              this.onPasswordChanged(val);
            }}
          />
          <SessionInput
            label="Verify Password"
            type="password"
            placeholder="Optional Password"
            i18n={this.props.i18n}
            onValueChanged={(val: string) => {
              this.onPasswordVerifyChanged(val);
            }}
          />
        </div>
      );
    } else if (signInMode === SignInMode.LinkingDevice) {
      return (
        <div className="">
          <div className="signin-device-pairing-header">
            Open the Loki Messenger App on your primary device and select
            "Device Pairing" from the main menu. Then, enter your Session ID
            below to sign in.
          </div>
          {this.renderEnterSessionID()}
        </div>
      );
    } else {
      return <div />;
    }
  }

  private renderEnterSessionID() {
    return (
      <div
        className="signin-enter-session-id"
        contentEditable={true}
        placeholder="Enter your Session ID here"
      />
    );
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;

    let greenButtonType: any;
    let greenText: string;
    let whiteButtonText: string;
    if (signInMode !== SignInMode.Default) {
      greenButtonType = SessionButtonTypes.FullGreen;
      greenText = 'Continue Your Session';
    } else {
      greenButtonType = SessionButtonTypes.Green;
      greenText = 'Restore Using Seed';
    }
    if (signInMode === SignInMode.LinkingDevice) {
      whiteButtonText = 'Restore Using Seed';
    } else {
      whiteButtonText = 'Link Device To Existing Account';
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
        <div className="or-signin-buttons">or</div>
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
    return (
      <div className="terms-conditions-agreement">
        By using this service, you agree to our <a>Terms and Conditions</a> and{' '}
        <a>Privacy Statement</a>
      </div>
    );
    // FIXME link to our Terms and Conditions and privacy statement
  }
}
