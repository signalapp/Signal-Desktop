import {
  getCompleteUrlFromRoom,
  openGroupPrefixRegex,
  openGroupV2ConversationIdRegex,
} from '../opengroup/utils/OpenGroupUtils';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { ToastUtils } from '../session/utils';
import {
  ConversationModel,
  ConversationNotificationSettingType,
  ConversationTypeEnum,
} from '../models/conversation';
import { MessageModel } from '../models/message';
import { ApiV2 } from '../opengroup/opengroupV2';

import _ from 'lodash';
import { ConversationController } from '../session/conversations';
import { BlockedNumberController } from '../util/blockedNumberController';
import {
  updateAddModeratorsModal,
  updateConfirmModal,
  updateGroupMembersModal,
  updateGroupNameModal,
  updateInviteContactModal,
  updateRemoveModeratorsModal,
} from '../state/ducks/modalDialog';
import { removeAllMessagesInConversation } from '../data/data';
import { conversationReset } from '../state/ducks/conversations';

export const getCompleteUrlForV2ConvoId = async (convoId: string) => {
  if (convoId.match(openGroupV2ConversationIdRegex)) {
    // this is a v2 group, just build the url
    const roomInfos = await getV2OpenGroupRoom(convoId);
    if (roomInfos) {
      const fullUrl = getCompleteUrlFromRoom(roomInfos);

      return fullUrl;
    }
  }
  return undefined;
};

export async function copyPublicKeyByConvoId(convoId: string) {
  if (convoId.match(openGroupPrefixRegex)) {
    // open group v1 or v2
    if (convoId.match(openGroupV2ConversationIdRegex)) {
      // this is a v2 group, just build the url
      const completeUrl = await getCompleteUrlForV2ConvoId(convoId);
      if (completeUrl) {
        window.clipboard.writeText(completeUrl);

        ToastUtils.pushCopiedToClipBoard();
        return;
      }
      window?.log?.warn('copy to pubkey no roomInfo');
      return;
    }

    // this is a v1
    const atIndex = convoId.indexOf('@');
    const openGroupUrl = convoId.substr(atIndex + 1);
    window.clipboard.writeText(openGroupUrl);

    ToastUtils.pushCopiedToClipBoard();
    return;
  }
  window.clipboard.writeText(convoId);

  ToastUtils.pushCopiedToClipBoard();
}

/**
 *
 * @param messages the list of MessageModel to delete
 * @param convo the conversation to delete from (only v2 opengroups are supported)
 */
export async function deleteOpenGroupMessages(
  messages: Array<MessageModel>,
  convo: ConversationModel
): Promise<Array<MessageModel>> {
  if (!convo.isPublic()) {
    throw new Error('cannot delete public message on a non public groups');
  }

  if (convo.isOpenGroupV2()) {
    const roomInfos = convo.toOpenGroupV2();
    // on v2 servers we can only remove a single message per request..
    // so logic here is to delete each messages and get which one where not removed
    const validServerIdsToRemove = _.compact(
      messages.map(msg => {
        const serverId = msg.get('serverId');
        return serverId;
      })
    );

    const validMessageModelsToRemove = _.compact(
      messages.map(msg => {
        const serverId = msg.get('serverId');
        if (serverId) {
          return msg;
        }
        return undefined;
      })
    );

    let allMessagesAreDeleted: boolean = false;
    if (validServerIdsToRemove.length) {
      allMessagesAreDeleted = await ApiV2.deleteMessageByServerIds(
        validServerIdsToRemove,
        roomInfos
      );
    }
    // remove only the messages we managed to remove on the server
    if (allMessagesAreDeleted) {
      window?.log?.info('Removed all those serverIds messages successfully');
      return validMessageModelsToRemove;
    } else {
      window?.log?.info(
        'failed to remove all those serverIds message. not removing them locally neither'
      );
      return [];
    }
  } else {
    throw new Error('Opengroupv1 are not supported anymore');
  }
}

