import React from 'react';

import { SessionModal } from './session/SessionModal';
import { SessionButton } from './session/SessionButton';

interface Props {
  titleText: string;
  messageText: string;
  okText: string;
  cancelText: string;
  onConfirm: any;
  onClose: any;
}

export class ConfirmDialog extends React.Component<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    return (
      <SessionModal
        title={this.props.titleText}
        onClose={this.props.onClose}
        onOk={() => null}
      >
        <div className="spacer-md" />
        <p className="messageText">{this.props.messageText}</p>
        <div className="spacer-md" />

        <div className="session-modal__button-group">
          <SessionButton
            text={this.props.okText}
            onClick={this.props.onConfirm}
          />

          <SessionButton
            text={this.props.cancelText}
            onClick={this.props.onClose}
          />
        </div>
      </SessionModal>
    );
  }
}
