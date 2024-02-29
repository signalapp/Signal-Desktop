import { useState } from 'react';
import { Flex } from '../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionIcon } from '../../icon';
import { SessionInput } from '../../inputs';
import { signInWithLinking } from '../RegistrationStages';
import { OnboardContainer, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';

export const RestoreAccount = () => {
  // const step = useOnboardAccountRestorationStep();

  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryPhraseError, setRecoveryPhraseError] = useState(undefined as string | undefined);
  const [loading, setIsLoading] = useState(false);

  // Seed is mandatory no matter which mode
  const seedOK = !!recoveryPhrase && !recoveryPhraseError;

  const activateContinueButton = seedOK && !loading;

  const continueYourSession = () => {
    // TODO better error handling
    // if (isRecovery) {
    //   void signInWithRecovery({
    //     displayName,
    //     userRecoveryPhrase: recoveryPhrase,
    //   });
    // }
    // else if (isLinking) {
    setIsLoading(true);
    void signInWithLinking({
      userRecoveryPhrase: recoveryPhrase,
    });
    setIsLoading(false);
  };

  return (
    <OnboardContainer>
      <BackButtonWithininContainer margin={'2px 0 0 -36px'}>
        <Flex
          container={true}
          width="100%"
          flexDirection="column"
          alignItems="flex-start"
          margin={'0 0 0 8px'}
        >
          <Flex container={true} width={'100%'} alignItems="center">
            <OnboardHeading>{window.i18n('sessionRecoveryPassword')}</OnboardHeading>
            <SessionIcon
              iconType="recoveryPassword"
              iconSize="large"
              iconColor="var(--text-primary-color)"
              style={{ margin: '-4px 0 0 8px' }}
            />
          </Flex>
          <SpacerSM />
          <OnboardDescription>{window.i18n('onboardingRecoveryPassword')}</OnboardDescription>
          <SpacerLG />
          <SessionInput
            autoFocus={true}
            type="password"
            placeholder={window.i18n('enterRecoveryPhrase')}
            value={recoveryPhrase}
            onValueChanged={(seed: string) => {
              setRecoveryPhrase(seed);
              setRecoveryPhraseError(!seed ? window.i18n('recoveryPhraseEmpty') : undefined);
            }}
            onEnterPressed={continueYourSession}
            error={recoveryPhraseError}
            enableShowHide={true}
            inputDataTestId="recovery-phrase-input"
          />
          <SpacerLG />
          <SessionButton
            buttonColor={SessionButtonColor.White}
            onClick={continueYourSession}
            text={window.i18n('continue')}
            disabled={!activateContinueButton}
            dataTestId="continue-session-button"
          />
        </Flex>
        {/* TODO[epic=898] Replace with new Session Progress Loader */}
        {/* {loading && (
        <Flex
          container={true}
          justifyContent="center"
          alignItems="center"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            pointerEvents: 'all',
            backgroundColor: 'var(--background-primary-color)',
          }}
          dataTestId="three-dot-loading-animation"
        >
          <SessionSpinner loading={true} />
        </Flex>
      )} */}
      </BackButtonWithininContainer>
    </OnboardContainer>
  );
};
