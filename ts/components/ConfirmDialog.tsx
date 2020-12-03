import React from 'react';

import { SessionModal } from './session/SessionModal';
import { SessionButton } from './session/SessionButton';
import { DefaultTheme } from 'styled-components';
type Props = {
  titleText: string;
  messageText: string;
  okText: string;
  cancelText: string;
  onConfirm: any;
  onClose: any;
  theme: DefaultTheme;
};

export const ConfirmDialog = (props: Props) => {
  return (
    <SessionModal
      title={props.titleText}
      onClose={props.onClose}
      onOk={() => null}
      theme={props.theme}
    >
      <div className="spacer-md" />
      <p className="messageText">{props.messageText}</p>
      <div className="spacer-md" />

      <div className="session-modal__button-group">
        <SessionButton text={props.okText} onClick={props.onConfirm} />

        <SessionButton text={props.cancelText} onClick={props.onClose} />
      </div>
    </SessionModal>
  );
};
