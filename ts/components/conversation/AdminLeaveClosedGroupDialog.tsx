import React from 'react';

import { SessionModal } from '../session/SessionModal';
import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { DefaultTheme, useTheme } from 'styled-components';
import { SessionWrapperModal } from '../session/SessionWrapperModal';

interface Props {
  groupName: string;
  onSubmit: () => any;
  onClose: any;
  theme: DefaultTheme;
}

const AdminLeaveClosedGroupDialogInner = (props: Props) => {

  const { groupName, theme, onSubmit, onClose } = props;

  const titleText = `${window.i18n('leaveGroup')} ${groupName}`;
  const warningAsAdmin = `${window.i18n('leaveGroupConfirmationAdmin')}`;
  const okText = window.i18n('leaveAndRemoveForEveryone');
  const cancelText = window.i18n('cancel');

  const onClickOK = () => {
    void onSubmit();
    closeDialog();
  }

  const closeDialog = () => {
    onClose();
  }

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog} theme={theme}>

      <div className="spacer-lg" />
      <p>{warningAsAdmin}</p>

      <div className="session-modal__button-group">
        <SessionButton
          text={okText}
          onClick={onClickOK}
          buttonColor={SessionButtonColor.Danger}
        />
        <SessionButton
          text={cancelText}
          onClick={closeDialog}
        />
      </div>
    </SessionWrapperModal>
  );
}

export const AdminLeaveClosedGroupDialog = AdminLeaveClosedGroupDialogInner;
