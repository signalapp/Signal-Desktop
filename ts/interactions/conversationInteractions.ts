import { isNil } from 'lodash';
import {
  ConversationNotificationSettingType,
  ConversationTypeEnum,
  READ_MESSAGE_STATE,
} from '../models/conversationAttributes';
import { CallManager, SyncUtils, ToastUtils, UserUtils } from '../session/utils';

import { SessionButtonColor } from '../components/basic/SessionButton';
import { getCallMediaPermissionsSettings } from '../components/settings/SessionSettings';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { uploadFileToFsWithOnionV4 } from '../session/apis/file_server_api/FileServerApi';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { GetNetworkTime } from '../session/apis/snode_api/getNetworkTime';
import { getConversationController } from '../session/conversations';
import { getSodiumRenderer } from '../session/crypto';
import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import { DisappearingMessageConversationModeType } from '../session/disappearing_messages/types';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { fromHexToArray, toHex } from '../session/utils/String';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { SessionUtilContact } from '../session/utils/libsession/libsession_utils_contacts';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/sync/syncUtils';
import {
  conversationReset,
  quoteMessage,
  resetConversationExternal,
} from '../state/ducks/conversations';
import {
  changeNickNameModal,
  updateAddModeratorsModal,
  updateBanOrUnbanUserModal,
  updateConfirmModal,
  updateGroupMembersModal,
  updateGroupNameModal,
  updateInviteContactModal,
  updateRemoveModeratorsModal,
} from '../state/ducks/modalDialog';
import { MIME } from '../types';
import { IMAGE_JPEG } from '../types/MIME';
import { processNewAttachment } from '../types/MessageAttachment';
import { urlToBlob } from '../types/attachments/VisualAttachment';
import { BlockedNumberController } from '../util/blockedNumberController';
import { encryptProfile } from '../util/crypto/profileEncrypter';
import { ReleasedFeatures } from '../util/releaseFeature';
import { Storage, setLastProfileUpdateTimestamp } from '../util/storage';
import { UserGroupsWrapperActions } from '../webworker/workers/browser/libsession_worker_interface';

export enum ConversationInteractionStatus {
  Start = 'start',
  Loading = 'loading',
  Error = 'error',
  Complete = 'complete',
}

export enum ConversationInteractionType {
  Hide = 'hide',
  Leave = 'leave',
}

export async function copyPublicKeyByConvoId(convoId: string) {
  if (OpenGroupUtils.isOpenGroupV2(convoId)) {
    const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(convoId);

    if (!fromWrapper) {
      window.log.warn('opengroup to copy was not found in the UserGroupsWrapper');
      return;
    }

    if (fromWrapper.fullUrlWithPubkey) {
      window.clipboard.writeText(fromWrapper.fullUrlWithPubkey);
      ToastUtils.pushCopiedToClipBoard();
    }
  } else {
    window.clipboard.writeText(convoId);
  }
}

export async function blockConvoById(conversationId: string) {
  const conversation = getConversationController().get(conversationId);

  if (!conversation.id || conversation.isPublic()) {
    return;
  }

  // I don't think we want to reset the approved fields when blocking a contact
  // if (conversation.isPrivate()) {
  //   await conversation.setIsApproved(false);
  // }

  await BlockedNumberController.block(conversation.id);
  await conversation.commit();
  ToastUtils.pushToastSuccess('blocked', window.i18n('blocked'));
}

export async function unblockConvoById(conversationId: string) {
  const conversation = getConversationController().get(conversationId);

  if (!conversation) {
    // we assume it's a block contact and not group.
    // this is to be able to unlock a contact we don't have a conversation with.
    await BlockedNumberController.unblockAll([conversationId]);
    ToastUtils.pushToastSuccess('unblocked', window.i18n('unblocked'));
    return;
  }
  if (!conversation.id || conversation.isPublic()) {
    return;
  }
  await BlockedNumberController.unblockAll([conversationId]);
  ToastUtils.pushToastSuccess('unblocked', window.i18n('unblocked'));
  await conversation.commit();
}

/**
 * marks the conversation's approval fields, sends messageRequestResponse, syncs to linked devices
 */
export const approveConvoAndSendResponse = async (conversationId: string) => {
  const convoToApprove = getConversationController().get(conversationId);

  if (!convoToApprove) {
    window?.log?.info('Conversation is already approved.');
    return;
  }

  await convoToApprove.setIsApproved(true, false);

  await convoToApprove.commit();
  await convoToApprove.sendMessageRequestResponse();
};

