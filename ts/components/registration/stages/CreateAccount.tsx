import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { sanitizeSessionUsername } from '../../../session/utils/String';
import { AccountCreation } from '../../../state/onboarding/ducks/registration';
import {
  useOnboardAccountCreationStep,
  useOnboardGeneratedRecoveryPhrase,
  useOnboardHexGeneratedPubKey,
} from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { signUp } from '../RegistrationStages';
import { BackButtonWithininContainer } from '../components/BackButton';

const StyledContainer = styled.div`
  width: 100%;
`;

const StyledHeading = styled.h3`
  padding: 0;
  margin: 0;
  font-size: var(--font-size-h2);
`;

const StyledDescription = styled.p`
  padding: 0;
  margin: 0;
`;

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
    setDisplayNameError(window.i18n('invalidDisplayNameTooLong'));
  }
}

export const CreateAccount = () => {
  const step = useOnboardAccountCreationStep();
  const generatedRecoveryPhrase = useOnboardGeneratedRecoveryPhrase();
  const hexGeneratedPubKey = useOnboardHexGeneratedPubKey();

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  useEffect(() => {
    if (step === AccountCreation.DisplayName) {
      window.Session.setNewSessionID(hexGeneratedPubKey);
    }
  }, [step, hexGeneratedPubKey]);

  const displayNameOK = !!displayName && !displayNameError;
  const signUpWithDetails = () => {
    if (!displayNameOK) {
      return;
    }

    void signUp({
      displayName,
      generatedRecoveryPhrase,
    });
  };

  return (
    <StyledContainer>
      <BackButtonWithininContainer margin={'0 0 0 -28px'}>
        <Flex container={true} width="100%" flexDirection="column" alignItems="flex-start">
          <StyledHeading>{window.i18n('displayNamePick')}</StyledHeading>
          <SpacerSM />
          <StyledDescription>{window.i18n('displayNameDescription')}</StyledDescription>
          <SpacerLG />
          <SessionInput
            autoFocus={true}
            type="text"
            placeholder={window.i18n('enterDisplayName')}
            value={displayName}
            onValueChanged={(name: string) => {
              sanitizeDisplayNameOrToast(name, setDisplayName, setDisplayNameError);
            }}
            onEnterPressed={signUpWithDetails}
            error={displayNameError}
            inputDataTestId="display-name-input"
          />
          <SpacerLG />
          <SessionButton
            buttonColor={SessionButtonColor.White}
            onClick={signUpWithDetails}
            text={window.i18n('continue')}
          />
        </Flex>
      </BackButtonWithininContainer>
    </StyledContainer>
  );
};
