// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ConversationModel } from '../models/conversations.preload.ts';
import type { PreJoinConversationType } from '../state/ducks/conversations.preload.ts';

import { DataWriter } from '../sql/Client.preload.ts';
import * as Bytes from '../Bytes.std.ts';
import * as Errors from '../types/errors.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { HTTPError } from '../types/HTTPError.std.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import type { ContactAvatarType } from '../types/Avatar.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import {
  applyNewAvatar,
  decryptGroupDescription,
  decryptGroupTitle,
  deriveGroupFields,
  getPreJoinGroupInfo,
  idForLogging,
  LINK_VERSION_ERROR,
  parseGroupLink,
} from '../groups.preload.ts';
import { maybeDeleteAttachmentFile } from '../util/migrations.preload.ts';
import { isAccessControlEnabled } from './util.std.ts';
import { isGroupV1 } from '../util/whatTypeOfConversation.dom.ts';
import { longRunningTaskWrapper } from '../util/longRunningTaskWrapper.dom.tsx';
import { sleep } from '../util/sleep.std.ts';
import { dropNull } from '../util/dropNull.std.ts';
import { getLocalAttachmentUrl } from '../util/getLocalAttachmentUrl.std.ts';
import { removeConversation } from '../util/Conversation.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { getPreJoinConversation } from '../state/selectors/conversations.dom.ts';

const log = createLogger('joinViaLink');
const { i18n } = window.SignalContext;

function getCurrentPreJoinConversation(): PreJoinConversationType | null {
  return getPreJoinConversation(window.reduxStore.getState()) ?? null;
}

/**
 * Validates the group link and fetches the group's info, then shows the join
 * dialog. The dialog calls `completeJoinViaLink()` or `cancelJoinViaLink()`.
 */
export async function startJoinViaLink(value: string): Promise<void> {
  // Only one join dialog can be open at a time
  if (getCurrentPreJoinConversation() != null) {
    log.warn('Another join dialog is already open, ignoring');
    return;
  }

  let inviteLinkPassword: string;
  let masterKey: string;
  try {
    ({ inviteLinkPassword, masterKey } = parseGroupLink(value));
  } catch (error: unknown) {
    const errorString = Errors.toLogFormat(error);
    log.error(`Failed to parse group link ${errorString}`);

    if (error instanceof Error && error.name === LINK_VERSION_ERROR) {
      window.reduxActions.globalModals.showErrorModal({
        description: i18n('icu:GroupV2--join--unknown-link-version'),
        title: i18n('icu:GroupV2--join--unknown-link-version--title'),
      });
    } else {
      window.reduxActions.globalModals.showErrorModal({
        description: i18n('icu:GroupV2--join--invalid-link'),
        title: i18n('icu:GroupV2--join--invalid-link--title'),
      });
    }
    return;
  }

  const data = deriveGroupFields(Bytes.fromBase64(masterKey));
  const id = Bytes.toBase64(data.id);
  const logId = `groupv2(${id})`;
  const secretParams = Bytes.toBase64(data.secretParams);
  const publicParams = Bytes.toBase64(data.publicParams);

  const existingConversation =
    window.ConversationController.get(id) ||
    window.ConversationController.getByDerivedGroupV2Id(id);
  const ourAci = itemStorage.user.getCheckedAci();

  if (existingConversation && existingConversation.hasMember(ourAci)) {
    log.warn(`${logId}: Already a member of group, opening conversation`);
    window.reduxActions.conversations.showConversation({
      conversationId: existingConversation.id,
    });
    window.reduxActions.toast.showToast({
      toastType: ToastType.AlreadyGroupMember,
    });
    return;
  }

  let result: Proto.GroupJoinInfo;

  try {
    result = await longRunningTaskWrapper({
      name: 'getPreJoinGroupInfo',
      idForLogging: idForLogging(id),
      // If an error happens here, we won't show a dialog. We'll rely on the catch a few
      //   lines below.
      suppressErrorDialog: true,
      task: () => getPreJoinGroupInfo(inviteLinkPassword, masterKey),
    });
  } catch (error: unknown) {
    const errorString = Errors.toLogFormat(error);
    log.error(`${logId}: Failed to fetch group info - ${errorString}`);

    if (
      error instanceof HTTPError &&
      error.responseHeaders['x-signal-forbidden-reason']
    ) {
      window.reduxActions.globalModals.showErrorModal({
        description: i18n('icu:GroupV2--join--link-forbidden'),
        title: i18n('icu:GroupV2--join--link-forbidden--title'),
      });
    } else if (error instanceof HTTPError && error.code === 403) {
      window.reduxActions.globalModals.showErrorModal({
        description: i18n('icu:GroupV2--join--link-revoked'),
        title: i18n('icu:GroupV2--join--link-revoked--title'),
      });
    } else if (error instanceof HTTPError && error.code === 423) {
      window.reduxActions.globalModals.showErrorModal({
        title: i18n('icu:ErrorModal--title'),
        description: i18n('icu:GroupV2--join--group-terminated'),
      });
    } else {
      window.reduxActions.globalModals.showErrorModal({
        description: i18n('icu:GroupV2--join--general-join-failure'),
        title: i18n('icu:GroupV2--join--general-join-failure--title'),
      });
    }
    return;
  }

  if (!isAccessControlEnabled(result.addFromInviteLink)) {
    log.error(
      `${logId}: addFromInviteLink value of ${result.addFromInviteLink} is invalid`
    );
    window.reduxActions.globalModals.showErrorModal({
      description: i18n('icu:GroupV2--join--link-revoked'),
      title: i18n('icu:GroupV2--join--link-revoked--title'),
    });
    return;
  }

  const remoteAvatarUrl =
    result.avatar != null && result.avatar !== '' ? result.avatar : null;
  const memberCount = result.memberCount || 1;
  const approvalRequired =
    result.addFromInviteLink ===
    Proto.AccessControl.AccessRequired.ADMINISTRATOR;
  const title =
    decryptGroupTitle(dropNull(result.title), secretParams) ||
    i18n('icu:unknownGroup');
  const groupDescription = decryptGroupDescription(
    dropNull(result.description),
    secretParams
  );

  if (
    approvalRequired &&
    existingConversation &&
    existingConversation.isMemberAwaitingApproval(ourAci)
  ) {
    log.warn(`${logId}: Already awaiting approval, opening conversation`);
    const timestamp = existingConversation.get('timestamp') || Date.now();
    const active_at = existingConversation.get('active_at') || Date.now();
    existingConversation.set({ active_at, timestamp });
    await DataWriter.updateConversation(existingConversation.attributes);

    // We're waiting for the left pane to re-sort before we navigate to that conversation
    await sleep(200);

    window.reduxActions.conversations.showConversation({
      conversationId: existingConversation.id,
    });

    window.reduxActions.toast.showToast({
      toastType: ToastType.AlreadyRequestedToJoin,
    });
    return;
  }

  // Check again, another link may have been opened while we were fetching
  if (getCurrentPreJoinConversation() != null) {
    log.warn(`${logId}: Another join dialog is already open, ignoring`);
    return;
  }

  window.reduxActions.conversations.setPreJoinConversation({
    approvalRequired,
    avatar: remoteAvatarUrl != null ? { loading: true } : undefined,
    groupDescription,
    memberCount,
    title,
    groupId: id,
    masterKey,
    secretParams,
    publicParams,
    inviteLinkPassword,
    revision: result.version ?? null,
    remoteAvatarUrl,
    localAvatar: null,
  });

  log.info(`${logId}: Showing modal`);
  window.reduxActions.globalModals.toggleGroupV2JoinDialog(true);

  if (remoteAvatarUrl != null) {
    // Don't block on the avatar download
    void fetchAvatar({ groupId: id, remoteAvatarUrl, secretParams, logId });
  }
}

