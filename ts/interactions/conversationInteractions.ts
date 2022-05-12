import {
  getCompleteUrlFromRoom,
  openGroupPrefixRegex,
  openGroupV2ConversationIdRegex,
} from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { CallManager, SyncUtils, ToastUtils, UserUtils } from '../session/utils';
import { ConversationNotificationSettingType, ConversationTypeEnum } from '../models/conversation';

import _ from 'lodash';
import { getConversationController } from '../session/conversations';
import { BlockedNumberController } from '../util/blockedNumberController';
import {
  adminLeaveClosedGroup,
  changeNickNameModal,
  updateAddModeratorsModal,
  updateBanOrUnbanUserModal,
  updateConfirmModal,
  updateGroupMembersModal,
  updateGroupNameModal,
  updateInviteContactModal,
  updateRemoveModeratorsModal,
} from '../state/ducks/modalDialog';
import {
  createOrUpdateItem,
  getItemById,
  getMessageById,
  hasLinkPreviewPopupBeenDisplayed,
  lastAvatarUploadTimestamp,
  removeAllMessagesInConversation,
} from '../data/data';
import {
  conversationReset,
  quoteMessage,
  resetConversationExternal,
} from '../state/ducks/conversations';
import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import { IMAGE_JPEG } from '../types/MIME';
import { FSv2 } from '../session/apis/file_server_api';
import { fromHexToArray, toHex } from '../session/utils/String';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/syncUtils';
import { SessionButtonColor } from '../components/basic/SessionButton';
import { getCallMediaPermissionsSettings } from '../components/settings/SessionSettings';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { processNewAttachment } from '../types/MessageAttachment';
import { urlToBlob } from '../types/attachments/VisualAttachment';
import { MIME } from '../types';
import { setLastProfileUpdateTimestamp } from '../util/storage';
import { getSodiumRenderer } from '../session/crypto';
import { encryptProfile } from '../util/crypto/profileEncrypter';

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

export async function blockConvoById(conversationId: string) {
  const conversation = getConversationController().get(conversationId);

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
  const conversation = getConversationController().get(conversationId);

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

/**
 * marks the conversation's approval fields, sends messageRequestResponse, syncs to linked devices
 */
export const approveConvoAndSendResponse = async (
  conversationId: string,
  syncToDevices: boolean = true
) => {
  const convoToApprove = getConversationController().get(conversationId);

  if (!convoToApprove || convoToApprove.isApproved()) {
    window?.log?.info('Conversation is already approved.');
    return;
  }

  await convoToApprove.setIsApproved(true, false);

  await convoToApprove.commit();
  await convoToApprove.sendMessageRequestResponse(true);

  // Conversation was not approved before so a sync is needed
  if (syncToDevices) {
    await forceSyncConfigurationNowIfNeeded();
  }
};

export const declineConversationWithConfirm = (convoId: string, syncToDevices: boolean = true) => {
  window?.inboxStore?.dispatch(
    updateConfirmModal({
      okText: window.i18n('decline'),
      cancelText: window.i18n('cancel'),
      message: window.i18n('declineRequestMessage'),
      onClickOk: async () => {
        await declineConversationWithoutConfirm(convoId, syncToDevices);
        await blockConvoById(convoId);
        await forceSyncConfigurationNowIfNeeded();
        window?.inboxStore?.dispatch(resetConversationExternal());
      },
      onClickCancel: () => {
        window?.inboxStore?.dispatch(updateConfirmModal(null));
      },
      onClickClose: () => {
        window?.inboxStore?.dispatch(updateConfirmModal(null));
      },
    })
  );
};

/**
 * Sets the approval fields to false for conversation. Sends decline message.
 */
export const declineConversationWithoutConfirm = async (
  conversationId: string,
  syncToDevices: boolean = true
) => {
  const conversationToDecline = getConversationController().get(conversationId);

  if (!conversationToDecline || conversationToDecline.isApproved()) {
    window?.log?.info('Conversation is already declined.');
    return;
  }

  await conversationToDecline.setIsApproved(false);

  // Conversation was not approved before so a sync is needed
  if (syncToDevices) {
    await forceSyncConfigurationNowIfNeeded();
  }
};

export async function showUpdateGroupNameByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  if (conversation.isMediumGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .get('members')
        .map(m => getConversationController().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE))
    );
  }
  window.inboxStore?.dispatch(updateGroupNameModal({ conversationId }));
}

export async function showUpdateGroupMembersByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  if (conversation.isMediumGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .get('members')
        .map(m => getConversationController().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE))
    );
  }
  window.inboxStore?.dispatch(updateGroupMembersModal({ conversationId }));
}