export async function declineConversationWithoutConfirm({
  blockContact,
  conversationId,
  currentlySelectedConvo,
  syncToDevices,
}: {
  conversationId: string;
  currentlySelectedConvo: string | undefined;
  syncToDevices: boolean;
  blockContact: boolean; // if set to false, the contact will just be set to not approved
}) {
  const conversationToDecline = getConversationController().get(conversationId);

  if (!conversationToDecline || !conversationToDecline.isPrivate()) {
    window?.log?.info('No conversation to decline.');
    return;
  }

  // Note: do not set the active_at undefined as this would make that conversation not synced with the libsession wrapper
  await conversationToDecline.setIsApproved(false, false);
  await conversationToDecline.setDidApproveMe(false, false);
  // this will update the value in the wrapper if needed but not remove the entry if we want it gone. The remove is done below with removeContactFromWrapper
  await conversationToDecline.commit();
  if (blockContact) {
    await blockConvoById(conversationId);
  }
  // when removing a message request, without blocking it, we actually have no need to store the conversation in the wrapper. So just remove the entry

  if (
    conversationToDecline.isPrivate() &&
    !SessionUtilContact.isContactToStoreInWrapper(conversationToDecline)
  ) {
    await SessionUtilContact.removeContactFromWrapper(conversationToDecline.id);
  }

  if (syncToDevices) {
    await forceSyncConfigurationNowIfNeeded();
  }
  if (currentlySelectedConvo && currentlySelectedConvo === conversationId) {
    window?.inboxStore?.dispatch(resetConversationExternal());
  }
}

