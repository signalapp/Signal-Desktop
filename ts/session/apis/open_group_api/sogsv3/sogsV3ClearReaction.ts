import AbortController from 'abort-controller';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import {
  batchFirstSubIsSuccess,
  batchGlobalIsSuccess,
  OpenGroupBatchRow,
  sogsBatchSend,
} from './sogsV3BatchPoll';
import { hasReactionSupport } from './sogsV3SendReaction';

/**
 * Clears a reaction on open group server using onion v4 logic and batch send
 * User must have moderator permissions
 * Clearing implies removing all reactors for a specific emoji
 */
export const clearSogsReactionByServerId = async (
  reaction: string,
  serverId: number,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const canReact = await hasReactionSupport(serverId);
  if (!canReact) {
    return false;
  }

  const options: Array<OpenGroupBatchRow> = [
    {
      type: 'deleteReaction',
      deleteReaction: { reaction, messageId: serverId, roomId: roomInfos.roomId },
    },
  ];
  const result = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    options,
    'batch'
  );

  try {
    return batchGlobalIsSuccess(result) && batchFirstSubIsSuccess(result);
  } catch (e) {
    window?.log?.error("clearSogsReactionByServerId Can't decode JSON body");
  }
  return false;
};