export async function blockConvoById(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);

  if (!conversation.id || conversation.isPublic()) {
    return;
  }

  const promise = conversation.isPrivate()
    ? BlockedNumberController.block(conversation.id)
    : BlockedNumberController.blockGroup(conversation.id);
  await promise;
  await conversation.commit();
  ToastUtils.pushToastSuccess('blocked', window.i18n('blocked'));
}

export async function unblockConvoById(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);

  if (!conversation) {
    // we assume it's a block contact and not group.
    // this is to be able to unlock a contact we don't have a conversation with.
    await BlockedNumberController.unblock(conversationId);
    ToastUtils.pushToastSuccess('unblocked', window.i18n('unblocked'));
    return;
  }
  if (!conversation.id || conversation.isPublic()) {
    return;
  }
  const promise = conversation.isPrivate()
    ? BlockedNumberController.unblock(conversationId)
    : BlockedNumberController.unblockGroup(conversationId);
  await promise;
  ToastUtils.pushToastSuccess('unblocked', window.i18n('unblocked'));
  await conversation.commit();
}

export async function showUpdateGroupNameByConvoId(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);
  if (conversation.isMediumGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .get('members')
        .map(m =>
          ConversationController.getInstance().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE)
        )
    );
  }
  window.inboxStore?.dispatch(updateGroupNameModal({ conversationId }));
}

export async function showUpdateGroupMembersByConvoId(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);
  if (conversation.isMediumGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .get('members')
        .map(m =>
          ConversationController.getInstance().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE)
        )
    );
  }
  window.inboxStore?.dispatch(updateGroupMembersModal({ conversationId }));
}

export function showLeaveGroupByConvoId(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);
  throw new Error('Audric TODO');
  window.Whisper.events.trigger('leaveClosedGroup', conversation);
}
export function showInviteContactByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateInviteContactModal({ conversationId }));
}
export async function onMarkAllReadByConvoId(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);

  await conversation.markReadBouncy(Date.now());
}

export function showAddModeratorsByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateAddModeratorsModal({ conversationId }));
}

export function showRemoveModeratorsByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateRemoveModeratorsModal({ conversationId }));
}

export async function markAllReadByConvoId(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);
  await conversation.markReadBouncy(Date.now());
}

export async function setNotificationForConvoId(
  conversationId: string,
  selected: ConversationNotificationSettingType
) {
  const conversation = ConversationController.getInstance().get(conversationId);

  const existingSettings = conversation.get('triggerNotificationsFor');
  if (existingSettings !== selected) {
    conversation.set({ triggerNotificationsFor: selected });
    await conversation.commit();
  }
}
export async function clearNickNameByConvoId(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);
  await conversation.setNickname('');
}

export async function deleteMessagesByConvoIdNoConfirmation(conversationId: string) {
  const conversation = ConversationController.getInstance().get(conversationId);
  await removeAllMessagesInConversation(conversationId);
  window.inboxStore?.dispatch(
    conversationReset({
      conversationKey: conversationId,
    })
  );

  // destroy message keeps the active timestamp set so the
  // conversation still appears on the conversation list but is empty
  conversation.set({
    lastMessage: null,
    unreadCount: 0,
    mentionedUs: false,
  });

  await conversation.commit();
}

export function deleteMessagesByConvoIdWithConfirmation(conversationId: string) {
  const onClickClose = () => {
    window?.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const onClickOk = () => {
    void deleteMessagesByConvoIdNoConfirmation(conversationId);
    onClickClose();
  };

  window?.inboxStore?.dispatch(
    updateConfirmModal({
      title: window.i18n('deleteMessages'),
      message: window.i18n('deleteConversationConfirmation'),
      onClickOk,
      onClickClose,
    })
  );
}

export async function setDisappearingMessagesByConvoId(
  conversationId: string,
  seconds: number | undefined
) {
  const conversation = ConversationController.getInstance().get(conversationId);

  if (!seconds || seconds <= 0) {
    await conversation.updateExpirationTimer(null);
  } else {
    await conversation.updateExpirationTimer(seconds);
  }
}