export const declineConversationWithConfirm = ({
  conversationId,
  syncToDevices,
  blockContact,
  currentlySelectedConvo,
}: {
  conversationId: string;
  currentlySelectedConvo: string | undefined;
  syncToDevices: boolean;
  blockContact: boolean; // if set to false, the contact will just be set to not approved
}) => {
  window?.inboxStore?.dispatch(
    updateConfirmModal({
      okText: blockContact ? window.i18n('block') : window.i18n('decline'),
      cancelText: window.i18n('cancel'),
      message: window.i18n('declineRequestMessage'),
      onClickOk: async () => {
        await declineConversationWithoutConfirm({
          conversationId,
          currentlySelectedConvo,
          blockContact,
          syncToDevices,
        });
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

export async function showUpdateGroupNameByConvoId(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  if (conversation.isClosedGroup()) {
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
  if (conversation.isClosedGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .get('members')
        .map(m => getConversationController().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE))
    );
  }
  window.inboxStore?.dispatch(updateGroupMembersModal({ conversationId }));
}

export function showLeavePrivateConversationbyConvoId(
  conversationId: string,
  name: string | undefined
) {
  const conversation = getConversationController().get(conversationId);
  const isMe = conversation.isMe();

  if (!conversation.isPrivate()) {
    throw new Error('showLeavePrivateConversationDialog() called with a non private convo.');
  }

  const onClickClose = () => {
    window?.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const onClickOk = async () => {
    try {
      await updateConversationInteractionState({
        conversationId,
        type: isMe ? ConversationInteractionType.Hide : ConversationInteractionType.Leave,
        status: ConversationInteractionStatus.Start,
      });
      onClickClose();
      await getConversationController().delete1o1(conversationId, {
        fromSyncMessage: false,
        justHidePrivate: true,
        keepMessages: isMe,
      });
      await clearConversationInteractionState({ conversationId });
    } catch (err) {
      window.log.warn(`showLeavePrivateConversationbyConvoId error: ${err}`);
      await saveConversationInteractionErrorAsMessage({
        conversationId,
        interactionType: isMe
          ? ConversationInteractionType.Hide
          : ConversationInteractionType.Leave,
      });
    }
  };

  window?.inboxStore?.dispatch(
    updateConfirmModal({
      title: isMe ? window.i18n('hideConversation') : window.i18n('deleteConversation'),
      message: isMe
        ? window.i18n('hideNoteToSelfConfirmation')
        : window.i18n('deleteConversationConfirmation', name ? [name] : ['']),
      onClickOk,
      okText: isMe ? window.i18n('hide') : window.i18n('delete'),
      okTheme: SessionButtonColor.Danger,
      onClickClose,
      conversationId,
    })
  );
}

async function leaveGroupOrCommunityByConvoId(
  conversationId: string,
  isPublic: boolean,
  forceDeleteLocal: boolean,
  onClickClose?: () => void
) {
  try {
    if (onClickClose) {
      onClickClose();
    }

    if (isPublic) {
      await getConversationController().deleteCommunity(conversationId, {
        fromSyncMessage: false,
      });
      return;
    }
    // for groups, we have a "leaving..." state that we don't need for communities.
    // that's because communities can be left always, whereas for groups we need to send a leave message (and so have some encryption keypairs)
    await updateConversationInteractionState({
      conversationId,
      type: ConversationInteractionType.Leave,
      status: ConversationInteractionStatus.Start,
    });
    await getConversationController().deleteClosedGroup(conversationId, {
      fromSyncMessage: false,
      sendLeaveMessage: true,
      forceDeleteLocal,
    });
    await clearConversationInteractionState({ conversationId });
  } catch (err) {
    window.log.warn(`showLeaveGroupByConvoId error: ${err}`);
    await saveConversationInteractionErrorAsMessage({
      conversationId,
      interactionType: ConversationInteractionType.Leave,
    });
  }
}

export async function showLeaveGroupByConvoId(conversationId: string, name: string | undefined) {
  const conversation = getConversationController().get(conversationId);

  if (!conversation.isGroup()) {
    throw new Error('showLeaveGroupDialog() called with a non group convo.');
  }

  const isClosedGroup = conversation.isClosedGroup() || false;
  const isPublic = conversation.isPublic() || false;
  const admins = conversation.get('groupAdmins') || [];
  const isAdmin = admins.includes(UserUtils.getOurPubKeyStrFromCache());
  const showOnlyGroupAdminWarning = isClosedGroup && isAdmin && admins.length === 1;
  const lastMessageInteractionType = conversation.get('lastMessageInteractionType');
  const lastMessageInteractionStatus = conversation.get('lastMessageInteractionStatus');

  if (
    !isPublic &&
    lastMessageInteractionType === ConversationInteractionType.Leave &&
    lastMessageInteractionStatus === ConversationInteractionStatus.Error
  ) {
    await leaveGroupOrCommunityByConvoId(conversationId, isPublic, true);
    return;
  }

  // if this is a community, or we legacy group are not admin, we can just show a confirmation dialog

  const onClickClose = () => {
    window?.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const onClickOk = async () => {
    await leaveGroupOrCommunityByConvoId(conversationId, isPublic, false, onClickClose);
  };

  if (showOnlyGroupAdminWarning) {
    // NOTE For legacy closed groups
    window?.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('leaveGroup'),
        message: window.i18n('leaveGroupConrirmationOnlyAdminLegacy', name ? [name] : ['']),
        onClickOk,
        okText: window.i18n('leave'),
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        conversationId,
      })
    );
    // TODO Only to be used after the closed group rebuild
    // const onClickOkLastAdmin = () => {
    //   /* TODO */
    // };
    // const onClickCloseLastAdmin = () => {
    //   /* TODO */
    // };
    // window?.inboxStore?.dispatch(
    //   updateConfirmModal({
    //     title: window.i18n('leaveGroup'),
    //     message: window.i18n('leaveGroupConfirmationOnlyAdmin', name ? [name] : ['']),
    //     messageSub: window.i18n('leaveGroupConfirmationOnlyAdminWarning'),
    //     onClickOk: onClickOkLastAdmin,
    //     okText: window.i18n('addModerator'),
    //     cancelText: window.i18n('leave'),
    //     onClickCancel: onClickCloseLastAdmin,
    //     closeTheme: SessionButtonColor.Danger,
    //     onClickClose,
    //     showExitIcon: true,
    //     headerReverse: true,
    //     conversationId,
    //   })
    // );
  } else if (isPublic || (isClosedGroup && !isAdmin)) {
    window?.inboxStore?.dispatch(
      updateConfirmModal({
        title: isPublic ? window.i18n('leaveCommunity') : window.i18n('leaveGroup'),
        message: window.i18n('leaveGroupConfirmation', name ? [name] : ['']),
        onClickOk,
        okText: window.i18n('leave'),
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        conversationId,
      })
    );
  }
}

export function showInviteContactByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(updateInviteContactModal({ conversationId }));
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

  await conversation?.markAllAsRead();

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
  await conversation.setNickname(null, true);
}

export function showChangeNickNameByConvoId(conversationId: string) {
  window.inboxStore?.dispatch(changeNickNameModal({ conversationId }));
}

export async function deleteAllMessagesByConvoIdNoConfirmation(conversationId: string) {
  const conversation = getConversationController().get(conversationId);
  await Data.removeAllMessagesInConversation(conversationId);

  // destroy message keeps the active timestamp set so the
  // conversation still appears on the conversation list but is empty
  conversation.set({
    lastMessage: null,
    lastMessageInteractionType: null,
    lastMessageInteractionStatus: null,
  });

  await conversation.commit();
  window.inboxStore?.dispatch(conversationReset(conversationId));
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
      message: window.i18n('deleteMessagesConfirmation'),
      onClickOk,
      okTheme: SessionButtonColor.Danger,
      onClickClose,
    })
  );
}

