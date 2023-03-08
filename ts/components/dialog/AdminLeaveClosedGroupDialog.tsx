import React from 'react';
import styled from 'styled-components';
import { getConversationController } from '../../session/conversations';
import { leaveClosedGroup } from '../../session/group/closed-group';
import { adminLeaveClosedGroup } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionWrapperModal } from '../SessionWrapperModal';

type Props = {
  conversationId: string;
};

const StyledWarning = styled.p`
  max-width: 500px;
  line-height: 1.3333;
`;

export const AdminLeaveClosedGroupDialog = (props: Props) => {
  const convo = getConversationController().get(props.conversationId);
  const titleText = `${window.i18n('leaveGroup')} ${convo.getRealSessionUsername()}`;
  const warningAsAdmin = `${window.i18n('leaveGroupConfirmationAdmin')}`;
  const okText = window.i18n('leaveAndRemoveForEveryone');
  const cancelText = window.i18n('cancel');

  const onClickOK = async () => {
    await leaveClosedGroup(props.conversationId);
    closeDialog();
  };

  const closeDialog = () => {
    window.inboxStore?.dispatch(adminLeaveClosedGroup(null));
  };

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog}>
      <SpacerLG />
      <StyledWarning>{warningAsAdmin}</StyledWarning>

      <div className="session-modal__button-group">
        <SessionButton
          text={okText}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={onClickOK}
        />
        <SessionButton
          text={cancelText}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
        />
      </div>
    </SessionWrapperModal>
  );
};
