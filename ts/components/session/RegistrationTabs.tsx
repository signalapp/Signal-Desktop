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

interface State {
  selectedTab: 'create' | 'signin';
  signInMode: SignInMode;
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
      return <div className="">TODO CREATE</div>;
    }

    return this.renderSignIn();
  }

  private renderSignIn() {
    const { signInMode } = this.state;

    return (
      <div className="registration-container__content">

        <div className={classNames(
          "entry-fields",
          signInMode !== SignInMode.UsingSeed ? 'gone' : '')
        }>
          <SessionInput
            label="Mnemonic Seed"
            type="password"
            placeholder="Enter Seed"
            i18n={this.props.i18n}
            value={this.state.seed}
            enableShowHide={true}
            onValueChanged={(val: string) => this.onSeedChanged(val)}
          />
          <SessionInput
            label="Display Name"
            type="text"
            placeholder="Enter Optional Display Name"
            i18n={this.props.i18n}
            value={this.state.displayName}
            onValueChanged={(val: string) => this.onDisplayNameChanged(val)}

          />
          <SessionInput
            label="Optional Password"
            type="password"
            placeholder="Enter Optional Password"
            i18n={this.props.i18n}
            onValueChanged={(val: string) => this.onPasswordChanged(val)}

          />
          <SessionInput
            label="Verify Password"
            type="password"
            placeholder="Optional Password"
            i18n={this.props.i18n}
            onValueChanged={(val: string) => this.onPasswordVerifyChanged(val)}

          />

        </div>

        {this.renderSignInButtons()}
        {this.renderTermsConditionAgreement()}

      </div>);
  }

  private renderSignInButtons() {
    const { signInMode } = this.state;

    let greenButtonType: any;
    let greenText: string;
    let whiteButtonText: string;
    if (signInMode !== SignInMode.Default) {
      greenButtonType = SessionButtonTypes.FullGreen;
      greenText = 'Continue Your Session';
    }
    else {
      greenButtonType = SessionButtonTypes.Green;
      greenText = 'Restore Using Seed';
    }
    if (signInMode === SignInMode.LinkingDevice) {
      whiteButtonText = 'Restore Using Seed'
    }
    else {
      whiteButtonText = 'Link Device To Existing Account'
    }

    return (
      <div>
        <SessionButton
          onClick={() => {
            this.setState({
              signInMode: SignInMode.UsingSeed
            })
          }}
          buttonType={greenButtonType}
          text={greenText}
        />
        <div className='or-signin-buttons'>or</div>
        <SessionButton
          onClick={() => {
            this.setState({
              signInMode: SignInMode.LinkingDevice
            })
          }}
          buttonType={SessionButtonTypes.White}
          text={whiteButtonText}
        />
      </div>);
  }

  private renderTermsConditionAgreement() {
    return (
      <div className='terms-conditions-agreement'>
        By using this service, you agree to our <a>Terms and Conditions</a> and <a>Privacy Statement</a>
      </div>
    )
    // FIXME link to our Terms and Conditions and privacy statement
  };
}
