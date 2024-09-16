// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { render, unmountComponentAtNode } from 'react-dom';

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';
import type { PreJoinConversationType } from '../state/ducks/conversations';

import { DataWriter } from '../sql/Client';
import * as Bytes from '../Bytes';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { HTTPError } from '../textsecure/Errors';
import { SignalService as Proto } from '../protobuf';
import type { ContactAvatarType } from '../types/Avatar';
import { ToastType } from '../types/Toast';
import {
  applyNewAvatar,
  decryptGroupDescription,
  decryptGroupTitle,
  deriveGroupFields,
  getPreJoinGroupInfo,
  idForLogging,
  LINK_VERSION_ERROR,
  parseGroupLink,
} from '../groups';
import { createGroupV2JoinModal } from '../state/roots/createGroupV2JoinModal';
import { explodePromise } from '../util/explodePromise';
import { isAccessControlEnabled } from './util';
import { isGroupV1 } from '../util/whatTypeOfConversation';
import { longRunningTaskWrapper } from '../util/longRunningTaskWrapper';
import { sleep } from '../util/sleep';
import { dropNull } from '../util/dropNull';
import { getLocalAttachmentUrl } from '../util/getLocalAttachmentUrl';
import { type Loadable, LoadingState } from '../util/loadable';
import { missingCaseError } from '../util/missingCaseError';

