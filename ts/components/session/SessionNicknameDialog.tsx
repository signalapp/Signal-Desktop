import React, { useState } from 'react';
import { ConversationController } from '../../session/conversations/ConversationController';
import { SessionModal } from './SessionModal';
import { SessionButton } from './SessionButton';
import { DefaultTheme, withTheme } from 'styled-components';

import _ from 'lodash';

type Props = {
  onClickOk: any;
  onClickClose: any;
  theme: DefaultTheme;
  convoId: string;
};

const SessionNicknameInner = (props: Props) => {
  const { onClickOk, onClickClose, convoId, theme } = props;
  const [nickname, setNickname] = useState('');

  /**
   * Changes the state of nickname variable. If enter is pressed, saves the current
   * entered nickname value as the nickname.
   */
  const onNicknameInput = async (event: any) => {
    if (event.key === 'Enter') {
      await saveNickname();
    } else {
      const currentNicknameEntered = event.target.value;
      setNickname(currentNicknameEntered);
    }
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
      title={window.i18n('changeNickname')}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={true}
      theme={theme}
    >
      <div className="session-modal__centered">
        <span className="subtle">{window.i18n('changeNicknameMessage')}</span>
        <div className="spacer-lg" />
      </div>

      <input
        type="nickname"
        id="nickname-modal-input"
        placeholder={window.i18n('nicknamePlaceholder')}
        onKeyPress={e => {
          void onNicknameInput(_.cloneDeep(e));
        }}
      />

      <div className="session-modal__button-group">
        <SessionButton text={window.i18n('ok')} onClick={saveNickname} />
        <SessionButton text={window.i18n('cancel')} onClick={onClickClose} />
      </div>
    </SessionModal>
  );
};

export const SessionNicknameDialog = withTheme(SessionNicknameInner);
