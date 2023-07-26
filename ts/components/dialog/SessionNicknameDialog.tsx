import React, { useState } from 'react';
import _ from 'lodash';
import { useDispatch } from 'react-redux';

import { getConversationController } from '../../session/conversations';

import { SpacerLG } from '../basic/Text';
import { changeNickNameModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionWrapperModal } from '../SessionWrapperModal';

type Props = {
  conversationId: string;
};

export const SessionNicknameDialog = (props: Props) => {
  const { conversationId } = props;
  const [nickname, setNickname] = useState('');

  const dispatch = useDispatch();

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

  const onClickClose = () => {
    dispatch(changeNickNameModal(null));
  };

  /**
   * Saves the currently entered nickname.
   */
  const saveNickname = async () => {
    if (!conversationId) {
      throw new Error('Cant save without conversation id');
    }
    const conversation = getConversationController().get(conversationId);
    await conversation.setNickname(nickname, true);
    onClickClose();
  };

  return (
    <SessionWrapperModal
      title={window.i18n('changeNickname')}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={true}
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
        data-testid="nickname-input"
      />

      <div className="session-modal__button-group">
        <SessionButton
          text={window.i18n('ok')}
          buttonType={SessionButtonType.Simple}
          onClick={saveNickname}
          dataTestId="confirm-nickname"
        />
        <SessionButton
          text={window.i18n('cancel')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={onClickClose}
        />
      </div>
    </SessionWrapperModal>
  );
};
