import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { useDispatch } from 'react-redux';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { SessionButton } from '../../basic/SessionButton';

import { ToastUtils, UserUtils } from '../../../session/utils';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { StyledLeftPaneOverlay } from './OverlayMessage';

const StyledDescription = styled.div`
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
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
      <SessionInput
        autoFocus={true}
        type="text"
        value={ourSessionID}
        isSpecial={true}
        centerText={true}
        editable={false}
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
            ToastUtils.pushCopiedToClipBoard();
          }}
          dataTestId="invite-account-id-copy"
        />
      </StyledButtonerContainer>
    </StyledLeftPaneOverlay>
  );
};