export function showLeaveGroupByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);

  if (!conversation.isGroup()) {
    throw new Error('showLeaveGroupDialog() called with a non group convo.');
  }

  const title = window.i18n('leaveGroup');
  const message = window.i18n('leaveGroupConfirmation');
  const ourPK = UserUtils.getOurPubKeyStrFromCache();
  const isAdmin = (conversation.get('groupAdmins') || []).includes(ourPK);
  const isClosedGroup = conversation.get('is_medium_group') || false;

  // if this is not a closed group, or we are not admin, we can just show a confirmation dialog
  if (!isClosedGroup || (isClosedGroup && !isAdmin)) {
    const onClickClose = () => {
      window.inboxStore?.dispatch(updateConfirmModal(null));
    };
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title,
        message,
        onClickOk: async () => {
          await conversation.leaveClosedGroup();
          onClickClose();
        },
        onClickClose,
      })
    );
  } else {
    window.inboxStore?.dispatch(
      adminLeaveClosedGroup({
        conversationId,
      })
    );
  }
}
export function showInviteContactByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateInviteContactModal({ conversationId }));
}
export async function onMarkAllReadByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);

  await conversation.markReadBouncy(Date.now());
}

export function showAddModeratorsByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateAddModeratorsModal({ conversationId }));
}

export function showRemoveModeratorsByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateRemoveModeratorsModal({ conversationId }));
}

export function showBanUserByConvoId(conversationId: string, pubkey?: string) {
  window.inboxStore?.dispatch(
    updateBanOrUnbanUserModal({ banType: 'ban', conversationId, pubkey })
  );
}

export function showUnbanUserByConvoId(conversationId: string, pubkey?: string) {
  window.inboxStore?.dispatch(
    updateBanOrUnbanUserModal({ banType: 'unban', conversationId, pubkey })
  );
}

export async function markAllReadByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  perfStart(`markAllReadByConvoId-${conversationId}`);

  await conversation.markReadBouncy(Date.now());
  perfEnd(`markAllReadByConvoId-${conversationId}`, 'markAllReadByConvoId');
}

export async function setNotificationForConvoId(
  conversationId: string,
  selected: ConversationNotificationSettingType
) {
  const conversation = getConversationController().get(conversationId);

  const existingSettings = conversation.get('triggerNotificationsFor');
  if (existingSettings !== selected) {
    conversation.set({ triggerNotificationsFor: selected });
    await conversation.commit();
  }
}
export async function clearNickNameByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  await conversation.setNickname(undefined);
}

export function showChangeNickNameByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(changeNickNameModal({ conversationId }));
}

export async function deleteAllMessagesByConvoIdNoConfirmation(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  await removeAllMessagesInConversation(conversationId);
  window.inboxStore?.dispatch(conversationReset(conversationId));

  // destroy message keeps the active timestamp set so the
  // conversation still appears on the conversation list but is empty
  conversation.set({
    lastMessage: null,
    unreadCount: 0,
    mentionedUs: false,
    isApproved: false,
  });

  await conversation.commit();
}

