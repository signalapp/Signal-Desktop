import AbortController from 'abort-controller';
import { compact, uniq } from 'lodash';
import { OpenGroupV2Room } from '../../../../data/opengroups';
import { capabilitiesListHasBlindEnabled } from '../../../../types/sqlSharedTypes';
import { OnionSending } from '../../../onions/onionSend';
import { OpenGroupV2Info } from '../opengroupV2/ApiUtil';
import { batchGlobalIsSuccess, parseBatchGlobalStatusCode } from './sogsV3BatchPoll';
import { fetchCapabilitiesAndUpdateRelatedRoomsOfServerUrl } from './sogsV3Capabilities';

export const getAllRoomInfos = async (roomInfos: OpenGroupV2Room) => {
  const result = await OnionSending.sendJsonViaOnionV4ToSogs({
    blinded: true,
    endpoint: '/rooms',
    method: 'GET',
    serverPubkey: roomInfos.serverPublicKey,
    stringifiedBody: null,
    abortSignal: new AbortController().signal,
    serverUrl: roomInfos.serverUrl,
    headers: null,
    throwErrors: false,
  });

  // not a batch call yet as we need to exclude headers for this call for now
  if (result && batchGlobalIsSuccess(result)) {
    return parseRooms(result);
  }

  const statusCode = parseBatchGlobalStatusCode(result);

  window?.log?.warn('getAllRoomInfos failed invalid status code:', statusCode);
  return undefined;
};

const parseRooms = (jsonResult?: Record<string, any>): undefined | Array<OpenGroupV2Info> => {
  if (!jsonResult) {
    return undefined;
  }
  const rooms = jsonResult?.body as Array<any>;

  if (!rooms || !rooms.length) {
    window?.log?.warn('getAllRoomInfos failed invalid infos');
    return [];
  }
  return compact(
    rooms.map(room => {
      // check that the room is correctly filled
      const { token: id, name, image_id: imageId } = room;
      if (!id || !name) {
        window?.log?.info('getAllRoomInfos: Got invalid room details, skipping');
        return null;
      }

      return { id, name, imageId } as OpenGroupV2Info;
    })
  );
};

/**
 * Fetch the required room infos before joining a room (caps, name, imageId, etc)
 */
export async function openGroupV2GetRoomInfoViaOnionV4({
  serverUrl,
  serverPubkey,
  roomId,
}: {
  serverPubkey: string;
  serverUrl: string;
  roomId: string;
}): Promise<OpenGroupV2Info | null> {
  const abortSignal = new AbortController().signal;

  const caps = await fetchCapabilitiesAndUpdateRelatedRoomsOfServerUrl(serverUrl);

  if (!caps || caps.length === 0) {
    window?.log?.warn('getInfo failed because capabilities failed');
    return null;
  }

  const hasBlindingEnabled = capabilitiesListHasBlindEnabled(caps);
  window?.log?.info(`openGroupV2GetRoomInfoViaOnionV4 capabilities for  ${serverUrl}: ${caps}`);

  const result = await OnionSending.sendJsonViaOnionV4ToSogs({
    blinded: hasBlindingEnabled,
    method: 'GET',
    serverUrl,
    endpoint: `/room/${roomId}`,
    abortSignal,
    stringifiedBody: null,
    serverPubkey,
    headers: null,
    throwErrors: false,
  });
  const room = result?.body as Record<string, any> | undefined;
  if (room) {
    const { token: id, name, image_id: imageId } = room;

    if (!id || !name) {
      window?.log?.warn('getRoominfo Parsing failed');
      return null;
    }

    const info: OpenGroupV2Info = {
      id,
      name,
      imageId,
      capabilities: caps ? uniq(caps) : undefined,
    };
    return info;
  }
  window?.log?.warn('openGroupV2GetRoomInfoViaOnionV4 failed');
  return null;
}
