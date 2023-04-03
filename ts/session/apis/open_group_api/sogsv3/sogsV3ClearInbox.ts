import AbortController from 'abort-controller';
import { Data } from '../../../../data/data';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import {
  batchFirstSubIsSuccess,
  batchGlobalIsSuccess,
  OpenGroupBatchRow,
  sogsBatchSend,
} from './sogsV3BatchPoll';

type OpenGroupClearInboxResponse = {
  deleted: number;
};

export const clearInbox = async (roomInfos: OpenGroupRequestCommonType): Promise<boolean> => {
  let success = false;

  const converationId = getOpenGroupV2ConversationId(roomInfos.serverUrl, roomInfos.roomId);
  const conversation = await Data.getConversationById(converationId);

  if (!conversation) {
    window.log.warn('clearInbox Matching conversation not found in db');
  } else {
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
      throw new Error('Could not clearInbox, res is invalid');
    }

    const rawMessage =
      (result.body && (result.body[0].body as OpenGroupClearInboxResponse)) || null;
    if (!rawMessage) {
      throw new Error('clearInbox parsing failed');
    }

    try {
      if (batchGlobalIsSuccess(result) && batchFirstSubIsSuccess(result)) {
        success = true;
        window.log.info(`clearInbox ${rawMessage.deleted} messages deleted from ${converationId} `);
      }
    } catch (e) {
      window?.log?.error("clearInbox Can't decode JSON body");
    }
  }

  if (!success) {
    window.log.info(`clearInbox message deletion failed for ${converationId} `);
  }
  return success;
};
