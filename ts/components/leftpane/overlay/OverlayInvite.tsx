import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { shell } from 'electron';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { SessionButton } from '../../basic/SessionButton';

import { UserUtils } from '../../../session/utils';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD, SpacerSM } from '../../basic/Text';
import { SessionIcon, SessionIconButton } from '../../icon';
import { SessionInput } from '../../inputs';
import { StyledLeftPaneOverlay } from './OverlayMessage';

const StyledHeadingContainer = styled(Flex)`
  .session-icon-button {
    border: 1px solid var(--text-primary-color);
    border-radius: 9999px;
    margin-inline-start: var(--margins-sm);
    margin-bottom:
    transition-duration: var(--default-duration);
  }`;

const StyledHeading = styled.h3`
  color: var(--text-primary-color);
  font-family: var(--font-default)
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
  padding: 0 var(--margins-md);
`;

const StyledButtonerContainer = styled.div`
  .session-button {
    width: 160px;
    height: 41px;
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
          <SessionInput
            autoFocus={true}
            type="text"
            value={ourSessionID}
            centerText={true}
            editable={false}
            isTextArea={true}
            inputDataTestId="invite-account-id"
          />
          <SpacerMD />
          <StyledDescription>{window.i18n('sessionInviteAFriendDescription')}</StyledDescription>
          <SpacerLG />
          <StyledButtonerContainer>
            <SessionButton
              text={window.i18n('editMenuCopy')}
              onClick={() => {
                window.clipboard.writeText(ourSessionID);
                setIdCopied(true);
              }}
              dataTestId="invite-account-id-copy"
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
            <SessionIconButton
              aria-label="external link to Session Zendesk article explaing how Account IDs work"
              iconType="question"
              iconColor={'var(--text-primary-color)'}
              iconSize={10}
              iconPadding="2px"
              padding={'0'}
              dataTestId="session-zendesk-account-ids"
              onClick={() => {
                void shell.openExternal(
                  'https://sessionapp.zendesk.com/hc/en-us/articles/4439132747033-How-do-Session-ID-usernames-work'
                );
              }}
            />
          </StyledHeadingContainer>
          <SpacerSM />
          <StyledDescription>{window.i18n('sessionInviteAFriendIDCopied')}</StyledDescription>
        </>
      )}
    </StyledLeftPaneOverlay>
  );
};