export async function joinViaLink(value: string): Promise<void> {
  let inviteLinkPassword: string;
  let masterKey: string;
  try {
    ({ inviteLinkPassword, masterKey } = parseGroupLink(value));
  } catch (error: unknown) {
    const errorString = Errors.toLogFormat(error);
    log.error(`joinViaLink: Failed to parse group link ${errorString}`);

    if (error instanceof Error && error.name === LINK_VERSION_ERROR) {
      window.reduxActions.globalModals.showErrorModal({
        description: window.i18n('icu:GroupV2--join--unknown-link-version'),
        title: window.i18n('icu:GroupV2--join--unknown-link-version--title'),
      });
    } else {
      window.reduxActions.globalModals.showErrorModal({
        description: window.i18n('icu:GroupV2--join--invalid-link'),
        title: window.i18n('icu:GroupV2--join--invalid-link--title'),
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
  const ourAci = window.textsecure.storage.user.getCheckedAci();

  if (existingConversation && existingConversation.hasMember(ourAci)) {
    log.warn(
      `joinViaLink/${logId}: Already a member of group, opening conversation`
    );
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
    log.error(
      `joinViaLink/${logId}: Failed to fetch group info - ${errorString}`
    );

    if (
      error instanceof HTTPError &&
      error.responseHeaders['x-signal-forbidden-reason']
    ) {
      window.reduxActions.globalModals.showErrorModal({
        description: window.i18n('icu:GroupV2--join--link-forbidden'),
        title: window.i18n('icu:GroupV2--join--link-forbidden--title'),
      });
    } else if (error instanceof HTTPError && error.code === 403) {
      window.reduxActions.globalModals.showErrorModal({
        description: window.i18n('icu:GroupV2--join--link-revoked'),
        title: window.i18n('icu:GroupV2--join--link-revoked--title'),
      });
    } else {
      window.reduxActions.globalModals.showErrorModal({
        description: window.i18n('icu:GroupV2--join--general-join-failure'),
        title: window.i18n('icu:GroupV2--join--general-join-failure--title'),
      });
    }
    return;
  }

  if (!isAccessControlEnabled(dropNull(result.addFromInviteLink))) {
    log.error(
      `joinViaLink/${logId}: addFromInviteLink value of ${result.addFromInviteLink} is invalid`
    );
    window.reduxActions.globalModals.showErrorModal({
      description: window.i18n('icu:GroupV2--join--link-revoked'),
      title: window.i18n('icu:GroupV2--join--link-revoked--title'),
    });
    return;
  }

  let localAvatar: Loadable<ContactAvatarType | undefined> = result.avatar
    ? {
        loadingState: LoadingState.Loading,
      }
    : {
        loadingState: LoadingState.Loaded,
        value: undefined,
      };
  const memberCount = result.memberCount || 1;
  const approvalRequired =
    result.addFromInviteLink ===
    Proto.AccessControl.AccessRequired.ADMINISTRATOR;
  const title =
    decryptGroupTitle(dropNull(result.title), secretParams) ||
    window.i18n('icu:unknownGroup');
  const groupDescription = decryptGroupDescription(
    dropNull(result.descriptionBytes),
    secretParams
  );

  if (
    approvalRequired &&
    existingConversation &&
    existingConversation.isMemberAwaitingApproval(ourAci)
  ) {
    log.warn(
      `joinViaLink/${logId}: Already awaiting approval, opening conversation`
    );
    const timestamp = existingConversation.get('timestamp') || Date.now();
    // eslint-disable-next-line camelcase
    const active_at = existingConversation.get('active_at') || Date.now();
    // eslint-disable-next-line camelcase
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

  const getPreJoinConversation = (): PreJoinConversationType => {
    let avatar;
    if (localAvatar.loadingState === LoadingState.Loading) {
      avatar = {
        loading: true,
      };
    } else if (localAvatar.loadingState === LoadingState.Loaded) {
      avatar =
        localAvatar.value == null
          ? undefined
          : {
              url: getLocalAttachmentUrl(localAvatar.value),
            };
    } else if (localAvatar.loadingState === LoadingState.LoadFailed) {
      avatar = undefined;
    } else {
      throw missingCaseError(localAvatar);
    }

    return {
      approvalRequired,
      avatar,
      groupDescription,
      memberCount,
      title,
    };
  };

  // Explode a promise so we know when this whole join process is complete
  const { promise, resolve, reject } = explodePromise<void>();

  const closeDialog = async () => {
    try {
      if (groupV2InfoNode) {
        unmountComponentAtNode(groupV2InfoNode);
        groupV2InfoNode = undefined;
      }

      window.reduxActions.conversations.setPreJoinConversation(undefined);

      if (
        localAvatar?.loadingState === LoadingState.Loaded &&
        localAvatar.value?.path
      ) {
        await window.Signal.Migrations.deleteAttachmentData(
          localAvatar.value.path
        );
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  };

  const join = async () => {
    try {
      if (groupV2InfoNode) {
        unmountComponentAtNode(groupV2InfoNode);
        groupV2InfoNode = undefined;
      }

      window.reduxActions.conversations.setPreJoinConversation(undefined);

      await longRunningTaskWrapper({
        name: 'joinViaLink',
        idForLogging: idForLogging(id),
        // If an error happens here, we won't show a dialog. We'll rely on a top-level
        //   error dialog provided by the caller of this function.
        suppressErrorDialog: true,
        task: async () => {
          let targetConversation =
            existingConversation ||
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
              `joinViaLink/${logId}: User is part of group on second check, opening conversation`
            );
            window.reduxActions.conversations.showConversation({
              conversationId: targetConversation.id,
            });
            return;
          }

          try {
            const avatar =
              localAvatar?.loadingState === LoadingState.Loaded &&
              localAvatar.value?.path &&
              result.avatar
                ? {
                    url: result.avatar,
                    ...localAvatar.value,
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
                  revision: result.version,

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
              const timestamp =
                targetConversation.get('timestamp') || Date.now();
              // eslint-disable-next-line camelcase
              const active_at =
                targetConversation.get('active_at') || Date.now();
              targetConversation.set({
                // eslint-disable-next-line camelcase
                active_at,
                avatar,
                description: groupDescription,
                groupInviteLinkPassword: inviteLinkPassword,
                left: true,
                name: title,
                revision: dropNull(result.version),
                temporaryMemberCount: memberCount,
                timestamp,
              });
              await DataWriter.updateConversation(
                targetConversation.attributes
              );
            }

            if (isGroupV1(targetConversation.attributes)) {
              await targetConversation.joinGroupV2ViaLinkAndMigrate({
                approvalRequired,
                inviteLinkPassword,
                revision: result.version || 0,
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
              await DataWriter.removeConversation(tempConversation.id);
            }

            throw error;
          }
        },
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  };

  // Initial add to redux, with basic group information
  window.reduxActions.conversations.setPreJoinConversation(
    getPreJoinConversation()
  );

  log.info(`joinViaLink/${logId}: Showing modal`);

  let groupV2InfoNode: HTMLDivElement | undefined =
    document.createElement('div');

  render(
    createGroupV2JoinModal(window.reduxStore, { join, onClose: closeDialog }),
    groupV2InfoNode
  );

  // We declare a new function here so we can await but not block
  const fetchAvatar = async () => {
    if (!result.avatar) {
      return;
    }
    localAvatar = {
      loadingState: LoadingState.Loading,
    };

    let attributes: Pick<
      ConversationAttributesType,
      'avatar' | 'secretParams'
    > = {
      avatar: null,
      secretParams,
    };
    try {
      const patch = await applyNewAvatar(result.avatar, attributes, logId);
      attributes = { ...attributes, ...patch };

      if (attributes.avatar && attributes.avatar.path) {
        localAvatar = {
          loadingState: LoadingState.Loaded,
          value: { ...attributes.avatar },
        };

        // Dialog has been dismissed; we'll delete the unneeeded avatar
        if (!groupV2InfoNode) {
          await window.Signal.Migrations.deleteAttachmentData(
            attributes.avatar.path
          );
          return;
        }
      } else {
        localAvatar = { loadingState: LoadingState.Loaded, value: undefined };
      }
    } catch (error) {
      localAvatar = { loadingState: LoadingState.LoadFailed, error };
    }

    // Update join dialog with newly-downloaded avatar
    window.reduxActions.conversations.setPreJoinConversation(
      getPreJoinConversation()
    );
  };

  void fetchAvatar();

  await promise;
}
