import React, { useEffect } from 'react';
import classNames from 'classnames';

import { SessionIcon } from './icon';
import autoBind from 'auto-bind';
import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { SessionSpinner } from './basic/SessionSpinner';
import { SessionTheme } from '../themes/SessionTheme';
import { switchThemeTo } from '../session/utils/Theme';
import styled from 'styled-components';
import { ToastUtils } from '../session/utils';
import { isString } from 'lodash';
import { SessionToastContainer } from './SessionToastContainer';

interface State {
  errorCount: number;
  clearDataView: boolean;
  loading: boolean;
}

export const MAX_LOGIN_TRIES = 3;
// tslint:disable: use-simple-attributes

const TextPleaseWait = (props: { isLoading: boolean }) => {
  if (!props.isLoading) {
    return null;
  }
  return <div>{window.i18n('pleaseWaitOpenAndOptimizeDb')}</div>;
};

const StyledContent = styled.div`
  background-color: var(--background-primary-color);
  height: 100%;
  width: 100%;
`;

class SessionPasswordPromptInner extends React.PureComponent<{}, State> {
  private inputRef?: any;

  constructor(props: any) {
    super(props);

    this.state = {
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
    const isLoading = this.state.loading;

    const wrapperClass = this.state.clearDataView
      ? 'clear-data-wrapper'
      : 'password-prompt-wrapper';
    const containerClass = this.state.clearDataView
      ? 'clear-data-container'
      : 'password-prompt-container';
    const infoAreaClass = this.state.clearDataView ? 'warning-info-area' : 'password-info-area';
    const infoTitle = this.state.clearDataView
      ? window.i18n('clearDevice')
      : window.i18n('passwordViewTitle');
    const buttonGroup = this.state.clearDataView
      ? this.renderClearDataViewButtons()
      : this.renderPasswordViewButtons();
    const featureElement = this.state.clearDataView ? (
      <p className="text-center">{window.i18n('deleteAccountFromLogin')}</p>
    ) : (
      <input
        id="password-prompt-input"
        type="password"
        defaultValue=""
        placeholder={window.i18n('enterPassword')}
        onKeyUp={this.onKeyUp}
        ref={input => {
          this.inputRef = input;
        }}
      />
    );
    const infoIcon = this.state.clearDataView ?? (
      <SessionIcon iconType="warning" iconSize={35} iconColor="var(--danger-color)" />
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

      if (error && isString(error)) {
        ToastUtils.pushToastError('onLogin', error);
      } else if (error?.message && isString(error.message)) {
        ToastUtils.pushToastError('onLogin', error.message);
      }

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
      errorCount: 0,
      clearDataView: true,
    });
  }

  private renderPasswordViewButtons(): JSX.Element {
    const showResetElements = this.state.errorCount >= MAX_LOGIN_TRIES;

    return (
      <div className={classNames(showResetElements && 'button-group')}>
        {showResetElements && (
          <>
            <SessionButton
              text={window.i18n('clearDevice')}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={this.initClearDataView}
            />
          </>
        )}
        {/* TODO Theming - Fix */}
        <SessionButton
          text={showResetElements ? window.i18n('tryAgain') : window.i18n('done')}
          buttonType={SessionButtonType.Simple}
          onClick={this.initLogin}
        />
      </div>
    );
  }

  private renderClearDataViewButtons(): JSX.Element {
    return (
      <div className="button-group">
        <SessionButton
          text={window.i18n('clearDevice')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={window.clearLocalData}
        />
        <SessionButton
          text={window.i18n('cancel')}
          buttonType={SessionButtonType.Simple}
          onClick={() => {
            this.setState({ clearDataView: false });
          }}
        />
      </div>
    );
  }
}

export const SessionPasswordPrompt = () => {
  useEffect(() => {
    if ((window as any).theme) {
      void switchThemeTo((window as any).theme, null, false);
    }
  }, []);

  return (
    <SessionTheme>
      <SessionToastContainer />
      <StyledContent>
        <SessionPasswordPromptInner />
      </StyledContent>
    </SessionTheme>
  );
};
