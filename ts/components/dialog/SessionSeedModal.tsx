import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { ToastUtils } from '../../session/utils';

import { mnDecode } from '../../session/crypto/mnemonic';
import { recoveryPhraseModal } from '../../state/ducks/modalDialog';
import { SpacerSM } from '../basic/Text';

import { usePasswordModal } from '../../hooks/usePasswordModal';
import { getTheme } from '../../state/selectors/theme';
import { getThemeValue } from '../../themes/globals';
import { getCurrentRecoveryPhrase } from '../../util/storage';
import { SessionQRCode } from '../SessionQRCode';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';

interface SeedProps {
  recoveryPhrase: string;
  onClickCopy?: () => any;
}

const StyledRecoveryPhrase = styled.i``;

const Seed = (props: SeedProps) => {
  const { recoveryPhrase, onClickCopy } = props;
  const dispatch = useDispatch();
  const theme = useSelector(getTheme);

  const hexEncodedSeed = mnDecode(recoveryPhrase, 'english');

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
        <p
          className="session-modal__description"
          style={{
            lineHeight: '1.3333',
            marginTop: '0px',
            marginBottom: 'var(--margins-md)',
            maxWidth: '600px',
          }}
        >
          {window.i18n('recoveryPhraseSavePromptMain')}
        </p>

        <SessionQRCode
          id={'session-recovery-passwod'}
          value={hexEncodedSeed}
          size={240}
          backgroundColor={getThemeValue(
            theme.includes('dark') ? '--text-primary-color' : '--background-primary-color'
          )}
          foregroundColor={getThemeValue(
            theme.includes('dark') ? '--background-primary-color' : '--text-primary-color'
          )}
          logoImage={'./images/session/qr/shield.svg'}
          logoWidth={56}
          logoHeight={56}
          logoIsSVG={true}
          style={{ margin: '0 auto var(--margins-lg)' }}
        />

        <StyledRecoveryPhrase
          data-testid="recovery-phrase-seed-modal"
          className="session-modal__text-highlight"
        >
          {recoveryPhrase}
        </StyledRecoveryPhrase>
      </div>
      <div
        className="session-modal__button-group"
        style={{ justifyContent: 'center', width: '100%' }}
      >
        <SessionButton
          text={window.i18n('editMenuCopy')}
          buttonType={SessionButtonType.Simple}
          onClick={() => {
            copyRecoveryPhrase(recoveryPhrase);
          }}
        />
      </div>
    </>
  );
};

const StyledSeedModalContainer = styled.div`
  margin: var(--margins-md) var(--margins-sm);
`;

interface ModalInnerProps {
  onClickOk?: () => any;
}

const SessionSeedModalInner = (props: ModalInnerProps) => {
  const { onClickOk } = props;
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const dispatch = useDispatch();

  const onClose = () => dispatch(recoveryPhraseModal(null));

  usePasswordModal({
    onSuccess: () => {
      const newRecoveryPhrase = getCurrentRecoveryPhrase();
      setRecoveryPhrase(newRecoveryPhrase);
      setLoadingSeed(false);
    },
    onClose,
    title: window.window.i18n('sessionRecoveryPassword'),
  });

  if (loadingSeed) {
    return null;
  }

  return (
    <SessionWrapperModal
      title={window.i18n('sessionRecoveryPassword')}
      onClose={onClose}
      showExitIcon={true}
    >
      <StyledSeedModalContainer>
        <SpacerSM />
        <Seed recoveryPhrase={recoveryPhrase} onClickCopy={onClickOk} />
      </StyledSeedModalContainer>
    </SessionWrapperModal>
  );
};

export const SessionSeedModal = SessionSeedModalInner;
