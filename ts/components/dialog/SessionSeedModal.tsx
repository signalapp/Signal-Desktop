import React, { useState } from 'react';

import { SessionButton } from '../session/SessionButton';
import { ToastUtils, UserUtils } from '../../session/utils';
import { withTheme } from 'styled-components';
import { PasswordUtil } from '../../util';
import { getPasswordHash } from '../../data/data';
import { QRCode } from 'react-qr-svg';
import { mn_decode } from '../../session/crypto/mnemonic';
import { SessionWrapperModal } from '../session/SessionWrapperModal';
import { SpacerLG, SpacerSM, SpacerXS } from '../basic/Text';
import { recoveryPhraseModal } from '../../state/ducks/modalDialog';
import { useEffect } from 'react';

interface Props {
  onClickOk?: () => any;
}

const SessionSeedModalInner = (props: Props) => {
  const [error, setError] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(true);
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [hasPassword, setHasPassword] = useState<null | boolean>(null);
  const [passwordHash, setPasswordHash] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);

  useEffect(() => {
    setTimeout(() => ($('#seed-input-password') as any).focus(), 100);
    void checkHasPassword();
    void getRecoveryPhrase();
  }, []);


  const i18n = window.i18n;

  const onClose = () => window.inboxStore?.dispatch(recoveryPhraseModal(null));

  const renderPasswordView = () => {
    const i18n = window.i18n;

    const onClose = () => window.inboxStore?.dispatch(recoveryPhraseModal(null));

    return (
      <>
        <p>{i18n('showRecoveryPhrasePasswordRequest')}</p>
        <input
          type="password"
          id="seed-input-password"
          placeholder={i18n('password')}
          onKeyUp={onEnter}
        />

        {error && (
          <>
            <SpacerXS />
            <div className="session-label danger">{error}</div>
          </>
        )}

        <SpacerLG />

        <div className="session-modal__button-group">
          <SessionButton text={i18n('ok')} onClick={confirmPassword} />

          <SessionButton text={i18n('cancel')} onClick={onClose} />
        </div>
      </>
    );
  }

  const renderSeedView = () => {
    const i18n = window.i18n;
    const bgColor = '#FFFFFF';
    const fgColor = '#1B1B1B';

    const hexEncodedSeed = mn_decode(recoveryPhrase, 'english');

    return (
      <>
        <div className="session-modal__centered text-center">
          <p className="session-modal__description">{i18n('recoveryPhraseSavePromptMain')}</p>
          <SpacerXS />

          <i className="session-modal__text-highlight">{recoveryPhrase}</i>
        </div>
        <SpacerLG />
        <div className="qr-image">
          <QRCode value={hexEncodedSeed} bgColor={bgColor} fgColor={fgColor} level="L" />
        </div>
        <SpacerLG />
        <div className="session-modal__button-group">
          <SessionButton
            text={i18n('copy')}
            onClick={() => {
              copyRecoveryPhrase(recoveryPhrase);
            }}
          />
        </div>
      </>
    );
  }

  const confirmPassword = () => {
    const passwordValue = jQuery('#seed-input-password').val();
    const isPasswordValid = PasswordUtil.matchesHash(passwordValue as string, passwordHash);

    if (!passwordValue) {
      setError('noGivenPassword');
      return false;
    }

    if (passwordHash && !isPasswordValid) {
      setError('invalidPassword');
      return false;
    }

    setPasswordValid(true);
    setError('');

    window.removeEventListener('keyup', onEnter);
    return true;
  }

  const checkHasPassword = async () => {
    if (!loadingPassword) {
      return;
    }

    const hash = await getPasswordHash();
    setHasPassword(!!hash);
    setPasswordHash(hash || '');
    setLoadingPassword(false);
  }

  const getRecoveryPhrase = async () => {
    if (recoveryPhrase) {
      return false;
    }
    const newRecoveryPhrase = UserUtils.getCurrentRecoveryPhrase();
    setRecoveryPhrase(newRecoveryPhrase);
    setLoadingSeed(false);

    return true;
  }

  const copyRecoveryPhrase = (recoveryPhrase: string) => {
    window.clipboard.writeText(recoveryPhrase);

    ToastUtils.pushCopiedToClipBoard();
    window.inboxStore?.dispatch(recoveryPhraseModal(null));
  }

  const onEnter = (event: any) => {
    if (event.key === 'Enter') {
      confirmPassword();
    }
  }

  if (Math.random() > 0.5) {
    return null;
  }

  return (
    <>
      {!loadingSeed && (
        <SessionWrapperModal
          title={i18n('showRecoveryPhrase')}
          onClose={onClose}
          showExitIcon={true}
        >
          <SpacerSM />

          {hasPassword && !passwordValid ? (
            <>{renderPasswordView()}</>
          ) : (
            <>{renderSeedView()}</>
          )}
        </SessionWrapperModal>
      )}
      :
    </>
   );
}

// withTheme(SessionSeedModalInner)
// export const SessionSeedModal = withTheme(SessionSeedModalInner);
export const SessionSeedModal = SessionSeedModalInner;
