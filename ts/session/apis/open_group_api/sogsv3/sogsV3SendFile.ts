import AbortController from 'abort-controller';
import { OpenGroupData } from '../../../../data/opengroups';
import { roomHasBlindEnabled } from '../../../../types/sqlSharedTypes';
import { OnionSending } from '../../../onions/onionSend';
import { batchGlobalIsSuccess } from './sogsV3BatchPoll';
import { OpenGroupRequestCommonType } from '../../../../data/types';

/**
 * Returns the id on which the file is saved, or null
 */
export const uploadFileToRoomSogs3 = async (
  fileContent: Uint8Array,
  roomInfos: OpenGroupRequestCommonType
): Promise<{ fileId: number; fileUrl: string } | null> => {
  if (!fileContent || !fileContent.length) {
    return null;
  }

  const roomDetails = OpenGroupData.getV2OpenGroupRoomByRoomId(roomInfos);
  if (!roomDetails || !roomDetails.serverPublicKey) {
    window.log.warn('uploadFileOpenGroupV3: roomDetails is invalid');
    return null;
  }

  const result = await OnionSending.sendBinaryViaOnionV4ToSogs({
    abortSignal: new AbortController().signal,
    blinded: roomHasBlindEnabled(roomDetails),
    bodyBinary: fileContent,
    headers: null,
    serverPubkey: roomDetails.serverPublicKey,
    endpoint: `/room/${roomDetails.roomId}/file`,
    method: 'POST',
    serverUrl: roomDetails.serverUrl,
  });

  if (!batchGlobalIsSuccess(result)) {
    return null;
  }

  const fileId = (result?.body as any | undefined)?.id as number | undefined;
  if (!fileId) {
    return null;
  }
  const fileUrl = `${roomInfos.serverUrl}/room/${roomDetails.roomId}/file/${fileId}`;

  return {
    fileId,
    fileUrl,
  };
};
