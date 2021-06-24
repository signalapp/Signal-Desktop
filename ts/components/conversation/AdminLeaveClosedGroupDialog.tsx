import React from 'react';

import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { SessionWrapperModal } from '../session/SessionWrapperModal';
import { SpacerLG } from '../basic/Text';
import { getConversationController } from '../../session/conversations';
import { adminLeaveClosedGroup } from '../../state/ducks/modalDialog';

type Props = {
  conversationId: string;
};

export const AdminLeaveClosedGroupDialog = (props: Props) => {
  const convo = getConversationController().get(props.conversationId);
  const titleText = `${window.i18n('leaveGroup')} ${convo.getName()}`;
  const warningAsAdmin = `${window.i18n('leaveGroupConfirmationAdmin')}`;
  const okText = window.i18n('leaveAndRemoveForEveryone');
  const cancelText = window.i18n('cancel');

  const onClickOK = async () => {
    await getConversationController()
      .get(props.conversationId)
      .leaveClosedGroup();
    closeDialog();
  };

  const closeDialog = () => {
    window.inboxStore?.dispatch(adminLeaveClosedGroup(null));
  };

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog}>
      <SpacerLG />
      <p>{warningAsAdmin}</p>

      <div className="session-modal__button-group">
        <SessionButton text={okText} onClick={onClickOK} buttonColor={SessionButtonColor.Danger} />
        <SessionButton text={cancelText} onClick={closeDialog} />
      </div>
    </SessionWrapperModal>
  );
};
