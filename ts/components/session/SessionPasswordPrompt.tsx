import React from 'react';
import classNames from 'classnames';

import { SessionIcon, SessionIconType } from './icon';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';

interface State {
  error: string;
  errorCount: number;
  clearDataView: boolean;
}

export class SessionPasswordPrompt extends React.PureComponent<{}, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      error: '',
      errorCount: 0,
      clearDataView: false,
    };

    this.onKeyUp = this.onKeyUp.bind(this);
    this.initLogin = this.initLogin.bind(this);
    this.initClearDataView = this.initClearDataView.bind(this);
  }

  public componentDidMount() {
    setTimeout(() => $('#password-prompt-input').focus(), 100);
  }

  public render() {
    const showResetElements =
      this.state.errorCount >= window.CONSTANTS.MAX_LOGIN_TRIES;

    const wrapperClass = this.state.clearDataView
      ? 'clear-data-wrapper'
      : 'password-prompt-wrapper';
    const containerClass = this.state.clearDataView
      ? 'clear-data-container'
      : 'password-prompt-container';
    const infoAreaClass = this.state.clearDataView
      ? 'warning-info-area'
      : 'password-info-area';
    const infoTitle = this.state.clearDataView
      ? window.i18n('clearDataHeader')
      : window.i18n('passwordViewTitle');
    const buttonGroup = this.state.clearDataView
      ? this.renderClearDataViewButtons()
      : this.renderPasswordViewButtons();
    const featureElement = this.state.clearDataView ? (
      <p className="text-center">{window.i18n('clearDataExplanation')}</p>
    ) : (
      <input
        id="password-prompt-input"
        type="password"
        defaultValue=""
        placeholder={' '}
        onKeyUp={this.onKeyUp}
        maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
      />
    );
    const infoIcon = this.state.clearDataView ? (
      <SessionIcon
        iconType={SessionIconType.Warning}
        iconSize={35}
        iconColor="#ce0000"
      />
    ) : (
      <SessionIcon
        iconType={SessionIconType.Lock}
        iconSize={35}
        iconColor="#00f782"
      />
    );
    const errorSection = !this.state.clearDataView && (
      <div className="password-prompt-error-section">
        {this.state.error && (
          <>
            {showResetElements ? (
              <div className="session-label warning">
                {window.i18n('maxPasswordAttempts')}
              </div>
            ) : (
              <div className="session-label primary">{this.state.error}</div>
            )}
          </>
        )}
      </div>
    );

    return (
      <div className={wrapperClass}>
        <div className={containerClass}>
          <div className={infoAreaClass}>
            {infoIcon}

            <h1>{infoTitle}</h1>
          </div>

          {featureElement}
          {errorSection}
          {buttonGroup}
        </div>
      </div>
    );
  }

  public async onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        await this.initLogin();
        break;
      default:
    }
    event.preventDefault();
  }

  public async onLogin(passPhrase: string) {
    const trimmed = passPhrase ? passPhrase.trim() : passPhrase;

    try {
      await window.onLogin(trimmed);
    } catch (e) {
      // Increment the error counter and show the button if necessary
      this.setState({
        errorCount: this.state.errorCount + 1,
      });

      this.setState({ error: e });
    }
  }

  private async initLogin() {
    const passPhrase = String($('#password-prompt-input').val());
    await this.onLogin(passPhrase);
  }

  private initClearDataView() {
    this.setState({
      error: '',
      errorCount: 0,
      clearDataView: true,
    });
  }

  private renderPasswordViewButtons(): JSX.Element {
    const showResetElements =
      this.state.errorCount >= window.CONSTANTS.MAX_LOGIN_TRIES;

    return (
      <div className={classNames(showResetElements && 'button-group')}>
        {showResetElements && (
          <>
            <SessionButton
              text="Reset Database"
              buttonType={SessionButtonType.BrandOutline}
              buttonColor={SessionButtonColor.Danger}
              onClick={this.initClearDataView}
            />
          </>
        )}
        <SessionButton
          text={window.i18n('unlock')}
          buttonType={SessionButtonType.BrandOutline}
          buttonColor={SessionButtonColor.Green}
          onClick={this.initLogin}
        />
      </div>
    );
  }

  private renderClearDataViewButtons(): JSX.Element {
    return (
      <div className="button-group">
        <SessionButton
          text={window.i18n('cancel')}
          buttonType={SessionButtonType.Default}
          buttonColor={SessionButtonColor.Primary}
          onClick={() => {
            this.setState({ clearDataView: false });
          }}
        />

        <SessionButton
          text={window.i18n('deleteAllDataButton')}
          buttonType={SessionButtonType.Default}
          buttonColor={SessionButtonColor.Danger}
          onClick={window.clearLocalData}
        />
      </div>
    );
  }
}
