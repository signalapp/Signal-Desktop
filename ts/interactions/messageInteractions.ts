import _ from 'lodash';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { ApiV2 } from '../opengroup/opengroupV2';
import { joinOpenGroupV2WithUIEvents } from '../opengroup/opengroupV2/JoinOpenGroupV2';
import { isOpenGroupV2, openGroupV2CompleteURLRegex } from '../opengroup/utils/OpenGroupUtils';
import { getConversationController } from '../session/conversations';
import { PubKey } from '../session/types';
import { ToastUtils } from '../session/utils';

import { updateConfirmModal } from '../state/ducks/modalDialog';

export function banUser(
  userToBan: string,
  conversationId: string,
  deleteAllMessages: boolean = false
) {
  let pubKeyToBan: PubKey;
  try {
    pubKeyToBan = PubKey.cast(userToBan);
  } catch (e) {
    window?.log?.warn(e);
    ToastUtils.pushUserBanFailure();
    return;
  }

  const onClickClose = () => {
    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const title = deleteAllMessages ? window.i18n('banUserAndDeleteAll') : window.i18n('banUser');
  const message = deleteAllMessages
    ? window.i18n('banUserAndDeleteAllConfirm')
    : window.i18n('banUserConfirm');

  const confirmationModalProps = {
    title,
    message,
    onClickClose,
    onClickOk: async () => {
      const conversation = getConversationController().get(conversationId);
      if (!conversation) {
        window.log.info('cannot ban user, the corresponding conversation was not found.');
        return;
      }
      let success = false;
      if (isOpenGroupV2(conversation.id)) {
        const roomInfos = await getV2OpenGroupRoom(conversation.id);
        if (!roomInfos) {
          window.log.warn('banUser room not found');
        } else {
          success = await ApiV2.banUser(
            pubKeyToBan,
            _.pick(roomInfos, 'serverUrl', 'roomId'),
            deleteAllMessages
          );
        }
      } else {
        throw new Error('V1 opengroup are not supported');
      }
      if (success) {
        ToastUtils.pushUserBanSuccess();
      } else {
        ToastUtils.pushUserBanFailure();
      }
    },
  };

  window.inboxStore?.dispatch(updateConfirmModal(confirmationModalProps));
}

/**
 * There is no way to unban on an opengroupv1 server.
 * This function only works for opengroupv2 server
 */
export function unbanUser(userToUnBan: string, conversationId: string) {
  let pubKeyToUnban: PubKey;
  try {
    pubKeyToUnban = PubKey.cast(userToUnBan);
  } catch (e) {
    window?.log?.warn(e);
    ToastUtils.pushUserBanFailure();
    return;
  }
  if (!isOpenGroupV2(conversationId || '')) {
    window?.log?.warn('no way to unban on a opengroupv1');
    ToastUtils.pushUserBanFailure();
    return;
  }

  const onClickClose = () => window.inboxStore?.dispatch(updateConfirmModal(null));

  const onClickOk = async () => {
    const conversation = getConversationController().get(conversationId);

    if (!conversation) {
      // double check here. the convo might have been removed since the dialog was opened
      window.log.info('cannot unban user, the corresponding conversation was not found.');
      return;
    }
    let success = false;
    if (isOpenGroupV2(conversation.id)) {
      const roomInfos = await getV2OpenGroupRoom(conversation.id);
      if (!roomInfos) {
        window.log.warn('unbanUser room not found');
      } else {
        success = await ApiV2.unbanUser(pubKeyToUnban, _.pick(roomInfos, 'serverUrl', 'roomId'));
      }
    }
    if (success) {
      ToastUtils.pushUserUnbanSuccess();
    } else {
      ToastUtils.pushUserUnbanFailure();
    }
  };

  window.inboxStore?.dispatch(
    updateConfirmModal({
      title: window.i18n('unbanUser'),
      message: window.i18n('unbanUserConfirm'),
      onClickOk,
      onClickClose,
    })
  );
}

export function copyBodyToClipboard(body?: string | null) {
  window.clipboard.writeText(body);

  ToastUtils.pushCopiedToClipBoard();
}

export async function removeSenderFromModerator(sender: string, convoId: string) {
  try {
    const pubKeyToRemove = PubKey.cast(sender);
    const convo = getConversationController().getOrThrow(convoId);

    const roomInfo = convo.toOpenGroupV2();
    const res = await ApiV2.removeModerator(pubKeyToRemove, roomInfo);
    if (!res) {
      window?.log?.warn('failed to remove moderator:', res);

      ToastUtils.pushFailedToRemoveFromModerator();
    } else {
      window?.log?.info(`${pubKeyToRemove.key} removed from moderators...`);
      ToastUtils.pushUserRemovedFromModerators();
    }
  } catch (e) {
    window?.log?.error('Got error while removing moderator:', e);
  }
}

export async function addSenderAsModerator(sender: string, convoId: string) {
  try {
    const pubKeyToAdd = PubKey.cast(sender);
    const convo = getConversationController().getOrThrow(convoId);

    const roomInfo = convo.toOpenGroupV2();
    const res = await ApiV2.addModerator(pubKeyToAdd, roomInfo);
    if (!res) {
      window?.log?.warn('failed to add moderator:', res);

      ToastUtils.pushFailedToAddAsModerator();
    } else {
      window?.log?.info(`${pubKeyToAdd.key} added to moderators...`);
      ToastUtils.pushUserAddedToModerators();
    }
  } catch (e) {
    window?.log?.error('Got error while adding moderator:', e);
  }
}

const acceptOpenGroupInvitationV2 = (completeUrl: string, roomName?: string) => {
  const onClickClose = () => {
    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  window.inboxStore?.dispatch(
    updateConfirmModal({
      title: window.i18n('joinOpenGroupAfterInvitationConfirmationTitle', [roomName || 'Unknown']),
      message: window.i18n('joinOpenGroupAfterInvitationConfirmationDesc', [roomName || 'Unknown']),
      onClickOk: async () => {
        await joinOpenGroupV2WithUIEvents(completeUrl, true, false);
      },

      onClickClose,
    })
  );
  // this function does not throw, and will showToasts if anything happens
};

/**
 * Accepts a v2 url open group invitation (with pubkey) or just log an error
 */
export const acceptOpenGroupInvitation = (completeUrl: string, roomName?: string) => {
  if (completeUrl.match(openGroupV2CompleteURLRegex)) {
    acceptOpenGroupInvitationV2(completeUrl, roomName);
  } else {
    window?.log?.warn('Invalid opengroup url:', completeUrl);
  }
};
