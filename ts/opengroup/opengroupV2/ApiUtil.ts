import _ from 'underscore';
import { PubKey } from '../../session/types';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import { fromBase64ToArrayBuffer, fromHex } from '../../session/utils/String';
import { updateDefaultRooms } from '../../state/ducks/defaultRooms';
import { getCompleteUrlFromRoom } from '../utils/OpenGroupUtils';
import { parseOpenGroupV2 } from './JoinOpenGroupV2';
import { getAllRoomInfos } from './OpenGroupAPIV2';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';

export const defaultServer = 'https://sessionopengroup.com';
export const defaultServerPublicKey =
  '658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231b';

export type OpenGroupRequestCommonType = {
  serverUrl: string;
  roomId: string;
};

export type OpenGroupV2Request = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  room: string;
  server: string;
  endpoint: string;
  // queryParams are used for post or get, but not the same way
  queryParams?: Record<string, any>;
  headers?: Record<string, string>;
  isAuthRequired: boolean;
  serverPublicKey?: string; // if not provided, a db called will be made to try to get it.
};

export type OpenGroupV2CompactPollRequest = {
  server: string;
  endpoint: string;
  body: string;
  serverPubKey: string;
};

export type OpenGroupV2Info = {
  id: string;
  name: string;
  imageId?: string;
};

export type OpenGroupV2InfoJoinable = OpenGroupV2Info & {
  completeUrl: string;
};

/**
 * Try to build an full url and check it for validity.
 * @returns null if the check failed. the built URL otherwise
 */
export const buildUrl = (request: OpenGroupV2Request): URL | null => {
  let rawURL = `${request.server}/${request.endpoint}`;
  if (request.method === 'GET') {
    const entries = Object.entries(request.queryParams || {});

    if (entries.length) {
      const queryString = entries.map(([key, value]) => `${key}=${value}`).join('&');
      rawURL += `?${queryString}`;
    }
  }
  // this just check that the URL is valid
  try {
    return new URL(`${rawURL}`);
  } catch (error) {
    return null;
  }
};

export const parseMessages = async (
  rawMessages: Array<Record<string, any>>
): Promise<Array<OpenGroupMessageV2>> => {
  if (!rawMessages) {
    window.log.info('no new messages');
    return [];
  }
  const messages = await Promise.all(
    rawMessages.map(async r => {
      try {
        const opengroupMessage = OpenGroupMessageV2.fromJson(r);
        if (
          !opengroupMessage?.serverId ||
          !opengroupMessage.sentTimestamp ||
          !opengroupMessage.base64EncodedData ||
          !opengroupMessage.base64EncodedSignature
        ) {
          window.log.warn('invalid open group message received');
          return null;
        }
        // Validate the message signature
        const senderPubKey = PubKey.cast(opengroupMessage.sender).withoutPrefix();
        const signature = fromBase64ToArrayBuffer(opengroupMessage.base64EncodedSignature);
        const messageData = fromBase64ToArrayBuffer(opengroupMessage.base64EncodedData);
        // throws if signature failed
        await window.libsignal.Curve.async.verifySignature(
          fromHex(senderPubKey),
          messageData,
          signature
        );
        return opengroupMessage;
      } catch (e) {
        window.log.error('An error happened while fetching getMessages output:', e);
        return null;
      }
    })
  );
  return _.compact(messages);
};

//       'http://sessionopengroup.com/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231b'

// FIXME audric change this to sessionopengroup.com once http is fixed
const defaultRoom =
  'https://opengroup.bilb.us/main?public_key=1352534ba73d4265973280431dbc72e097a3e43275d1ada984f9805b4943047d';

const loadDefaultRoomsSingle = () =>
  allowOnlyOneAtATime(
    'loadDefaultRoomsSingle',
    async (): Promise<Array<OpenGroupV2InfoJoinable>> => {
      const roomInfos = parseOpenGroupV2(defaultRoom);
      if (roomInfos) {
        try {
          const roomsGot = await getAllRoomInfos(roomInfos);

          if (!roomsGot) {
            return [];
          }

          return roomsGot.map(room => {
            return {
              ...room,
              completeUrl: getCompleteUrlFromRoom({
                serverUrl: roomInfos.serverUrl,
                serverPublicKey: roomInfos.serverPublicKey,
                roomId: room.id,
              }),
            };
          });
        } catch (e) {
          window.log.warn('loadDefaultRoomsIfNeeded failed', e);
        }
        return [];
      }
      return [];
    }
  );

/**
 * Load to the cache all the details of the room of the default opengroupv2 server
 * This call will only run once at a time.
 */
export const loadDefaultRoomsIfNeeded = async () => {
  // FIXME audric do the UI and refresh this list from time to time
  const allRooms: Array<OpenGroupV2InfoJoinable> = await loadDefaultRoomsSingle();
  if (allRooms !== undefined) {
    window.inboxStore?.dispatch(updateDefaultRooms(allRooms));
  }
};
