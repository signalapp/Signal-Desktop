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
  const converationId = getOpenGroupV2ConversationId(roomInfos.serverUrl, roomInfos.roomId);
  const conversation = await Data.getConversationById(converationId);

  if (!conversation) {
    window.log.warn(`clear inbox Matching conversation not found in db`);
    // we failed
    return false;
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
    throw new Error('Could not clearInbox, res is invalid');
  }

  const rawMessage = (result.body && (result.body[0].body as OpenGroupClearInboxResponse)) || null;
  if (!rawMessage) {
    throw new Error('clearInbox parsing failed');
  }

  try {
    if (batchGlobalIsSuccess(result) && batchFirstSubIsSuccess(result)) {
      // we succeeded
      return true;
    } else {
      // we failed
      return false;
    }
  } catch (e) {
    window?.log?.error("clearInbox Can't decode JSON body");
  }

  return false;
};
