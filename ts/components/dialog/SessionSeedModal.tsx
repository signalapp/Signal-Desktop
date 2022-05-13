import React, { useEffect, useState } from 'react';

import { ToastUtils } from '../../session/utils';
import { matchesHash } from '../../util/passwordUtils';
import { getPasswordHash } from '../../data/data';
import { QRCode } from 'react-qr-svg';
import { mn_decode } from '../../session/crypto/mnemonic';
import { SpacerLG, SpacerSM, SpacerXS } from '../basic/Text';
import { recoveryPhraseModal } from '../../state/ducks/modalDialog';
import { useDispatch } from 'react-redux';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { getCurrentRecoveryPhrase } from '../../util/storage';

interface PasswordProps {
  setPasswordValid: (val: boolean) => any;
  passwordHash: string;
}

const Password = (props: PasswordProps) => {
  const { setPasswordValid, passwordHash } = props;
  const i18n = window.i18n;
  const [error, setError] = useState('');
  const dispatch = useDispatch();

  const onClose = () => dispatch(recoveryPhraseModal(null));

  const confirmPassword = () => {
    const passwordValue = (document.getElementById('seed-input-password') as any)?.value;
    const isPasswordValid = matchesHash(passwordValue as string, passwordHash);

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
  };

  const onEnter = (event: any) => {
    if (event.key === 'Enter') {
      confirmPassword();
    }
  };

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
        <SessionButton text={i18n('cancel')} onClick={onClose} />
        <SessionButton text={i18n('ok')} onClick={confirmPassword} />
      </div>
    </>
  );
};

interface SeedProps {
  recoveryPhrase: string;
  onClickCopy?: () => any;
}

const Seed = (props: SeedProps) => {
  const { recoveryPhrase, onClickCopy } = props;
  const i18n = window.i18n;
  const bgColor = '#FFFFFF';
  const fgColor = '#1B1B1B';
  const dispatch = useDispatch();

  const hexEncodedSeed = mn_decode(recoveryPhrase, 'english');

  const copyRecoveryPhrase = (recoveryPhraseToCopy: string) => {
    window.clipboard.writeText(recoveryPhraseToCopy);
    ToastUtils.pushCopiedToClipBoard();
    if (onClickCopy) {
      onClickCopy();
    }
    dispatch(recoveryPhraseModal(null));
  };

  return (
    <>
      <div className="session-modal__centered text-center">
        <p className="session-modal__description">{i18n('recoveryPhraseSavePromptMain')}</p>
        <SpacerXS />

        <i data-testid="recovery-phrase-seed-modal" className="session-modal__text-highlight">
          {recoveryPhrase}
        </i>
      </div>
      <SpacerLG />
      <div className="session-modal__button-group">
        <SessionButton
          text={i18n('editMenuCopy')}
          buttonColor={SessionButtonColor.Green}
          onClick={() => {
            copyRecoveryPhrase(recoveryPhrase);
          }}
        />
      </div>
      <SpacerLG />
      <div className="qr-image">
        <QRCode value={hexEncodedSeed} bgColor={bgColor} fgColor={fgColor} level="L" />
      </div>
    </>
  );
};

interface ModalInnerProps {
  onClickOk?: () => any;
}

const SessionSeedModalInner = (props: ModalInnerProps) => {
  const { onClickOk } = props;
  const [loadingPassword, setLoadingPassword] = useState(true);
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [hasPassword, setHasPassword] = useState<null | boolean>(null);
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordHash, setPasswordHash] = useState('');
  const dispatch = useDispatch();

  useEffect(() => {
    setTimeout(() => (document.getElementById('seed-input-password') as any)?.focus(), 100);
    void checkHasPassword();
    void getRecoveryPhrase();
  }, []);

  const i18n = window.i18n;

  const onClose = () => dispatch(recoveryPhraseModal(null));

  const checkHasPassword = async () => {
    if (!loadingPassword) {
      return;
    }

    const hash = await getPasswordHash();
    setHasPassword(!!hash);
    setPasswordHash(hash || '');
    setLoadingPassword(false);
  };

  const getRecoveryPhrase = async () => {
    if (recoveryPhrase) {
      return false;
    }
    const newRecoveryPhrase = getCurrentRecoveryPhrase();
    setRecoveryPhrase(newRecoveryPhrase);
    setLoadingSeed(false);

    return true;
  };

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
            <Password passwordHash={passwordHash} setPasswordValid={setPasswordValid} />
          ) : (
            <Seed recoveryPhrase={recoveryPhrase} onClickCopy={onClickOk} />
          )}
        </SessionWrapperModal>
      )}
    </>
  );
};

export const SessionSeedModal = SessionSeedModalInner;
