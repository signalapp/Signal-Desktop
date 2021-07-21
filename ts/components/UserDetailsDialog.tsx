import React, { useState } from 'react';
import { Avatar, AvatarSize } from './Avatar';

import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';
import { SessionIdEditable } from './session/SessionIdEditable';
import { getConversationController } from '../session/conversations';
import { ConversationTypeEnum } from '../models/conversation';
import { SessionWrapperModal } from './session/SessionWrapperModal';
import { SpacerMD } from './basic/Text';
import { updateUserDetailsModal } from '../state/ducks/modalDialog';
import { openConversationExternal } from '../state/ducks/conversations';
// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
type Props = {
  conversationId: string;
  authorAvatarPath?: string;
  userName: string;
};

export const UserDetailsDialog = (props: Props) => {
  const [isEnlargedImageShown, setIsEnlargedImageShown] = useState(false);
  const convo = getConversationController().get(props.conversationId);

  const size = isEnlargedImageShown ? AvatarSize.HUGE : AvatarSize.XL;
  const userName = props.userName || props.conversationId;

  function closeDialog() {
    window.inboxStore?.dispatch(updateUserDetailsModal(null));
  }

  async function onClickStartConversation() {
    const conversation = await getConversationController().getOrCreateAndWait(
      convo.id,
      ConversationTypeEnum.PRIVATE
    );

    window.inboxStore?.dispatch(openConversationExternal({ id: conversation.id }));

    closeDialog();
  }

  useKey(
    'Enter',
    () => {
      void onClickStartConversation();
    },
    undefined,
    [props.conversationId]
  );

  return (
    <SessionWrapperModal title={props.userName} onClose={closeDialog} showExitIcon={true}>
      <div className="avatar-center">
        <div className="avatar-center-inner">
          <Avatar
            avatarPath={props.authorAvatarPath}
            name={userName}
            size={size}
            onAvatarClick={() => {
              setIsEnlargedImageShown(!isEnlargedImageShown);
            }}
            pubkey={props.conversationId}
          />
        </div>
      </div>

      <SpacerMD />
      <SessionIdEditable editable={false} text={convo.id} />

      <div className="session-modal__button-group__center">
        <SessionButton
          text={window.i18n('startConversation')}
          buttonType={SessionButtonType.Default}
          buttonColor={SessionButtonColor.Primary}
          onClick={onClickStartConversation}
        />
      </div>
    </SessionWrapperModal>
  );
};
