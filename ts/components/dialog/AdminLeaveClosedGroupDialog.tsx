import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { getConversationController } from '../../session/conversations';
import { adminLeaveClosedGroup } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionSpinner } from '../basic/SessionSpinner';

const StyledWarning = styled.p`
  max-width: 500px;
  line-height: 1.3333;
`;

export const AdminLeaveClosedGroupDialog = (props: { conversationId: string }) => {
  const dispatch = useDispatch();
  const convo = getConversationController().get(props.conversationId);
  const [loading, setLoading] = useState(false);
  const titleText = `${window.i18n('leaveGroup')} ${convo?.getRealSessionUsername() || ''}`;

  const closeDialog = () => {
    dispatch(adminLeaveClosedGroup(null));
  };

  const onClickOK = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    // we know want to delete a closed group right after we've left it, so we can call the deleteContact which takes care of it all
    await getConversationController().deleteContact(props.conversationId, {
      fromSyncMessage: false,
    });
    setLoading(false);
    closeDialog();
  };

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog}>
      <SpacerLG />
      <StyledWarning>{window.i18n('leaveGroupConfirmationAdmin')}</StyledWarning>
      <SessionSpinner loading={loading} />

      <div className="session-modal__button-group">
        <SessionButton
          text={window.i18n('leaveAndRemoveForEveryone')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={onClickOK}
        />
        <SessionButton
          text={window.i18n('cancel')}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
        />
      </div>
    </SessionWrapperModal>
  );
};