export async function setDisappearingMessagesByConvoId(
  conversationId: string,
  expirationMode: DisappearingMessageConversationModeType,
  seconds?: number
) {
  const conversation = getConversationController().get(conversationId);

  const canSetDisappearing = !conversation.isOutgoingRequest() && !conversation.isIncomingRequest();

  if (!canSetDisappearing) {
    ToastUtils.pushMustBeApproved();
    return;
  }

  if (!expirationMode || expirationMode === 'off' || !seconds || seconds <= 0) {
    await conversation.updateExpireTimer({
      providedDisappearingMode: 'off',
      providedExpireTimer: 0,
      fromSync: false,
      fromCurrentDevice: true,
      fromConfigMessage: false,
    });
  } else {
    await conversation.updateExpireTimer({
      providedDisappearingMode: expirationMode,
      providedExpireTimer: seconds,
      fromSync: false,
      fromCurrentDevice: true,
      fromConfigMessage: false,
    });
  }
}

/**
 * This function can be used for reupload our avatar to the fileserver or upload a new avatar.
 *
 * If this is a reupload, the old profileKey is used, otherwise a new one is generated
 */
export async function uploadOurAvatar(newAvatarDecrypted?: ArrayBuffer) {
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo) {
    window.log.warn('ourConvo not found... This is not a valid case');
    return null;
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
      getConversationController().get(UserUtils.getOurPubKeyStrFromCache())?.get('profileKey') ||
      null;

    profileKey = ourConvoProfileKey ? fromHexToArray(ourConvoProfileKey) : null;
    if (!profileKey) {
      window.log.info('our profileKey not found. Not reuploading our avatar');
      return null;
    }
    const currentAttachmentPath = ourConvo.getAvatarPath();

    if (!currentAttachmentPath) {
      window.log.warn('No attachment currently set for our convo.. Nothing to do.');
      return null;
    }

    const decryptedAvatarUrl = await getDecryptedMediaUrl(currentAttachmentPath, IMAGE_JPEG, true);

    if (!decryptedAvatarUrl) {
      window.log.warn('Could not decrypt avatar stored locally..');
      return null;
    }
    const blob = await urlToBlob(decryptedAvatarUrl);

    decryptedAvatarData = await blob.arrayBuffer();
  }

  if (!decryptedAvatarData?.byteLength) {
    window.log.warn('Could not read content of avatar ...');
    return null;
  }

  const encryptedData = await encryptProfile(decryptedAvatarData, profileKey);

  const avatarPointer = await uploadFileToFsWithOnionV4(encryptedData);
  if (!avatarPointer) {
    window.log.warn('failed to upload avatar to fileserver');
    return null;
  }
  const { fileUrl, fileId } = avatarPointer;

  ourConvo.set('avatarPointer', fileUrl);

  // this encrypts and save the new avatar and returns a new attachment path
  const upgraded = await processNewAttachment({
    isRaw: true,
    data: decryptedAvatarData,
    contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
  });
  // Replace our temporary image with the attachment pointer from the server:
  ourConvo.set('avatarInProfile', undefined);
  const displayName = ourConvo.get('displayNameInProfile');

  // write the profileKey even if it did not change
  ourConvo.set({ profileKey: toHex(profileKey) });
  // Replace our temporary image with the attachment pointer from the server:
  // this commits already
  await ourConvo.setSessionProfile({
    avatarPath: upgraded.path,
    displayName,
    avatarImageId: fileId,
  });
  const newTimestampReupload = Date.now();
  await Storage.put(SettingsKey.lastAvatarUploadTimestamp, newTimestampReupload);

  if (newAvatarDecrypted) {
    await setLastProfileUpdateTimestamp(Date.now());
    await ConfigurationSync.queueNewJobIfNeeded();
    const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

    if (!userConfigLibsession) {
      await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
    }
  } else {
    window.log.info(
      `Reuploading avatar finished at ${newTimestampReupload}, newAttachmentPointer ${fileUrl}`
    );
  }
  return {
    avatarPointer: ourConvo.get('avatarPointer'),
    profileKey: ourConvo.get('profileKey'),
  };
}

/**
 * This function can be used for clearing our avatar.
 */
