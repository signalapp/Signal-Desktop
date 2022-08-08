import AbortController from 'abort-controller';
import { PubKey } from '../../../types';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import { batchFirstSubIsSuccess, OpenGroupBatchRow, sogsBatchSend } from './sogsV3BatchPoll';

export const sogsV3BanUser = async (
  userToBan: PubKey,
  roomInfos: OpenGroupRequestCommonType,
  deleteAllMessages: boolean
): Promise<boolean> => {
  const sequence: Array<OpenGroupBatchRow> = [
    {
      type: 'banUnbanUser',
      banUnbanUser: {
        sessionId: userToBan.key,
        roomId: roomInfos.roomId,
        type: 'ban',
      },
    },
  ];

  if (deleteAllMessages) {
    sequence.push({
      type: 'deleteAllPosts',
      deleteAllPosts: { sessionId: userToBan.key, roomId: roomInfos.roomId },
    });
  }

  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    sequence,
    'sequence'
  );
  return batchFirstSubIsSuccess(batchSendResponse);
};

export const sogsV3UnbanUser = async (
  userToBan: PubKey,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'banUnbanUser',
        banUnbanUser: {
          sessionId: userToBan.key,
          roomId: roomInfos.roomId,
          type: 'unban',
        },
      },
    ],
    'batch'
  );
  return batchFirstSubIsSuccess(batchSendResponse);
};
