import React, { useState } from 'react';
import { ConversationController } from '../../session/conversations/ConversationController';
import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { DefaultTheme, withTheme } from 'styled-components';

type Props = {
  message: string;
  title: string;
  placeholder?: string;
  onOk?: any;
  onClose?: any;
  onClickOk: any;
  onClickClose: any;
  hideCancel: boolean;
  okTheme: SessionButtonColor;
  theme: DefaultTheme;
  convoId?: string;
};

const SessionNicknameInner = (props: Props) => {
  const { title = '', message, onClickOk, onClickClose, convoId, placeholder } = props;
  const showHeader = true;
  const [nickname, setNickname] = useState('');

  /**
   * Changes the state of nickname variable. If enter is pressed, saves the current
   * entered nickname value as the nickname.
   */
  const onNicknameInput = async (event: any) => {
    if (event.key === 'Enter') {
      await saveNickname();
    }
    const currentNicknameEntered = event.target.value;
    setNickname(currentNicknameEntered);
  };

  /**
   * Saves the currently entered nickname.
   */
  const saveNickname = async () => {
    if (!convoId) {
      return;
    }
    const convo = ConversationController.getInstance().get(convoId);
    onClickOk(nickname);
    await convo.setNickname(nickname);
  };

  return (
    <SessionModal
      title={title}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={showHeader}
      theme={props.theme}
    >
      {!showHeader && <div className="spacer-lg" />}

      <div className="session-modal__centered">
        <span className="subtle">{message}</span>
        <div className="spacer-lg" />
      </div>

      <input
        type="nickname"
        id="nickname-modal-input"
        placeholder={placeholder}
        onKeyUp={onNicknameInput}
      />

      <div className="session-modal__button-group">
        <SessionButton text={window.i18n('ok')} onClick={saveNickname} />
        <SessionButton text={window.i18n('cancel')} onClick={onClickClose} />
      </div>
    </SessionModal>
  );
};

export const SessionNicknameDialog = withTheme(SessionNicknameInner);
