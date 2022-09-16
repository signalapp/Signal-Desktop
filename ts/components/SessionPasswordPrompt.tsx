import React from 'react';
import classNames from 'classnames';

import { SessionIcon } from './icon';
import { withTheme } from 'styled-components';
import autoBind from 'auto-bind';
import { SessionButton, SessionButtonColor } from './basic/SessionButton';
import { Constants } from '../session';
import { SessionSpinner } from './basic/SessionSpinner';

interface State {
  error: string;
  errorCount: number;
  clearDataView: boolean;
  loading: boolean;
}

export const MAX_LOGIN_TRIES = 3;

const TextPleaseWait = (props: { isLoading: boolean }) => {
  if (!props.isLoading) {
    return null;
  }
  return <div>{window.i18n('pleaseWaitOpenAndOptimizeDb')}</div>;
};

class SessionPasswordPromptInner extends React.PureComponent<{}, State> {
  private inputRef?: any;

  constructor(props: any) {
    super(props);

    this.state = {
      error: '',
      errorCount: 0,
      clearDataView: false,
      loading: false,
    };

    autoBind(this);
  }

  public componentDidMount() {
    setTimeout(() => {
      this.inputRef?.focus();
    }, 100);
  }

  public render() {
    const showResetElements = this.state.errorCount >= MAX_LOGIN_TRIES;
    const isLoading = this.state.loading;

    const wrapperClass = this.state.clearDataView
      ? 'clear-data-wrapper'
      : 'password-prompt-wrapper';
    const containerClass = this.state.clearDataView
      ? 'clear-data-container'
      : 'password-prompt-container';
    const infoAreaClass = this.state.clearDataView ? 'warning-info-area' : 'password-info-area';
    const infoTitle = this.state.clearDataView
      ? window.i18n('clearAllData')
      : window.i18n('passwordViewTitle');
    const buttonGroup = this.state.clearDataView
      ? this.renderClearDataViewButtons()
      : this.renderPasswordViewButtons();
    const featureElement = this.state.clearDataView ? (
      <p className="text-center">{window.i18n('deleteAccountWarning')}</p>
    ) : (
      <input
        id="password-prompt-input"
        type="password"
        defaultValue=""
        placeholder={' '}
        onKeyUp={this.onKeyUp}
        ref={input => {
          this.inputRef = input;
        }}
      />
    );
    const infoIcon = this.state.clearDataView ? (
      <SessionIcon iconType="warning" iconSize={35} iconColor="#ce0000" />
    ) : (
      <SessionIcon iconType="lock" iconSize={35} iconColor={Constants.UI.COLORS.GREEN} />
    );
    const errorSection = !this.state.clearDataView && (
      <div className="password-prompt-error-section">
        {this.state.error && (
          <>
            {showResetElements ? (
              <div className="session-label warning">{window.i18n('maxPasswordAttempts')}</div>
            ) : (
              <div className="session-label primary">{this.state.error}</div>
            )}
          </>
        )}
      </div>
    );
    const spinner = isLoading ? <SessionSpinner loading={true} /> : null;

    return (
      <div className="password">
        <div className={wrapperClass}>
          <div className={containerClass}>
            <div className={infoAreaClass}>
              {infoIcon}

              <h1>{infoTitle}</h1>
            </div>
            {spinner || featureElement}
            <TextPleaseWait isLoading={isLoading} />

            {errorSection}
            {buttonGroup}
          </div>
        </div>
      </div>
    );
  }

  public onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.initLogin();
        break;
      default:
    }
    event.preventDefault();
  }

  public async onLogin(passPhrase: string) {
    const passPhraseTrimmed = passPhrase.trim();

    try {
      await window.onLogin(passPhraseTrimmed);
    } catch (error) {
      // Increment the error counter and show the button if necessary
      this.setState({
        errorCount: this.state.errorCount + 1,
      });

      this.setState({ error });
      global.setTimeout(() => {
        document.getElementById('password-prompt-input')?.focus();
      }, 50);
    }
    this.setState({
      loading: false,
    });
  }

  private initLogin() {
    this.setState({
      loading: true,
    });
    const passPhrase = String((this.inputRef as HTMLInputElement).value);

    // this is to make sure a render has the time to happen before we lock the thread with all of the db work
    // this might be removed once we get the db operations to a worker thread
    global.setTimeout(() => this.onLogin(passPhrase), 100);
  }

  private initClearDataView() {
    this.setState({
      error: '',
      errorCount: 0,
      clearDataView: true,
    });
  }

  private renderPasswordViewButtons(): JSX.Element {
    const showResetElements = this.state.errorCount >= MAX_LOGIN_TRIES;

    return (
      <div className={classNames(showResetElements && 'button-group')}>
        <SessionButton
          text={window.i18n('unlock')}
          buttonColor={SessionButtonColor.Primary}
          onClick={this.initLogin}
        />
        {showResetElements && (
          <>
            <SessionButton
              text="Reset Database"
              buttonColor={SessionButtonColor.Danger}
              onClick={this.initClearDataView}
            />
          </>
        )}
      </div>
    );
  }

  private renderClearDataViewButtons(): JSX.Element {
    return (
      <div className="button-group">
        <SessionButton
          text={window.i18n('clearAllData')}
          buttonColor={SessionButtonColor.Danger}
          onClick={window.clearLocalData}
        />
        <SessionButton
          text={window.i18n('cancel')}
          onClick={() => {
            this.setState({ clearDataView: false });
          }}
        />
      </div>
    );
  }
}

export const SessionPasswordPrompt = withTheme(SessionPasswordPromptInner);
