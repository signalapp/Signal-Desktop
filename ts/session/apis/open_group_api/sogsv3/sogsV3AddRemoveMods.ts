/** MODERATORS ADD/REMOVE */

import AbortController from 'abort-controller';
import { PubKey } from '../../../types';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import { batchFirstSubIsSuccess, sogsBatchSend } from './sogsV3BatchPoll';

/**
 * Add those pubkeys as admins.
 * TODO: We do not support adding as moderators/visible/global for now in session desktop
 */
export const sogsV3AddAdmin = async (
  usersToAddAsMods: Array<PubKey>,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'addRemoveModerators',
        addRemoveModerators: {
          sessionIds: usersToAddAsMods.map(m => m.key),
          roomId: roomInfos.roomId,
          type: 'add_mods',
        },
      },
    ],
    'batch'
  );
  const isSuccess = batchFirstSubIsSuccess(batchSendResponse);
  if (!isSuccess) {
    window.log.warn('add as mod failed with body', batchSendResponse?.body);
  }
  return isSuccess;
};

/**
 * Remove those pubkeys from the list of admins.
 * TODO: We do not support removing as moderators/visible/global for now in session desktop
 */
export const sogsV3RemoveAdmins = async (
  usersToRemoveFromMods: Array<PubKey>,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'addRemoveModerators',
        addRemoveModerators: {
          sessionIds: usersToRemoveFromMods.map(m => m.key),
          roomId: roomInfos.roomId,
          type: 'remove_mods',
        },
      },
    ],
    'batch'
  );
  const isSuccess = batchSendResponse?.body?.every(m => m?.code === 200) || false;
  if (!isSuccess) {
    window.log.warn('remove mods failed with body', batchSendResponse?.body);
  }
  return isSuccess;
};
