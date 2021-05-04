import React from 'react';

import { SessionModal } from '../session/SessionModal';
import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { DefaultTheme } from 'styled-components';

interface Props {
  groupName: string;
  onSubmit: any;
  onClose: any;
  theme: DefaultTheme;
}

class AdminLeaveClosedGroupDialogInner extends React.Component<Props> {
  constructor(props: any) {
    super(props);

    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
  }

  public render() {
    const titleText = `${window.i18n('leaveGroup')} ${this.props.groupName}`;
    const warningAsAdmin = `${window.i18n('leaveGroupConfirmationAdmin')}`;
    const okText = window.i18n('leaveAndRemoveForEveryone');

    return (
      <SessionModal title={titleText} onClose={this.closeDialog} theme={this.props.theme}>
        <div className="spacer-lg" />
        <p>{warningAsAdmin}</p>

        <div className="session-modal__button-group">
          <SessionButton
            text={okText}
            onClick={this.onClickOK}
            buttonColor={SessionButtonColor.Danger}
          />
        </div>
      </SessionModal>
    );
  }

  private onClickOK() {
    this.props.onSubmit();
    this.closeDialog();
  }

  private closeDialog() {
    this.props.onClose();
  }
}

export const AdminLeaveClosedGroupDialog = AdminLeaveClosedGroupDialogInner;
