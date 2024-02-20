import { useEffect, useState } from 'react';

import { MAX_USERNAME_BYTES } from '../../../../session/constants';
import { ToastUtils } from '../../../../session/utils';
import { sanitizeSessionUsername } from '../../../../session/utils/String';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { Flex } from '../../../basic/Flex';
import { SessionButton } from '../../../basic/SessionButton';
import { SpacerLG, SpacerXL } from '../../../basic/Text';
import { SessionInput2 } from '../../../inputs';
import { SessionProgressBar } from '../../../loading';
import { StyledScrollContainer } from './components';

export const OverlayRightPanelSettings2 = () => {
  const selectedConvoKey = useSelectedConversationKey();

  // TODO[epic=ses-50] move this into already have an account screen
  // #region for testing
  const [progress, setProgress] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | undefined>(undefined);

  function sanitizeDisplayNameOrToast(
    displayName: string,
    setDisplayName: (sanitized: string) => void,
    setDisplayNameError: (error: string | undefined) => void
  ) {
    try {
      const sanitizedName = sanitizeSessionUsername(displayName);
      const trimName = sanitizedName.trim();
      setDisplayName(sanitizedName);
      setDisplayNameError(!trimName ? window.i18n('displayNameEmpty') : undefined);
    } catch (e) {
      setDisplayName(displayName);
      setDisplayNameError(window.i18n('displayNameTooLong'));
      ToastUtils.pushToastError('toolong', window.i18n('displayNameTooLong'));
    }
  }

  const handleInputChanged = (name: string) => {
    sanitizeDisplayNameOrToast(name, setInputValue, setInputError);
    if (name.length > 8) {
      setInputError(window.i18n('displayNameTooLong'));
    }
  };

  const handleEnterPressed = (name: string) => {
    if (name) {
      sanitizeDisplayNameOrToast(name, setInputValue, setInputError);
      ToastUtils.pushToastSuccess('success', window.i18n('done'));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(oldProgress => {
        if (oldProgress === 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(oldProgress + 10, 100);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  // #endregion

  if (!selectedConvoKey) {
    return null;
  }

  return (
    <StyledScrollContainer>
      <Flex container={true} flexDirection={'column'} alignItems={'center'}>
        <SessionProgressBar
          progress={progress}
          width={'320px'}
          margin={'var(--margins-lg) auto'}
          title={window.i18n('waitOneMoment')}
          subtitle={window.i18n('loadAccountProgressMessage')}
          showPercentage={true}
        />
        <SpacerLG />
        <SessionInput2
          placeholder={window.i18n('enterDisplayName')}
          value={inputValue}
          error={inputError}
          maxLength={MAX_USERNAME_BYTES}
          onValueChanged={handleInputChanged}
          onEnterPressed={handleEnterPressed}
          ctaButton={
            <SessionButton
              onClick={() => {
                window.log.debug(
                  `WIP: [OverlayRightPanelSettings] clicked continuing your session! `
                );
              }}
              text={window.i18n('continueYourSession')}
            />
          }
        />
        <SpacerLG />
        <SpacerXL />
      </Flex>
    </StyledScrollContainer>
  );
};
