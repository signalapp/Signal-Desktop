import React, { ReactElement, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useMessageReactsPropsById } from '../../hooks/useParamSelector';
import { clearSogsReactionByServerId } from '../../session/apis/open_group_api/sogsv3/sogsV3ClearReaction';
import { getConversationController } from '../../session/conversations';
import { updateReactClearAllModal } from '../../state/ducks/modalDialog';
import { getTheme } from '../../state/selectors/theme';
import { Flex } from '../basic/Flex';
import { SessionButton2, SessionButtonColor, SessionButtonType } from '../basic/SessionButton2';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionWrapperModal } from '../SessionWrapperModal';

type Props = {
  reaction: string;
  messageId: string;
};

const StyledButtonContainer = styled.div`
  div:first-child {
    margin-right: 0px;
  }
  div:not(:first-child) {
    margin-left: 20px;
  }
`;

const StyledReactClearAllContainer = styled(Flex)<{ darkMode: boolean }>`
  margin: var(--margins-lg);

  p {
    font-size: 18px;
    font-weight: 500;
    padding-bottom: var(--margins-lg);
    margin: var(--margins-md) auto;
    border-bottom: 1.5px solid ${props => (props.darkMode ? '#2D2D2D' : '#EEEEEE')};

    span {
      margin-left: 4px;
    }
  }

  .session-button {
    font-size: 16px;
    height: 36px;
    padding-top: 3px;
  }
`;

// tslint:disable-next-line: max-func-body-length
export const ReactClearAllModal = (props: Props): ReactElement => {
  const { reaction, messageId } = props;

  const [clearingInProgress, setClearingInProgress] = useState(false);

  const dispatch = useDispatch();
  const darkMode = useSelector(getTheme) === 'dark';
  const msgProps = useMessageReactsPropsById(messageId);

  if (!msgProps) {
    return <></>;
  }

  const { convoId, serverId } = msgProps;
  const roomInfos = getConversationController()
    .get(convoId)
    .toOpenGroupV2();

  const handleClose = () => {
    dispatch(updateReactClearAllModal(null));
  };

  const handleClearAll = async () => {
    if (roomInfos && serverId) {
      setClearingInProgress(true);
      await clearSogsReactionByServerId(reaction, serverId, roomInfos);
      setClearingInProgress(false);
      handleClose();
    } else {
      window.log.warn('Error for batch removal of', reaction, 'on message', messageId);
    }
  };

  return (
    <SessionWrapperModal
      additionalClassName={'reaction-list-modal'}
      showHeader={false}
      onClose={handleClose}
    >
      <StyledReactClearAllContainer
        container={true}
        flexDirection={'column'}
        alignItems="center"
        darkMode={darkMode}
      >
        <p>{window.i18n('clearAllReactions', [reaction])}</p>
        <StyledButtonContainer className="session-modal__button-group">
          <SessionButton2
            text={window.i18n('clear')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={handleClearAll}
            disabled={clearingInProgress}
          />
          <SessionButton2
            text={window.i18n('cancel')}
            buttonType={SessionButtonType.Simple}
            onClick={handleClose}
            disabled={clearingInProgress}
          />
        </StyledButtonContainer>
        <SessionSpinner loading={clearingInProgress} />
      </StyledReactClearAllContainer>
    </SessionWrapperModal>
  );
};
