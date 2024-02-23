import { useState } from 'react';
import { ToastUtils } from '../../../session/utils';
import { sanitizeSessionUsername } from '../../../session/utils/String';
import { AccountRestoration } from '../../../state/onboarding/ducks/registration';
import { useOnboardAccountRestorationStep } from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionButton } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';
import { signInWithLinking, signInWithRecovery } from '../RegistrationStages';
import { RegistrationUserDetails } from '../RegistrationUserDetails';
import { TermsAndConditions } from '../TermsAndConditions';

const ContinueYourSessionButton = (props: {
  handleContinueYourSessionClick: () => any;
  disabled: boolean;
}) => {
  return (
    <SessionButton
      onClick={props.handleContinueYourSessionClick}
      text={window.i18n('continueYourSession')}
      disabled={props.disabled}
      dataTestId="continue-session-button"
    />
  );
};

const SignInContinueButton = (props: {
  accountRestorationStep: AccountRestoration;
  disabled: boolean;
  handleContinueYourSessionClick: () => any;
}) => {
  if (props.accountRestorationStep === AccountRestoration.Start) {
    return null;
  }
  return (
    <ContinueYourSessionButton
      handleContinueYourSessionClick={props.handleContinueYourSessionClick}
      disabled={props.disabled}
    />
  );
};

export function sanitizeDisplayNameOrToast(
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

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();

  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryPhraseError, setRecoveryPhraseError] = useState(undefined as string | undefined);
  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | undefined>('');
  const [loading, setIsLoading] = useState(false);

  const isRecovery = step === AccountRestoration.RecoveryPassword;
  const isLinking = step === AccountRestoration.LinkDevice;
  const showTermsAndConditions = step !== AccountRestoration.Start;

  // show display name input only if we are trying to recover from seed.
  // We don't need a display name when we link a device, as the display name
  // from the configuration message will be used.
  const showDisplayNameField = isRecovery;

  // Display name is required only on isRecoveryMode
  const displayNameOK = (isRecovery && !displayNameError && !!displayName) || isLinking;

  // Seed is mandatory no matter which mode
  const seedOK = recoveryPhrase && !recoveryPhraseError;

  const activateContinueButton = seedOK && displayNameOK && !loading;

  const continueYourSession = async () => {
    if (isRecovery) {
      await signInWithRecovery({
        displayName,
        userRecoveryPhrase: recoveryPhrase,
      });
    } else if (isLinking) {
      setIsLoading(true);
      await signInWithLinking({
        userRecoveryPhrase: recoveryPhrase,
      });
      setIsLoading(false);
    }
  };

  return (
    <>
      {step !== AccountRestoration.Start && (
        <>
          <RegistrationUserDetails
            showDisplayNameField={showDisplayNameField}
            showSeedField={true}
            displayName={displayName}
            handlePressEnter={continueYourSession}
            onDisplayNameChanged={(name: string) => {
              sanitizeDisplayNameOrToast(name, setDisplayName, setDisplayNameError);
            }}
            onSeedChanged={(seed: string) => {
              setRecoveryPhrase(seed);
              setRecoveryPhraseError(!seed ? window.i18n('recoveryPhraseEmpty') : undefined);
            }}
            recoveryPhrase={recoveryPhrase}
            stealAutoFocus={true}
          />
        </>
      )}
      <SignInContinueButton
        accountRestorationStep={step}
        handleContinueYourSessionClick={continueYourSession}
        disabled={!activateContinueButton}
      />
      {loading && (
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
      )}

      {showTermsAndConditions ? <TermsAndConditions /> : null}
    </>
  );
};
