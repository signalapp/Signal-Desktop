import _ from 'lodash';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { ConversationModel } from '../models/conversation';
import { ApiV2 } from '../opengroup/opengroupV2';
import { isOpenGroupV2 } from '../opengroup/utils/OpenGroupUtils';
import { PubKey } from '../session/types';
import { ToastUtils } from '../session/utils';

export function banUser(userToBan: string, conversation?: ConversationModel) {
  let pubKeyToBan: PubKey;
  try {
    pubKeyToBan = PubKey.cast(userToBan);
  } catch (e) {
    window.log.warn(e);
    ToastUtils.pushUserBanFailure();
    return;
  }
  window.confirmationDialog({
    title: window.i18n('banUser'),
    message: window.i18n('banUserConfirm'),
    resolve: async () => {
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
          success = await ApiV2.banUser(pubKeyToBan, _.pick(roomInfos, 'serverUrl', 'roomId'));
        }
      } else {
        const channelAPI = await conversation.getPublicSendData();
        if (!channelAPI) {
          window.log.info('cannot ban user, the corresponding channelAPI was not found.');
          return;
        }
        success = await channelAPI.banUser(userToBan);
      }
      if (success) {
        ToastUtils.pushUserBanSuccess();
      } else {
        ToastUtils.pushUserBanFailure();
      }
    },
  });
}

/**
 * There is no way to unban on an opengroupv1 server.
 * This function only works for opengroupv2 server
 */
export function unbanUser(userToUnBan: string, conversation?: ConversationModel) {
  let pubKeyToUnban: PubKey;
  try {
    pubKeyToUnban = PubKey.cast(userToUnBan);
  } catch (e) {
    window.log.warn(e);
    ToastUtils.pushUserBanFailure();
    return;
  }
  if (!isOpenGroupV2(conversation?.id || '')) {
    window.log.warn('no way to unban on a opengroupv1');
    ToastUtils.pushUserBanFailure();
    return;
  }
  window.confirmationDialog({
    title: window.i18n('unbanUser'),
    message: window.i18n('unbanUserConfirm'),
    resolve: async () => {
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
    },
  });
}

export function copyBodyToClipboard(body?: string) {
  window.clipboard.writeText(body);

  ToastUtils.pushCopiedToClipBoard();
}

export function copyPubKey(sender: string) {
  // this.getSource return out pubkey if this is an outgoing message, or the sender pubkey
  window.clipboard.writeText();

  ToastUtils.pushCopiedToClipBoard();
}
