import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { MAX_USERNAME_BYTES } from '../../../session/constants';
import { AccountCreation } from '../../../state/onboarding/ducks/registration';
import {
  useOnboardAccountCreationStep,
  useOnboardGeneratedRecoveryPhrase,
  useOnboardHexGeneratedPubKey,
} from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionButton } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionInput2 } from '../../inputs';
import { signUp } from '../RegistrationStages';
import { BackButtonWithininContainer } from '../components/BackButton';
import { sanitizeDisplayNameOrToast } from './RestoreAccount';

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

export const CreateAccount = () => {
  const step = useOnboardAccountCreationStep();
  const generatedRecoveryPhrase = useOnboardGeneratedRecoveryPhrase();
  const hexGeneratedPubKey = useOnboardHexGeneratedPubKey();

  // const dispatch = useDispatch();

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  useEffect(() => {
    if (step === AccountCreation.DisplayName) {
      window.Session.setNewSessionID(hexGeneratedPubKey);
    }
  }, [step, hexGeneratedPubKey]);

  // Display name is required
  const displayNameOK = !displayNameError && !!displayName;

  const enableCompleteSignUp = displayNameOK;
  const signUpWithDetails = async () => {
    await signUp({
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
          <SessionInput2
            autoFocus={true}
            type="text"
            placeholder={window.i18n('enterDisplayName')}
            value={displayName}
            maxLength={MAX_USERNAME_BYTES}
            onValueChanged={(name: string) => {
              sanitizeDisplayNameOrToast(name, setDisplayName, setDisplayNameError);
            }}
            onEnterPressed={signUpWithDetails}
            inputDataTestId="display-name-input"
          />
          <SpacerLG />
          <SessionButton
            onClick={signUpWithDetails}
            text={window.i18n('continue')}
            disabled={!enableCompleteSignUp}
          />
        </Flex>
      </BackButtonWithininContainer>
    </StyledContainer>
  );
};
