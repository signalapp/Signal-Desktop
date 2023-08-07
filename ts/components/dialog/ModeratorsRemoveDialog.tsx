import React, { useState } from 'react';
import { compact } from 'lodash';
import { useDispatch } from 'react-redux';

import { getConversationController } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { Flex } from '../basic/Flex';

import { updateRemoveModeratorsModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { MemberListItem } from '../MemberListItem';
import { useConversationPropsById } from '../../hooks/useParamSelector';
import { sogsV3RemoveAdmins } from '../../session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods';

type Props = {
  conversationId: string;
};

async function removeMods(convoId: string, modsToRemove: Array<string>) {
  if (modsToRemove.length === 0) {
    window?.log?.info('No moderators removed. Nothing todo');
    return false;
  }
  window?.log?.info(`asked to remove moderators: ${modsToRemove}`);

  try {
    const convo = getConversationController().get(convoId);

    const roomInfos = convo.toOpenGroupV2();
    const modsToRemovePubkey = compact(modsToRemove.map(m => PubKey.from(m)));
    const res = await sogsV3RemoveAdmins(modsToRemovePubkey, roomInfos);

    if (!res) {
      window?.log?.warn('failed to remove moderators:', res);

      ToastUtils.pushFailedToRemoveFromModerator();
      return false;
    }
    window?.log?.info(`${modsToRemove} removed from moderators...`);
    ToastUtils.pushUserRemovedFromModerators();
    return true;
  } catch (e) {
    window?.log?.error('Got error while removing moderator:', e);
    return false;
  }
}

export const RemoveModeratorsDialog = (props: Props) => {
  const { conversationId } = props;
  const [removingInProgress, setRemovingInProgress] = useState(false);
  const [modsToRemove, setModsToRemove] = useState<Array<string>>([]);
  const { i18n } = window;
  const dispatch = useDispatch();
  const closeDialog = () => {
    dispatch(updateRemoveModeratorsModal(null));
  };

  const removeModsCall = async () => {
    if (modsToRemove.length) {
      setRemovingInProgress(true);
      const removed = await removeMods(conversationId, modsToRemove);
      setRemovingInProgress(false);
      if (removed) {
        closeDialog();
      }
    }
  };

  const convoProps = useConversationPropsById(conversationId);
  if (!convoProps || !convoProps.isPublic || !convoProps.weAreAdmin) {
    throw new Error('RemoveModeratorsDialog: convoProps invalid');
  }

  const existingMods = convoProps.groupAdmins || [];
  const hasMods = existingMods.length !== 0;

  const title = `${i18n('removeModerators')}: ${convoProps.displayNameInProfile}`;
  return (
    <SessionWrapperModal title={title} onClose={closeDialog}>
      <Flex container={true} flexDirection="column" alignItems="center">
        {hasMods ? (
          <div className="contact-selection-list">
            {existingMods.map(modId => (
              <MemberListItem
                key={modId}
                pubkey={modId}
                isSelected={modsToRemove.some(m => m === modId)}
                onSelect={(selectedMember: string) => {
                  const updatedList = [...modsToRemove, selectedMember];
                  setModsToRemove(updatedList);
                }}
                onUnselect={(selectedMember: string) => {
                  const updatedList = modsToRemove.filter(m => m !== selectedMember);
                  setModsToRemove(updatedList);
                }}
                disableBg={true}
              />
            ))}
          </div>
        ) : (
          <p>{i18n('noModeratorsToRemove')}</p>
        )}

        <div className="session-modal__button-group">
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={removeModsCall}
            disabled={removingInProgress}
            text={i18n('ok')}
          />
          <SessionButton
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.Danger}
            onClick={closeDialog}
            disabled={removingInProgress}
            text={i18n('cancel')}
          />
        </div>

        <SessionSpinner loading={removingInProgress} />
      </Flex>
    </SessionWrapperModal>
  );
};
