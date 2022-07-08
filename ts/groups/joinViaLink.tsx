// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
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
import * as Errors from '../types/errors';
import { UUIDKind } from '../types/UUID';
import * as Bytes from '../Bytes';
import { longRunningTaskWrapper } from '../util/longRunningTaskWrapper';
import { isGroupV1 } from '../util/whatTypeOfConversation';
import { explodePromise } from '../util/explodePromise';

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';
import type { PreJoinConversationType } from '../state/ducks/conversations';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { showToast } from '../util/showToast';
import { ReactWrapperView } from '../views/ReactWrapperView';
import { ErrorModal } from '../components/ErrorModal';
import { ToastAlreadyGroupMember } from '../components/ToastAlreadyGroupMember';
import { ToastAlreadyRequestedToJoin } from '../components/ToastAlreadyRequestedToJoin';
import { HTTPError } from '../textsecure/Errors';
import { isAccessControlEnabled } from './util';
import { sleep } from '../util/sleep';

export async function joinViaLink(hash: string): Promise<void> {
  let inviteLinkPassword: string;
  let masterKey: string;
  try {
    ({ inviteLinkPassword, masterKey } = parseGroupLink(hash));
  } catch (error: unknown) {
    const errorString = Errors.toLogFormat(error);
    log.error(`joinViaLink: Failed to parse group link ${errorString}`);

    if (error instanceof Error && error.name === LINK_VERSION_ERROR) {
      showErrorDialog(
        window.i18n('GroupV2--join--unknown-link-version'),
        window.i18n('GroupV2--join--unknown-link-version--title')
      );
    } else {
      showErrorDialog(
        window.i18n('GroupV2--join--invalid-link'),
        window.i18n('GroupV2--join--invalid-link--title')
      );
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
  const ourUuid = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);

  if (existingConversation && existingConversation.hasMember(ourUuid)) {
    log.warn(
      `joinViaLink/${logId}: Already a member of group, opening conversation`
    );
    window.reduxActions.conversations.showConversation({
      conversationId: existingConversation.id,
    });
    showToast(ToastAlreadyGroupMember);
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
      showErrorDialog(
        window.i18n('GroupV2--join--link-forbidden'),
        window.i18n('GroupV2--join--link-forbidden--title')
      );
    } else if (error instanceof HTTPError && error.code === 403) {
      showErrorDialog(
        window.i18n('GroupV2--join--link-revoked'),
        window.i18n('GroupV2--join--link-revoked--title')
      );
    } else {
      showErrorDialog(
        window.i18n('GroupV2--join--general-join-failure'),
        window.i18n('GroupV2--join--general-join-failure--title')
      );
    }
    return;
  }

  if (!isAccessControlEnabled(result.addFromInviteLink)) {
    log.error(
      `joinViaLink/${logId}: addFromInviteLink value of ${result.addFromInviteLink} is invalid`
    );
    showErrorDialog(
      window.i18n('GroupV2--join--link-revoked'),
      window.i18n('GroupV2--join--link-revoked--title')
    );
    return;
  }

  let localAvatar:
    | {
        loading?: boolean;
        path?: string;
      }
    | undefined = result.avatar ? { loading: true } : undefined;
  const memberCount = result.memberCount || 1;
  const approvalRequired =
    result.addFromInviteLink ===
    Proto.AccessControl.AccessRequired.ADMINISTRATOR;
  const title =
    decryptGroupTitle(result.title, secretParams) ||
    window.i18n('unknownGroup');
  const groupDescription = decryptGroupDescription(
    result.descriptionBytes,
    secretParams
  );

  if (
    approvalRequired &&
    existingConversation &&
    existingConversation.isMemberAwaitingApproval(ourUuid)
  ) {
    log.warn(
      `joinViaLink/${logId}: Already awaiting approval, opening conversation`
    );
    const timestamp = existingConversation.get('timestamp') || Date.now();
    // eslint-disable-next-line camelcase
    const active_at = existingConversation.get('active_at') || Date.now();
    existingConversation.set({ active_at, timestamp });
    window.Signal.Data.updateConversation(existingConversation.attributes);

    // We're waiting for the left pane to re-sort before we navigate to that conversation
    await sleep(200);

    window.reduxActions.conversations.showConversation({
      conversationId: existingConversation.id,
    });

    showToast(ToastAlreadyRequestedToJoin);
    return;
  }

  const getPreJoinConversation = (): PreJoinConversationType => {
    let avatar;
    if (!localAvatar) {
      avatar = undefined;
    } else if (localAvatar && localAvatar.loading) {
      avatar = {
        loading: true,
      };
    } else if (localAvatar && localAvatar.path) {
      avatar = {
        url: window.Signal.Migrations.getAbsoluteAttachmentPath(
          localAvatar.path
        ),
      };
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
      if (groupV2InfoDialog) {
        groupV2InfoDialog.remove();
        groupV2InfoDialog = undefined;
      }

      window.reduxActions.conversations.setPreJoinConversation(undefined);

      if (localAvatar && localAvatar.path) {
        await window.Signal.Migrations.deleteAttachmentData(localAvatar.path);
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  };

  const join = async () => {
    try {
      if (groupV2InfoDialog) {
        groupV2InfoDialog.remove();
        groupV2InfoDialog = undefined;
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
            (targetConversation.hasMember(ourUuid) ||
              (approvalRequired &&
                targetConversation.isMemberAwaitingApproval(ourUuid)))
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

                  avatar:
                    localAvatar && localAvatar.path && result.avatar
                      ? {
                          url: result.avatar,
                          path: localAvatar.path,
                        }
                      : undefined,
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
                active_at,
                avatar:
                  localAvatar && localAvatar.path && result.avatar
                    ? {
                        url: result.avatar,
                        path: localAvatar.path,
                      }
                    : undefined,
                description: groupDescription,
                groupInviteLinkPassword: inviteLinkPassword,
                name: title,
                revision: result.version,
                temporaryMemberCount: memberCount,
                timestamp,
              });
              window.Signal.Data.updateConversation(
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
              });
              window.Signal.Data.updateConversation(
                tempConversation.attributes
              );
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
              await window.Signal.Data.removeConversation(tempConversation.id);
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

  let groupV2InfoDialog: Backbone.View | undefined = new ReactWrapperView({
    className: 'group-v2-join-dialog-wrapper',
    JSX: window.Signal.State.Roots.createGroupV2JoinModal(window.reduxStore, {
      join,
      onClose: closeDialog,
    }),
  });

  // We declare a new function here so we can await but not block
  const fetchAvatar = async () => {
    if (result.avatar) {
      localAvatar = {
        loading: true,
      };

      const attributes: Pick<
        ConversationAttributesType,
        'avatar' | 'secretParams'
      > = {
        avatar: null,
        secretParams,
      };
      await applyNewAvatar(result.avatar, attributes, logId);

      if (attributes.avatar && attributes.avatar.path) {
        localAvatar = {
          path: attributes.avatar.path,
        };

        // Dialog has been dismissed; we'll delete the unneeeded avatar
        if (!groupV2InfoDialog) {
          await window.Signal.Migrations.deleteAttachmentData(
            attributes.avatar.path
          );
          return;
        }
      } else {
        localAvatar = undefined;
      }

      // Update join dialog with newly-downloaded avatar
      window.reduxActions.conversations.setPreJoinConversation(
        getPreJoinConversation()
      );
    }
  };

  fetchAvatar();

  await promise;
}

function showErrorDialog(description: string, title: string) {
  const errorView = new ReactWrapperView({
    className: 'error-modal-wrapper',
    JSX: (
      <ErrorModal
        i18n={window.i18n}
        title={title}
        description={description}
        onClose={() => {
          errorView.remove();
        }}
      />
    ),
  });
}
