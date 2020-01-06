import React from 'react';

import { SessionModal } from './SessionModal';
import { SessionButton } from './SessionButton';

interface Props {
  onClose: any;
}

interface State {
  error: string;
  loadingPassword: boolean;
  loadingSeed: boolean;
  seed: string;
  hasPassword: boolean | null;
  passwordHash: string;
  passwordValid: boolean;
}

export class SessionSeedModal extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      error: '',
      loadingPassword: true,
      loadingSeed: true,
      seed: '',
      hasPassword: null,
      passwordHash: '',
      passwordValid: false,
    };

    this.copySeed = this.copySeed.bind(this);
    this.getSeed = this.getSeed.bind(this);
    this.confirmPassword = this.confirmPassword.bind(this);
    this.checkHasPassword = this.checkHasPassword.bind(this);
  }

  public render() {
    const i18n = window.i18n;
    const { onClose } = this.props;

    const maxPasswordLen = 64;

    this.checkHasPassword();
    this.getSeed();

    const error = this.state.error;
    const hasPassword = this.state.hasPassword;
    const passwordValid = this.state.passwordValid;

    const loading = this.state.loadingPassword || this.state.loadingSeed;

    return (
      <SessionModal
        title={i18n('showSeed')}
        onOk={() => null}
        onClose={onClose}
      >
        {!loading && (
          <>
            <div className="spacer-sm" />

            {hasPassword && !passwordValid ? (
              <div>
                <p>{i18n('showSeedPasswordRequest')}</p>
                <input
                  type="password"
                  id="seed-input-password"
                  placeholder={i18n('password')}
                  maxLength={maxPasswordLen}
                />

                {error && (
                  <>
                    <div className="spacer-xs" />
                    <div className="session-label danger">{error}</div>
                  </>
                )}

                <div className="spacer-lg" />

                <div className="session-modal__button-group">
                  <SessionButton
                    text={i18n('confirm')}
                    onClick={this.confirmPassword}
                  />

                  <SessionButton text={i18n('cancel')} onClick={onClose} />
                </div>
              </div>
            ) : (
              <>
                <div className="session-modal__centered text-center">
                  <p className="session-modal__description">
                    {i18n('seedSavePrompt')}
                  </p>
                  <div className="spacer-md" />

                  <i className="session-modal__text-highlight">
                    {this.state.seed}
                  </i>
                </div>
                <div className="spacer-lg" />

                <div className="session-modal__button-group">
                  <SessionButton text={i18n('ok')} onClick={onClose} />

                  <SessionButton
                    text={i18n('copySeed')}
                    onClick={() => {
                      this.copySeed(this.state.seed);
                    }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </SessionModal>
    );
  }

  private confirmPassword() {
    const passwordHash = this.state.passwordHash;
    const passwordValue = $('#seed-input-password').val();
    const isPasswordValid = window.passwordUtil.matchesHash(
      passwordValue,
      passwordHash
    );

    if (!passwordValue) {
      this.setState({
        error: window.i18n('noGivenPassword'),
      });

      return false;
    }

    if (passwordHash && !isPasswordValid) {
      this.setState({
        error: window.i18n('invalidPassword'),
      });

      return false;
    }

    this.setState({
      passwordValid: true,
      error: '',
    });

    return true;
  }

  private checkHasPassword() {
    if (!this.state.loadingPassword) {
      return;
    }

    const hashPromise = window.Signal.Data.getPasswordHash();

    hashPromise.then((hash: any) => {
      this.setState({
        hasPassword: !!hash,
        passwordHash: hash,
        loadingPassword: false,
      });
    });
  }

  private async getSeed() {
    if (this.state.seed) {
      return this.state.seed;
    }

    const manager = await window.getAccountManager();
    const seed = manager.getCurrentMnemonic();

    this.setState({
      seed,
      loadingSeed: false,
    });

    return seed;
  }

  private copySeed(seed: string) {
    window.clipboard.writeText(seed);

    window.pushToast({
      title: window.i18n('copiedMnemonic'),
      type: 'success',
      id: 'copySeedToast',
    });
  }
}
