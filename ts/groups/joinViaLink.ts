// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  applyNewAvatar,
  decryptGroupTitle,
  deriveGroupFields,
  getPreJoinGroupInfo,
  idForLogging,
  LINK_VERSION_ERROR,
  parseGroupLink,
} from '../groups';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../Crypto';
import { longRunningTaskWrapper } from '../util/longRunningTaskWrapper';

import type { GroupJoinInfoClass } from '../textsecure.d';
import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';
import type { PreJoinConversationType } from '../state/ducks/conversations';

export async function joinViaLink(hash: string): Promise<void> {
  let inviteLinkPassword: string;
  let masterKey: string;
  try {
    ({ inviteLinkPassword, masterKey } = parseGroupLink(hash));
  } catch (error) {
    const errorString = error && error.stack ? error.stack : error;
    window.log.error(`joinViaLink: Failed to parse group link ${errorString}`);
    if (error && error.name === LINK_VERSION_ERROR) {
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

  const data = deriveGroupFields(base64ToArrayBuffer(masterKey));
  const id = arrayBufferToBase64(data.id);
  const logId = `groupv2(${id})`;
  const secretParams = arrayBufferToBase64(data.secretParams);
  const publicParams = arrayBufferToBase64(data.publicParams);

  const existingConversation =
    window.ConversationController.get(id) ||
    window.ConversationController.getByDerivedGroupV2Id(id);
  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();

  if (
    existingConversation &&
    existingConversation.hasMember(ourConversationId)
  ) {
    window.log.warn(
      `joinViaLink/${logId}: Already a member of group, opening conversation`
    );
    window.reduxActions.conversations.openConversationInternal({
      conversationId: existingConversation.id,
    });
    window.Whisper.ToastView.show(
      window.Whisper.AlreadyGroupMemberToast,
      document.getElementsByClassName('conversation-stack')[0]
    );
    return;
  }

  let result: GroupJoinInfoClass;

  try {
    result = await longRunningTaskWrapper({
      name: 'getPreJoinGroupInfo',
      idForLogging: idForLogging(id),
      // If an error happens here, we won't show a dialog. We'll rely on the catch a few
      //   lines below.
      suppressErrorDialog: true,
      task: () => getPreJoinGroupInfo(inviteLinkPassword, masterKey),
    });
  } catch (error) {
    const errorString = error && error.stack ? error.stack : error;
    window.log.error(
      `joinViaLink/${logId}: Failed to fetch group info - ${errorString}`
    );

    showErrorDialog(
      error.code && error.code === 403
        ? window.i18n('GroupV2--join--link-revoked')
        : window.i18n('GroupV2--join--general-join-failure'),
      error.code && error.code === 403
        ? window.i18n('GroupV2--join--link-revoked--title')
        : window.i18n('GroupV2--join--general-join-failure--title')
    );
    return;
  }

  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
  if (
    result.addFromInviteLink !== ACCESS_ENUM.ADMINISTRATOR &&
    result.addFromInviteLink !== ACCESS_ENUM.ANY
  ) {
    window.log.error(
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
    result.addFromInviteLink === ACCESS_ENUM.ADMINISTRATOR;
  const title =
    decryptGroupTitle(result.title, secretParams) ||
    window.i18n('unknownGroup');

  if (
    approvalRequired &&
    existingConversation &&
    existingConversation.isMemberAwaitingApproval(ourConversationId)
  ) {
    window.log.warn(
      `joinViaLink/${logId}: Already awaiting approval, opening conversation`
    );
    window.reduxActions.conversations.openConversationInternal({
      conversationId: existingConversation.id,
    });

    window.Whisper.ToastView.show(
      window.Whisper.AlreadyRequestedToJoinToast,
      document.getElementsByClassName('conversation-stack')[0]
    );
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
      memberCount,
      title,
    };
  };

  // Explode a promise so we know when this whole join process is complete
  const { promise, resolve, reject } = explodePromise();

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
            (targetConversation.hasMember(ourConversationId) ||
              (approvalRequired &&
                targetConversation.isMemberAwaitingApproval(ourConversationId)))
          ) {
            window.log.warn(
              `joinViaLink/${logId}: User is part of group on second check, opening conversation`
            );
            window.reduxActions.conversations.openConversationInternal({
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
                  groupInviteLinkPassword: inviteLinkPassword,
                  name: title,
                  temporaryMemberCount: memberCount,
                }
              );
              targetConversation = tempConversation;
            } else {
              // Ensure the group maintains the title and avatar you saw when attempting
              //   to join it.
              targetConversation.set({
                avatar:
                  localAvatar && localAvatar.path && result.avatar
                    ? {
                        url: result.avatar,
                        path: localAvatar.path,
                      }
                    : undefined,
                groupInviteLinkPassword: inviteLinkPassword,
                name: title,
                temporaryMemberCount: memberCount,
              });
              window.Signal.Data.updateConversation(
                targetConversation.attributes
              );
            }

            if (targetConversation.isGroupV1()) {
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

            window.reduxActions.conversations.openConversationInternal({
              conversationId: targetConversation.id,
            });
          } catch (error) {
            // Delete newly-created conversation if we encountered any errors
            if (tempConversation) {
              window.ConversationController.dangerouslyRemoveById(
                tempConversation.id
              );
              await window.Signal.Data.removeConversation(tempConversation.id, {
                Conversation: window.Whisper.Conversation,
              });
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

  window.log.info(`joinViaLink/${logId}: Showing modal`);

  let groupV2InfoDialog = new window.Whisper.ReactWrapperView({
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
  const errorView = new window.Whisper.ReactWrapperView({
    className: 'error-modal-wrapper',
    Component: window.Signal.Components.ErrorModal,
    props: {
      title,
      description,
      onClose: () => {
        errorView.remove();
      },
    },
  });
}

function explodePromise(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolve: () => void;
  let reject: (error: Error) => void;

  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    // Typescript thinks that resolve and reject can be undefined here.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolve: resolve!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    reject: reject!,
  };
}
