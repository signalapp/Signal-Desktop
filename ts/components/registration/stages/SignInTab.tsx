import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { ToastUtils } from '../../../session/utils';
import { sanitizeSessionUsername } from '../../../session/utils/String';
import {
  AccountRestoration,
  Onboarding,
  setAccountRestorationStep,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import { useOnboardAccountRestorationStep } from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionButton } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { SessionSpinner } from '../../loading';
import { signInWithLinking, signInWithRecovery } from '../RegistrationStages';
import { RegistrationUserDetails } from '../RegistrationUserDetails';
import { TermsAndConditions } from '../TermsAndConditions';
import { BackButton } from '../components';

const LinkDeviceButton = (props: { onLinkDeviceButtonClicked: () => any }) => {
  return (
    <SessionButton
      onClick={props.onLinkDeviceButtonClicked}
      text={window.i18n('linkDevice')}
      dataTestId="link-device"
    />
  );
};

const RestoreUsingRecoveryPhraseButton = (props: { onRecoveryButtonClicked: () => any }) => {
  return (
    <SessionButton
      onClick={props.onRecoveryButtonClicked}
      text={window.i18n('restoreUsingRecoveryPhrase')}
      dataTestId="restore-using-recovery"
    />
  );
};

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

const SignInButtons = (props: {
  accountRestorationStep: AccountRestoration;
  onRecoveryButtonClicked: () => any;
  onLinkDeviceButtonClicked: () => any;
}) => {
  if (props.accountRestorationStep !== AccountRestoration.Start) {
    return null;
  }
  return (
    <div>
      <RestoreUsingRecoveryPhraseButton onRecoveryButtonClicked={props.onRecoveryButtonClicked} />
      <SpacerLG />
      <LinkDeviceButton onLinkDeviceButtonClicked={props.onLinkDeviceButtonClicked} />
    </div>
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

export const SignInTab = () => {
  const step = useOnboardAccountRestorationStep();

  const dispatch = useDispatch();

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
    <div className="session-registration__content">
      {step !== AccountRestoration.Start && (
        <>
          <BackButton />
          <SpacerLG />
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

      <SignInButtons
        accountRestorationStep={step}
        onRecoveryButtonClicked={() => {
          dispatch(setOnboardingStep(Onboarding.RestoreAccount));
          dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
          setRecoveryPhrase('');
          setDisplayName('');
          setIsLoading(false);
        }}
        onLinkDeviceButtonClicked={() => {
          dispatch(setOnboardingStep(Onboarding.RestoreAccount));
          dispatch(setAccountRestorationStep(AccountRestoration.LinkDevice));
          setRecoveryPhrase('');
          setDisplayName('');
          setIsLoading(false);
        }}
      />
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
    </div>
  );
};