export function deleteAllMessagesByConvoIdWithConfirmation(conversationId: string) {
  const onClickClose = () => {
    window?.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const onClickOk = async () => {
    await deleteAllMessagesByConvoIdNoConfirmation(conversationId);
    onClickClose();
  };

  window?.inboxStore?.dispatch(
    updateConfirmModal({
      title: window.i18n('deleteMessages'),
      message: window.i18n('deleteConversationConfirmation'),
      onClickOk,
      okTheme: SessionButtonColor.Danger,
      onClickClose,
    })
  );
}

export async function setDisappearingMessagesByConvoId(
  conversationId: string,
  seconds: number | undefined
) {
  const conversation = getConversationController().get(conversationId);

  const canSetDisappearing = !conversation.isOutgoingRequest() && !conversation.isIncomingRequest();

  if (!canSetDisappearing) {
    ToastUtils.pushMustBeApproved();
    return;
  }

  if (!seconds || seconds <= 0) {
    await conversation.updateExpireTimer(null);
  } else {
    await conversation.updateExpireTimer(seconds);
  }
}

/**
 * This function can be used for reupload our avatar to the fsv2 or upload a new avatar.
 *
 * If this is a reupload, the old profileKey is used, otherwise a new one is generated
 */
export async function uploadOurAvatar(newAvatarDecrypted?: ArrayBuffer) {
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo) {
    window.log.warn('ourConvo not found... This is not a valid case');
    return;
  }

  let profileKey: Uint8Array | null;
  let decryptedAvatarData;
  if (newAvatarDecrypted) {
    // Encrypt with a new key every time
    profileKey = (await getSodiumRenderer()).randombytes_buf(32);
    decryptedAvatarData = newAvatarDecrypted;
  } else {
    // this is a reupload. no need to generate a new profileKey
    const ourConvoProfileKey =
      getConversationController()
        .get(UserUtils.getOurPubKeyStrFromCache())
        ?.get('profileKey') || null;

    profileKey = ourConvoProfileKey ? fromHexToArray(ourConvoProfileKey) : null;
    if (!profileKey) {
      window.log.info('our profileKey not found. Not reuploading our avatar');
      return;
    }
    const currentAttachmentPath = ourConvo.getAvatarPath();

    if (!currentAttachmentPath) {
      window.log.warn('No attachment currently set for our convo.. Nothing to do.');
      return;
    }

    const decryptedAvatarUrl = await getDecryptedMediaUrl(currentAttachmentPath, IMAGE_JPEG, true);

    if (!decryptedAvatarUrl) {
      window.log.warn('Could not decrypt avatar stored locally..');
      return;
    }
    const blob = await urlToBlob(decryptedAvatarUrl);

    decryptedAvatarData = await blob.arrayBuffer();
  }

  if (!decryptedAvatarData?.byteLength) {
    window.log.warn('Could not read content of avatar ...');
    return;
  }

  const encryptedData = await encryptProfile(decryptedAvatarData, profileKey);

  const avatarPointer = await FSv2.uploadFileToFsV2(encryptedData);
  let fileUrl;
  if (!avatarPointer) {
    window.log.warn('failed to upload avatar to fsv2');
    return;
  }
  ({ fileUrl } = avatarPointer);

  ourConvo.set('avatarPointer', fileUrl);

  // this encrypts and save the new avatar and returns a new attachment path
  const upgraded = await processNewAttachment({
    isRaw: true,
    data: decryptedAvatarData,
    contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
  });
  // Replace our temporary image with the attachment pointer from the server:
  ourConvo.set('avatar', null);
  const displayName = ourConvo.get('profileName');

  // write the profileKey even if it did not change
  ourConvo.set({ profileKey: toHex(profileKey) });
  // Replace our temporary image with the attachment pointer from the server:
  // this commits already
  await ourConvo.setLokiProfile({
    avatar: upgraded.path,
    displayName,
  });
  const newTimestampReupload = Date.now();
  await createOrUpdateItem({ id: lastAvatarUploadTimestamp, value: newTimestampReupload });

  if (newAvatarDecrypted) {
    await setLastProfileUpdateTimestamp(Date.now());
    await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
  } else {
    window.log.info(
      `Reuploading avatar finished at ${newTimestampReupload}, newAttachmentPointer ${fileUrl}`
    );
  }
}

export async function replyToMessage(messageId: string) {
  const quotedMessageModel = await getMessageById(messageId);
  if (!quotedMessageModel) {
    window.log.warn('Failed to find message to reply to');
    return;
  }
  const conversationModel = getConversationController().getOrThrow(
    quotedMessageModel.get('conversationId')
  );

  const quotedMessageProps = await conversationModel.makeQuote(quotedMessageModel);

  if (quotedMessageProps) {
    window.inboxStore?.dispatch(quoteMessage(quotedMessageProps));
  } else {
    window.inboxStore?.dispatch(quoteMessage(undefined));
  }
}

/**
 * Check if what is pasted is a URL and prompt confirmation for a setting change
 * @param e paste event
 */
export async function showLinkSharingConfirmationModalDialog(e: any) {
  const pastedText = e.clipboardData.getData('text');
  if (isURL(pastedText) && !window.getSettingValue('link-preview-setting', false)) {
    const alreadyDisplayedPopup =
      (await getItemById(hasLinkPreviewPopupBeenDisplayed))?.value || false;
    if (!alreadyDisplayedPopup) {
      window.inboxStore?.dispatch(
        updateConfirmModal({
          shouldShowConfirm:
            !window.getSettingValue('link-preview-setting') && !alreadyDisplayedPopup,
          title: window.i18n('linkPreviewsTitle'),
          message: window.i18n('linkPreviewsConfirmMessage'),
          okTheme: SessionButtonColor.Danger,
          onClickOk: () => {
            window.setSettingValue('link-preview-setting', true);
          },
          onClickClose: async () => {
            await createOrUpdateItem({ id: hasLinkPreviewPopupBeenDisplayed, value: true });
          },
        })
      );
    }
  }
}

/**
 *
 * @param str String to evaluate
 * @returns boolean if the string is true or false
 */
function isURL(str: string) {
  const urlRegex =
    '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
  const url = new RegExp(urlRegex, 'i');
  return str.length < 2083 && url.test(str);
}

export async function callRecipient(pubkey: string, canCall: boolean) {
  const convo = getConversationController().get(pubkey);

  if (!canCall) {
    ToastUtils.pushUnableToCall();
    return;
  }

  if (!getCallMediaPermissionsSettings()) {
    ToastUtils.pushVideoCallPermissionNeeded();
    return;
  }

  if (convo && convo.isPrivate() && !convo.isMe()) {
    await CallManager.USER_callRecipient(convo.id);
  }
}
