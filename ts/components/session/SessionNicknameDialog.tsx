import React, { useState } from 'react';
import { ConversationController } from '../../session/conversations/ConversationController';
import { SessionButton } from './SessionButton';
import { DefaultTheme, useTheme, withTheme } from 'styled-components';

import _ from 'lodash';
import { SessionWrapperModal } from './SessionWrapperModal';
import { SpacerLG } from '../basic/Text';

type Props = {
  onClickOk?: any;
  onClickClose?: any;
  theme?: DefaultTheme;
  conversationId?: string;
};

const SessionNicknameInner = (props: Props) => {
  const { onClickOk, onClickClose, conversationId } = props;
  let { theme } = props;
  const [nickname, setNickname] = useState('');

  theme = theme ? theme : useTheme();

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
    if (!conversationId) {
      throw 'Cant save withou conversation id';
      // return;
    }
    const conversation = ConversationController.getInstance().get(conversationId);
    if (onClickOk) {
      onClickOk(nickname);
    }
    await conversation.setNickname(nickname);
    onClickClose();
  };

  return (
    // <SessionModal
    //   title={window.i18n('changeNickname')}
    //   onClose={onClickClose}
    //   showExitIcon={false}
    //   showHeader={true}
    //   theme={theme}
    // >

    // TODO: Implement showHeader option for modal
    <SessionWrapperModal
      title={window.i18n('changeNickname')}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={true}
      theme={theme}
    >
      <div className="session-modal__centered">
        <span className="subtle">{window.i18n('changeNicknameMessage')}</span>
        <SpacerLG />
      </div>

      <input
        autoFocus={true}
        type="nickname"
        id="nickname-modal-input"
        placeholder={window.i18n('nicknamePlaceholder')}
        onKeyUp={e => {
          void onNicknameInput(_.cloneDeep(e));
        }}
      />

      <div className="session-modal__button-group">
        <SessionButton text={window.i18n('ok')} onClick={saveNickname} />
        <SessionButton text={window.i18n('cancel')} onClick={onClickClose} />
      </div>
    </SessionWrapperModal>
  );
};

export const SessionNicknameDialog = withTheme(SessionNicknameInner);