async function fetchAvatar({
  groupId,
  remoteAvatarUrl,
  secretParams,
  logId,
}: Readonly<{
  groupId: string;
  remoteAvatarUrl: string;
  secretParams: string;
  logId: string;
}>): Promise<void> {
  let attributes: Pick<ConversationAttributesType, 'avatar' | 'secretParams'> =
    {
      avatar: null,
      secretParams,
    };
  let localAvatar: ContactAvatarType | null = null;
  try {
    const patch = await applyNewAvatar({
      newAvatarUrl: remoteAvatarUrl,
      attributes,
      logId,
      forceDownload: true,
    });
    attributes = { ...attributes, ...patch };

    if (attributes.avatar && attributes.avatar.path) {
      localAvatar = { ...attributes.avatar };
    }
  } catch {
    localAvatar = null;
  }

  const preJoinConversation = getCurrentPreJoinConversation();

  // Dialog has been dismissed; we'll delete the unneeded avatar
  if (preJoinConversation?.groupId !== groupId) {
    if (localAvatar?.path != null) {
      await maybeDeleteAttachmentFile(localAvatar.path);
    }
    return;
  }

  // Update join dialog with newly-downloaded avatar
  window.reduxActions.conversations.setPreJoinConversation({
    ...preJoinConversation,
    avatar:
      localAvatar != null
        ? { url: getLocalAttachmentUrl(localAvatar) }
        : undefined,
    localAvatar,
  });
}

/**
 * Called when the user confirms the join dialog.
 */
