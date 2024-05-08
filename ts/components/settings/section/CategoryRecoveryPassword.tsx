import { isEmpty } from 'lodash';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { usePasswordModal } from '../../../hooks/usePasswordModal';
import { mnDecode } from '../../../session/crypto/mnemonic';
import { ToastUtils } from '../../../session/utils';
import { showSettingsSection } from '../../../state/ducks/section';
import { getTheme } from '../../../state/selectors/theme';
import { getThemeValue } from '../../../themes/globals';
import { getCurrentRecoveryPhrase } from '../../../util/storage';
import { SessionQRCode } from '../../SessionQRCode';
import { SessionSettingsItemWrapper } from '../SessionSettingListItem';

export const SettingsCategoryRecoveryPassword = () => {
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [hexEncodedSeed, setHexEncodedSeed] = useState('');

  const dispatch = useDispatch();

  const { hasPassword, passwordValid } = usePasswordModal({
    title: window.i18n('sessionRecoveryPassword'),
    onClose: () => {
      dispatch(showSettingsSection('privacy'));
    },
  });
  const theme = useSelector(getTheme);

  const copyRecoveryPhrase = (recoveryPhraseToCopy: string) => {
    window.clipboard.writeText(recoveryPhraseToCopy);
    ToastUtils.pushCopiedToClipBoard();
  };

  const fetchRecoverPhrase = () => {
    const newRecoveryPhrase = getCurrentRecoveryPhrase();
    setRecoveryPhrase(newRecoveryPhrase);
    if (!isEmpty(newRecoveryPhrase)) {
      setHexEncodedSeed(mnDecode(newRecoveryPhrase, 'english'));
    }
    setLoadingSeed(false);
  };

  useMount(() => {
    if (!hasPassword || (hasPassword && passwordValid)) {
      fetchRecoverPhrase();
    }
  });

  if ((hasPassword && !passwordValid) || loadingSeed) {
    return null;
  }

  return (
    <>
      <SessionSettingsItemWrapper
        // TODO need to support escaping the HTML or passing through a ReactNode
        title={window.i18n('sessionRecoveryPassword')}
        description={window.i18n('recoveryPasswordDescription')}
        inline={false}
      >
        <i
          onClick={() => {
            if (isEmpty(recoveryPhrase)) {
              return;
            }
            copyRecoveryPhrase(recoveryPhrase);
          }}
          className="session-modal__text-highlight"
          data-testid="recovery-phrase-seed-modal"
        >
          {recoveryPhrase}
        </i>
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
        />
        {/* TODO Toggling between QR and recovery password */}
        {/* TODO Permenantly hide button */}
      </SessionSettingsItemWrapper>
    </>
  );
};
