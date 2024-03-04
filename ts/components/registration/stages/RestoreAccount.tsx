import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountRestoration,
  setAccountRestorationStep,
} from '../../../state/onboarding/ducks/registration';
import { useOnboardAccountRestorationStep } from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionIcon } from '../../icon';
import { SessionInput } from '../../inputs';
import { SessionProgressBar } from '../../loading';
import { signInWithLinking } from '../RegistrationStages';
import { OnboardContainer, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();

  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryPhraseError, setRecoveryPhraseError] = useState(undefined as string | undefined);
  const [progress, setProgress] = useState(0);

  const dispatch = useDispatch();

  // Seed is mandatory no matter which mode
  const seedOK = !!recoveryPhrase && !recoveryPhraseError;

  const activateContinueButton = seedOK && !(step === AccountRestoration.Loading);

  const continueYourSession = async () => {
    dispatch(setAccountRestorationStep(AccountRestoration.Loading));
    await signInWithLinking({
      userRecoveryPhrase: recoveryPhrase,
      errorCallback: setRecoveryPhraseError,
    });
    dispatch(setAccountRestorationStep(AccountRestoration.Complete));
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === AccountRestoration.Loading) {
      interval = setInterval(() => {
        setProgress(oldProgress => {
          if (oldProgress === 100) {
            clearInterval(interval);
            return 100;
          }
          // Increment by 100 / 15 = 6.67 each second to complete in 15 seconds
          return Math.min(oldProgress + 100 / 15, 100);
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [step]);

  return (
    <OnboardContainer>
      {step === AccountRestoration.Loading ? (
        <Flex
          container={true}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          // TODO update dataTestId
          dataTestId="three-dot-loading-animation"
        >
          <SessionProgressBar
            progress={progress}
            width={'320px'}
            margin={'var(--margins-lg) auto'}
            title={window.i18n('waitOneMoment')}
            subtitle={window.i18n('loadAccountProgressMessage')}
            showPercentage={true}
          />
        </Flex>
      ) : (
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
                iconType="recoveryPasswordOutline"
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
        </BackButtonWithininContainer>
      )}
    </OnboardContainer>
  );
};
