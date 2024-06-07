import { isEmpty } from 'lodash';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import styled from 'styled-components';
import { usePasswordModal } from '../../../hooks/usePasswordModal';
import { mnDecode } from '../../../session/crypto/mnemonic';
import { updateHideRecoveryPasswordModel } from '../../../state/ducks/modalDialog';
import { showSettingsSection } from '../../../state/ducks/section';
import { useHideRecoveryPasswordEnabled } from '../../../state/selectors/settings';
import { useIsDarkTheme, useTheme } from '../../../state/selectors/theme';
import { THEME_GLOBALS, getThemeValue } from '../../../themes/globals';
import { getCurrentRecoveryPhrase } from '../../../util/storage';
import { SessionQRCode } from '../../SessionQRCode';
import { AnimatedFlex } from '../../basic/Flex';
import { SessionButtonColor } from '../../basic/SessionButton';
import { SessionHtmlRenderer } from '../../basic/SessionHTMLRenderer';
import { SpacerMD, SpacerSM } from '../../basic/Text';
import { CopyToClipboardIcon } from '../../buttons/CopyToClipboardButton';
import { SessionIconButton } from '../../icon';
import { SessionSettingButtonItem, SessionSettingsItemWrapper } from '../SessionSettingListItem';

const StyledSettingsItemContainer = styled.div`
  p {
    font-size: var(--font-size-md);
    line-height: 30px;
    margin: 0;
  }

  button[data-testid='hide-recovery-password-button'] {
    width: 130px;
  }
`;

const StyledRecoveryPassword = styled(AnimatedFlex)<{ color: string }>`
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-align: justify;
  user-select: text;
  border: 2px solid var(--text-secondary-color);
  border-radius: 11px;
  padding: var(--margins-sm) var(--margins-sm) var(--margins-sm) var(--margins-md);
  margin: 0;
  max-width: fit-content;
  color: ${props => props.color};
`;

export const SettingsCategoryRecoveryPassword = () => {
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [hexEncodedSeed, setHexEncodedSeed] = useState('');
  const [isQRVisible, setIsQRVisible] = useState(false);

  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();

  const dispatch = useDispatch();

  const { hasPassword, passwordValid } = usePasswordModal({
    title: window.i18n('sessionRecoveryPassword'),
    onClose: () => {
      dispatch(showSettingsSection('privacy'));
    },
  });
  const theme = useTheme();
  const isDarkTheme = useIsDarkTheme();

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

  if ((hasPassword && !passwordValid) || loadingSeed || hideRecoveryPassword) {
    return null;
  }

  return (
    <StyledSettingsItemContainer>
      <SessionSettingsItemWrapper
        title={window.i18n('sessionRecoveryPassword')}
        icon={{
          iconType: 'recoveryPasswordFill',
          iconSize: 16,
          iconColor: 'var(--text-primary-color)',
        }}
        description={
          <SessionHtmlRenderer tag="p" html={window.i18n('recoveryPasswordDescription')} />
        }
        inline={false}
      >
        <SpacerMD />
        {isQRVisible ? (
          <SessionQRCode
            id={'session-recovery-password'}
            value={hexEncodedSeed}
            size={240}
            backgroundColor={getThemeValue(
              isDarkTheme ? '--text-primary-color' : '--background-primary-color'
            )}
            foregroundColor={getThemeValue(
              isDarkTheme ? '--background-primary-color' : '--text-primary-color'
            )}
            logoImage={'./images/session/qr/shield.svg'}
            logoWidth={56}
            logoHeight={56}
            logoIsSVG={true}
            theme={theme}
            ariaLabel={'Recovery Password QR Code'}
            dataTestId={'session-recovery-password'}
          />
        ) : (
          <StyledRecoveryPassword
            aria-label="Recovery password"
            container={true}
            flexDirection={'row'}
            justifyContent={'space-between'}
            alignItems={'center'}
            width={'100%'}
            color={isDarkTheme ? 'var(--primary-color)' : 'var(--text-primary-color)'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
            data-testid="recovery-password-seed-modal"
          >
            {recoveryPhrase}
            <SpacerSM />
            <CopyToClipboardIcon
              copyContent={recoveryPhrase}
              iconSize={'huge'}
              iconColor={'var(--text-primary-color)'}
              hotkey={true}
            />
          </StyledRecoveryPassword>
        )}

        <SpacerMD />
        <SessionIconButton
          aria-label={isQRVisible ? 'View as password button' : 'View as QR code button'}
          iconType={isQRVisible ? 'password' : 'qr'}
          iconSize={isQRVisible ? 48 : 'huge'}
          iconColor={'var(--text-primary-color)'}
          onClick={() => {
            setIsQRVisible(!isQRVisible);
          }}
          padding="0"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: isQRVisible ? undefined : 'var(--margins-xs)',
            marginLeft: isQRVisible ? '-8px' : undefined,
          }}
        >
          {isQRVisible ? window.i18n('passwordView') : window.i18n('qrView')}
        </SessionIconButton>
      </SessionSettingsItemWrapper>
      {!hideRecoveryPassword ? (
        <SessionSettingButtonItem
          title={window.i18n('recoveryPasswordHidePermanently')}
          description={window.i18n('recoveryPasswordHideRecoveryPasswordDescription')}
          onClick={() => {
            dispatch(updateHideRecoveryPasswordModel({ state: 'firstWarning' }));
          }}
          buttonText={window.i18n('hide')}
          buttonColor={SessionButtonColor.Danger}
          dataTestId={'hide-recovery-password-button'}
        />
      ) : null}
    </StyledSettingsItemContainer>
  );
};
