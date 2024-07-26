import AbortController from 'abort-controller';
import { getConversationController } from '../../../conversations';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import {
  batchFirstSubIsSuccess,
  batchGlobalIsSuccess,
  OpenGroupBatchRow,
  sogsBatchSend,
} from './sogsV3BatchPoll';
import { OpenGroupRequestCommonType } from '../../../../data/types';

type OpenGroupClearInboxResponse = {
  deleted: number;
};

export const clearInbox = async (roomInfos: OpenGroupRequestCommonType): Promise<boolean> => {
  let success = false;

  const conversationId = getOpenGroupV2ConversationId(roomInfos.serverUrl, roomInfos.roomId);
  const conversation = getConversationController().get(conversationId);

  if (!conversation) {
    throw new Error(`clearInbox Matching conversation not found in db ${conversationId}`);
  }
  const options: Array<OpenGroupBatchRow> = [
    {
      type: 'inbox',
      inbox: {
        type: 'delete',
      },
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
    throw new Error(`Could not clearInbox, res is invalid for ${conversationId}`);
  }

  const rawMessage = (result.body && (result.body[0].body as OpenGroupClearInboxResponse)) || null;
  if (!rawMessage) {
    throw new Error(`clearInbox parsing failed for ${conversationId}`);
  }

  try {
    if (batchGlobalIsSuccess(result) && batchFirstSubIsSuccess(result)) {
      success = true;
      window.log.info(`clearInbox ${rawMessage.deleted} messages deleted for ${conversationId} `);
    }
  } catch (e) {
    window?.log?.error(`clearInbox Can't decode JSON body for ${conversationId}`);
  }

  if (!success) {
    window.log.info(`clearInbox message deletion failed for ${conversationId}`);
  }
  return success;
};
