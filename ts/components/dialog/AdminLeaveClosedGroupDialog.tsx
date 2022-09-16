import React, { useState } from 'react';
import { SpacerLG } from '../basic/Text';
import { getConversationController } from '../../session/conversations';
import { adminLeaveClosedGroup } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionWrapperModal } from '../SessionWrapperModal';

type Props = {
  conversationId: string;
};

export const AdminLeaveClosedGroupDialog = (props: Props) => {
  const convo = getConversationController().get(props.conversationId);
  const titleText = `${window.i18n('leaveGroup')} ${convo.getRealSessionUsername()}`;
  const warningAsAdmin = `${window.i18n('leaveGroupConfirmationAdmin')}`;
  const okText = window.i18n('leaveAndRemoveForEveryone');
  const cancelText = window.i18n('cancel');
  const [_isLoading, setIsLoading] = useState(false);

  const onClickOK = async () => {
    setIsLoading(true);
    await getConversationController()
      .get(props.conversationId)
      .leaveClosedGroup();
    setIsLoading(false);

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