export async function completeJoinViaLink(): Promise<void> {
  const preJoinConversation = getCurrentPreJoinConversation();
  if (preJoinConversation == null) {
    log.warn('completeJoinViaLink: No pre-join conversation, ignoring');
    return;
  }

  const {
    groupId: id,
    masterKey,
    secretParams,
    publicParams,
    inviteLinkPassword,
    approvalRequired,
    revision,
    remoteAvatarUrl,
    localAvatar,
    groupDescription,
    title,
    memberCount,
  } = preJoinConversation;
  const logId = `groupv2(${id})`;
  const ourAci = itemStorage.user.getCheckedAci();

  window.reduxActions.globalModals.toggleGroupV2JoinDialog(false);
  window.reduxActions.conversations.setPreJoinConversation(undefined);

  try {
    await longRunningTaskWrapper({
      name: 'joinViaLink',
      idForLogging: idForLogging(id),
      // If an error happens here, we won't show the default dialog. We'll show our own
      //   below.
      suppressErrorDialog: true,
      task: async () => {
        let targetConversation =
          window.ConversationController.get(id) ||
          window.ConversationController.getByDerivedGroupV2Id(id);
        let tempConversation: ConversationModel | undefined;

        // Check again to ensure that we haven't already joined or requested to join
        //   via some other process. If so, just open that conversation.
        if (
          targetConversation &&
          (targetConversation.hasMember(ourAci) ||
            (approvalRequired &&
              targetConversation.isMemberAwaitingApproval(ourAci)))
        ) {
          log.warn(
            `${logId}: User is part of group on second check, opening conversation`
          );
          window.reduxActions.conversations.showConversation({
            conversationId: targetConversation.id,
          });
          return;
        }

        try {
          const avatar =
            localAvatar != null && remoteAvatarUrl != null
              ? {
                  url: remoteAvatarUrl,
                  ...localAvatar,
                }
              : undefined;
          if (!targetConversation) {
            // Note: we save this temp conversation in the database, so we'll need to
            //   clean it up if something goes wrong
            tempConversation = window.ConversationController.getOrCreate(
              id,
              'group',
              {
                // This will cause this conversation to be deleted at next startup
                isTemporary: true,

                active_at: Date.now(),
                timestamp: Date.now(),

                groupVersion: 2,
                masterKey,
                secretParams,
                publicParams,

                left: true,
                revision: revision ?? undefined,

                avatar,

                description: groupDescription,
                groupInviteLinkPassword: inviteLinkPassword,
                name: title,
                temporaryMemberCount: memberCount,
              }
            );
            targetConversation = tempConversation;
          } else {
            // Ensure the group maintains the title and avatar you saw when attempting
            //   to join it.
            const timestamp = targetConversation.get('timestamp') || Date.now();
            const active_at = targetConversation.get('active_at') || Date.now();
            targetConversation.set({
              active_at,
              avatar,
              description: groupDescription,
              groupInviteLinkPassword: inviteLinkPassword,
              left: true,
              name: title,
              revision: revision ?? undefined,
              temporaryMemberCount: memberCount,
              timestamp,
            });
            await DataWriter.updateConversation(targetConversation.attributes);
          }

          if (isGroupV1(targetConversation.attributes)) {
            await targetConversation.joinGroupV2ViaLinkAndMigrate({
              approvalRequired,
              inviteLinkPassword,
              revision: revision ?? 0,
            });
          } else {
            await targetConversation.joinGroupV2ViaLink({
              inviteLinkPassword,
              approvalRequired,
            });
          }

          if (tempConversation) {
            tempConversation.set({
              // We want to keep this conversation around, since the join succeeded
              isTemporary: undefined,
              profileSharing: true,
            });
            await DataWriter.updateConversation(tempConversation.attributes);
          }

          window.reduxActions.conversations.showConversation({
            conversationId: targetConversation.id,
          });
        } catch (error) {
          // Delete newly-created conversation if we encountered any errors
          if (tempConversation) {
            window.ConversationController.dangerouslyRemoveById(
              tempConversation.id
            );
            await removeConversation(tempConversation.id);
          }

          throw error;
        }
      },
    });
  } catch (error) {
    log.error(`${logId}: Failed to join group`, Errors.toLogFormat(error));
    window.reduxActions.globalModals.showErrorModal({
      title: i18n('icu:GroupV2--join--general-join-failure--title'),
      description: i18n('icu:GroupV2--join--general-join-failure'),
    });
  }
}

/**
 * Called when the user dismisses the join dialog.
 */
export async function cancelJoinViaLink(): Promise<void> {
  const preJoinConversation = getCurrentPreJoinConversation();

  window.reduxActions.globalModals.toggleGroupV2JoinDialog(false);
  window.reduxActions.conversations.setPreJoinConversation(undefined);

  const localAvatarPath = preJoinConversation?.localAvatar?.path;
  if (localAvatarPath != null) {
    try {
      await maybeDeleteAttachmentFile(localAvatarPath);
    } catch (error) {
      log.error(
        'cancelJoinViaLink: Failed to delete avatar',
        Errors.toLogFormat(error)
      );
    }
  }
}
