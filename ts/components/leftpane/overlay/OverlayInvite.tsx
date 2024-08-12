import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetLeftOverlayMode } from '../../../state/ducks/section';

import { UserUtils } from '../../../session/utils';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD, SpacerSM } from '../../basic/Text';
import { HelpDeskButton } from '../../buttons';
import { CopyToClipboardButton } from '../../buttons/CopyToClipboardButton';
import { SessionIcon } from '../../icon';
import { SessionInput } from '../../inputs';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import { StyledTextAreaContainer } from '../../inputs/SessionInput';

const StyledHeadingContainer = styled(Flex)`
  .session-icon-button {
    border: 1px solid var(--text-primary-color);
    border-radius: 9999px;
    margin-inline-start: var(--margins-sm);
    transition-duration: var(--default-duration);
  }
`;

const StyledHeading = styled.h3`
  color: var(--text-primary-color);
  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  font-weight: 300;
  margin: 0 auto;
  padding: 0;
`;

const StyledDescription = styled.div`
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-style: normal;
  font-weight: 300;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
  margin: 0 auto;
  text-align: center;
  padding: 0 var(--margins-sm);
`;

const StyledButtonerContainer = styled.div`
  .session-button {
    width: 160px;
    height: 41px;
  }
`;

const StyledInputContainer = styled(Flex)`
  ${StyledTextAreaContainer} {
    padding: 0;
    div:first-child {
      padding: 0 var(--margins-sm);
    }
  }
`;

export const OverlayInvite = () => {
  const ourSessionID = UserUtils.getOurPubKeyStrFromCache();

  const [idCopied, setIdCopied] = useState(false);

  const dispatch = useDispatch();

  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  useKey('Escape', closeOverlay);

  return (
    <StyledLeftPaneOverlay
      container={true}
      flexDirection={'column'}
      flexGrow={1}
      alignItems={'center'}
      padding={'var(--margins-md)'}
    >
      {!idCopied ? (
        <>
          <StyledInputContainer
            container={true}
            width={'100%'}
            justifyContent="center"
            alignItems="center"
          >
            <SessionInput
              autoFocus={true}
              type="text"
              value={ourSessionID}
              editable={false}
              centerText={true}
              isTextArea={true}
              ariaLabel="Account ID"
              inputDataTestId="your-account-id"
            />
          </StyledInputContainer>
          <SpacerMD />
          <StyledDescription>{window.i18n('shareAccountIdDescription')}</StyledDescription>
          <SpacerLG />
          <StyledButtonerContainer>
            <CopyToClipboardButton
              copyContent={ourSessionID}
              onCopyComplete={() => setIdCopied(true)}
              hotkey={true}
              dataTestId="copy-button-account-id"
            />
          </StyledButtonerContainer>
        </>
      ) : (
        <>
          <SessionIcon
            iconType={'checkCircle'}
            iconSize={'huge2'}
            iconColor={'var(--primary-color)'}
          />
          <SpacerMD />
          <StyledHeadingContainer container={true} justifyContent="center" alignItems="center">
            <StyledHeading>{window.i18n('accountIDCopied')}</StyledHeading>
            <HelpDeskButton
              iconColor={'var(--text-primary-color)'}
              style={{ display: 'inline-flex' }}
            />
          </StyledHeadingContainer>
          <SpacerSM />
          <StyledDescription>{window.i18n('sessionInviteAFriendIDCopied')}</StyledDescription>
        </>
      )}
    </StyledLeftPaneOverlay>
  );
};
