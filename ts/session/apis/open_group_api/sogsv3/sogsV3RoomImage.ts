import AbortController from 'abort-controller';
import { isNumber } from 'lodash';
import { batchFirstSubIsSuccess, batchGlobalIsSuccess, sogsBatchSend } from './sogsV3BatchPoll';
import { uploadFileToRoomSogs3 } from './sogsV3SendFile';
import { OpenGroupRequestCommonType } from '../../../../data/types';

/**
 * This function does a double request to the sogs.
 * - First request uploads the file content to the server and gets the associated fileId.
 * - Second request set the preview/avatar image of that room to the just got fileId.
 *
 * @param fileContent the content of the image to upload as new sogs room image. Be sure to resize it to not have something too big (500x500 jpeg should be enough)
 * @param roomInfos the room details including the
 * @returns the fileId and the full url of the new avatar. To be used for redownload and to set the avatar locally once it is updated.
 */
export const uploadImageForRoomSogsV3 = async (
  fileContent: Uint8Array,
  roomInfos: OpenGroupRequestCommonType
): Promise<{ fileUrl: string; fileId: number } | null> => {
  if (!fileContent || !fileContent.length) {
    return null;
  }

  const result = await uploadFileToRoomSogs3(fileContent, roomInfos);
  if (!result || !isNumber(result.fileId)) {
    return null;
  }
  const { fileId, fileUrl } = result;
  if (!fileId || !fileContent.length) {
    return null;
  }

  const batchResult = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [{ type: 'updateRoom', updateRoom: { roomId: roomInfos.roomId, imageId: fileId } }],
    'batch'
  );

  if (!batchGlobalIsSuccess(batchResult) || !batchFirstSubIsSuccess(batchResult)) {
    return null;
  }
  return {
    fileUrl,
    fileId,
  };
};