export async function clearOurAvatar(commit: boolean = true) {
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo) {
    window.log.warn('ourConvo not found... This is not a valid case');
    return;
  }

  // return early if no change are needed at all
  if (
    isNil(ourConvo.get('avatarPointer')) &&
    isNil(ourConvo.get('avatarInProfile')) &&
    isNil(ourConvo.get('profileKey'))
  ) {
    return;
  }

  ourConvo.set('avatarPointer', undefined);
  ourConvo.set('avatarInProfile', undefined);
  ourConvo.set('profileKey', undefined);

  await setLastProfileUpdateTimestamp(Date.now());

  if (commit) {
    await ourConvo.commit();
    await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
  }
}

export async function replyToMessage(messageId: string) {
  const quotedMessageModel = await Data.getMessageById(messageId);
  if (!quotedMessageModel) {
    window.log.warn('Failed to find message to reply to');
    return false;
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

  return true;
}

export async function resendMessage(messageId: string) {
  const foundMessageModel = await Data.getMessageById(messageId);

  if (!foundMessageModel) {
    window.log.warn('Failed to find message to resend');
    return false;
  }

  await foundMessageModel.retrySend();
  return true;
}

/**
 * Check if what is pasted is a URL and prompt confirmation for a setting change
 * @param e paste event
 */
export async function showLinkSharingConfirmationModalDialog(e: any) {
  const pastedText = e.clipboardData.getData('text');
  if (isURL(pastedText) && !window.getSettingValue(SettingsKey.settingsLinkPreview, false)) {
    const alreadyDisplayedPopup =
      (await Data.getItemById(SettingsKey.hasLinkPreviewPopupBeenDisplayed))?.value || false;
    if (!alreadyDisplayedPopup) {
      window.inboxStore?.dispatch(
        updateConfirmModal({
          shouldShowConfirm:
            !window.getSettingValue(SettingsKey.settingsLinkPreview) && !alreadyDisplayedPopup,
          title: window.i18n('linkPreviewsTitle'),
          message: window.i18n('linkPreviewsConfirmMessage'),
          okTheme: SessionButtonColor.Danger,
          onClickOk: async () => {
            await window.setSettingValue(SettingsKey.settingsLinkPreview, true);
          },
          onClickClose: async () => {
            await Storage.put(SettingsKey.hasLinkPreviewPopupBeenDisplayed, true);
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

/**
 * Updates the interaction state for a conversation. Remember to run clearConversationInteractionState() when the interaction is complete and we don't want to show it in the UI anymore.
 * @param conversationId id of the converation we want to interact with
 * @param type the type of conversation interaciton we are doing
 * @param status the status of that interaction
 */
export async function updateConversationInteractionState({
  conversationId,
  type,
  status,
}: {
  conversationId: string;
  type: ConversationInteractionType;
  status: ConversationInteractionStatus;
}) {
  const convo = getConversationController().get(conversationId);
  if (
    convo &&
    (type !== convo.get('lastMessageInteractionType') ||
      status !== convo.get('lastMessageInteractionStatus'))
  ) {
    convo.set('lastMessageInteractionType', type);
    convo.set('lastMessageInteractionStatus', status);

    await convo.commit();
    window.log.debug(
      `updateConversationInteractionState for ${conversationId} to ${type} ${status}`
    );
  }
}

/**
 * Clears the interaction state for a conversation. We would use this when we don't need to show anything in the UI once an action is complete.
 * @param conversationId id of the conversation whose interaction we want to clear
 */
export async function clearConversationInteractionState({
  conversationId,
}: {
  conversationId: string;
}) {
  const convo = getConversationController().get(conversationId);
  if (
    convo &&
    (convo.get('lastMessageInteractionType') || convo.get('lastMessageInteractionStatus'))
  ) {
    convo.set('lastMessageInteractionType', undefined);
    convo.set('lastMessageInteractionStatus', undefined);

    await convo.commit();
    window.log.debug(`clearConversationInteractionState for ${conversationId}`);
  }
}

async function saveConversationInteractionErrorAsMessage({
  conversationId,
  interactionType,
}: {
  conversationId: string;
  interactionType: ConversationInteractionType;
}) {
  const conversation = getConversationController().get(conversationId);
  if (!conversation) {
    return;
  }

  const interactionStatus = ConversationInteractionStatus.Error;

  await updateConversationInteractionState({
    conversationId,
    type: interactionType,
    status: interactionStatus,
  });

  // NOTE at this time we don't have visible control messages in communities
  if (conversation.isPublic()) {
    return;
  }

  // Add an error message to the database so we can view it in the message history
  await conversation?.addSingleIncomingMessage({
    source: GetNetworkTime.getNowWithNetworkOffset().toString(),
    sent_at: Date.now(),
    interactionNotification: {
      interactionType,
      interactionStatus,
    },
    unread: READ_MESSAGE_STATE.read,
    expireTimer: 0,
  });

  conversation.updateLastMessage();
}
