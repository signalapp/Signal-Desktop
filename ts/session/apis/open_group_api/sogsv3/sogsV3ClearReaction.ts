import AbortController from 'abort-controller';
import { OpenGroupReactionResponse } from '../../../../types/Reaction';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import {
  batchFirstSubIsSuccess,
  batchGlobalIsSuccess,
  OpenGroupBatchRow,
  sogsBatchSend,
} from './sogsV3BatchPoll';
import {
  addToMutationCache,
  ChangeType,
  SogsV3Mutation,
  updateMutationCache,
} from './sogsV3MutationCache';
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

  const cacheEntry: SogsV3Mutation = {
    server: roomInfos.serverUrl,
    room: roomInfos.roomId,
    changeType: ChangeType.REACTIONS,
    seqno: null,
    metadata: {
      messageId: serverId,
      emoji: reaction,
      action: 'CLEAR',
    },
  };

  addToMutationCache(cacheEntry);

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

  if (!result) {
    throw new Error('Could not deleteReaction, res is invalid');
  }

  const rawMessage = (result.body && (result.body[0].body as OpenGroupReactionResponse)) || null;
  if (!rawMessage) {
    throw new Error('deleteReaction parsing failed');
  }

  try {
    if (batchGlobalIsSuccess(result) && batchFirstSubIsSuccess(result)) {
      updateMutationCache(cacheEntry, rawMessage.seqno);
      return true;
    } else {
      return false;
    }
  } catch (e) {
    window?.log?.error("clearSogsReactionByServerId Can't decode JSON body");
  }
  return false;
};
