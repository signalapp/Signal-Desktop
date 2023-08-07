import AbortController, { AbortSignal } from 'abort-controller';
import { isArray, isEmpty, isEqual, isObject } from 'lodash';
import { OpenGroupData } from '../../../../data/opengroups';
import { OnionSending } from '../../../onions/onionSend';
import { OpenGroupPollingUtils } from '../opengroupV2/OpenGroupPollingUtils';
import { batchGlobalIsSuccess } from './sogsV3BatchPoll';

const capabilitiesFetchForServer = async (
  serverUrl: string,
  serverPubKey: string,
  abortSignal: AbortSignal
): Promise<Array<string> | null> => {
  const endpoint = '/capabilities';
  const method = 'GET';
  const serverPubkey = serverPubKey;
  // for the capabilities call, we require blinded to be ON now. A sogs with blinding disabled will still allow this call and verify the blinded signature
  const blinded = true;
  const capabilityHeaders = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
    serverPubkey,
    endpoint,
    method,
    blinded,
    null
  );
  if (!capabilityHeaders) {
    return null;
  }

  const result = await OnionSending.sendJsonViaOnionV4ToSogs({
    abortSignal,
    blinded,
    endpoint,
    method,
    serverPubkey,
    serverUrl,
    stringifiedBody: null,
    headers: null,
    throwErrors: false,
  });
  // not a batch call yet as we need to exclude headers for this call for now
  if (!batchGlobalIsSuccess(result)) {
    window?.log?.warn('Capabilities Request Got unknown status code; res:', result);
    return null;
  }

  const parsedCapabilities = result?.body ? parseCapabilities(result.body) : [];
  return parsedCapabilities;
};

/**
 * @param body is the object containing a .capabilities field we should extract the list from.
 * @returns the sorted list of capabilities contained in that response, or null
 */
export function parseCapabilities(body: any): null | Array<string> {
  if (!body || isEmpty(body) || !isObject(body) || !isArray((body as any).capabilities)) {
    return null;
  }
  return (((body as any).capabilities as Array<string>) || []).sort(); // FIXME fix this type
}

export type ParsedBase64Avatar = {
  roomId: string;
  base64: string;
};

export type ParsedMemberCount = {
  roomId: string;
  memberCount: number;
};

export async function fetchCapabilitiesAndUpdateRelatedRoomsOfServerUrl(serverUrl: string) {
  let relatedRooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
  if (!relatedRooms || relatedRooms.length === 0) {
    return undefined;
  }

  // we actually don't do that call using batch send for now to avoid having to deal with the headers in batch poll.
  // these 2 requests below needs to not have sogs header at all and are unauthenticated

  const capabilities = await capabilitiesFetchForServer(
    serverUrl,
    relatedRooms[0].serverPublicKey,
    new AbortController().signal
  );
  if (!capabilities) {
    return undefined;
  }
  // just fetch updated data from the DB, just in case
  relatedRooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);
  if (!relatedRooms || relatedRooms.length === 0) {
    return undefined;
  }
  const newSortedCaps = capabilities.sort();

  await Promise.all(
    relatedRooms.map(async room => {
      if (!isEqual(newSortedCaps, room.capabilities?.sort() || '')) {
        // eslint-disable-next-line no-param-reassign
        room.capabilities = newSortedCaps;
        await OpenGroupData.saveV2OpenGroupRoom(room);
      }
    })
  );
  return newSortedCaps;
}
