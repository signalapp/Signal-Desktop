import _ from 'lodash';
import { FileServerV2Request } from '../../fileserver/FileServerApiV2';
import { getSodium } from '../../session/crypto';
import { PubKey } from '../../session/types';
import { allowOnlyOneAtATime, sleepFor } from '../../session/utils/Promise';
import { fromBase64ToArrayBuffer, fromHex, fromHexToArray } from '../../session/utils/String';
import { updateDefaultRooms, updateDefaultRoomsInProgress } from '../../state/ducks/defaultRooms';
import { getCompleteUrlFromRoom } from '../utils/OpenGroupUtils';
import { parseOpenGroupV2 } from './JoinOpenGroupV2';
import { getAllRoomInfos } from './OpenGroupAPIV2';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';

export type OpenGroupRequestCommonType = {
  serverUrl: string;
  roomId: string;
};

export type OpenGroupV2Request = FileServerV2Request & {
  room: string;
  server: string;
  isAuthRequired: boolean;
  serverPublicKey?: string; // if not provided, a db called will be made to try to get it.
  forcedTokenToUse?: string;
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
  base64Data?: string;
};

export const parseMessages = async (
  rawMessages: Array<Record<string, any>>
): Promise<Array<OpenGroupMessageV2>> => {
  if (!rawMessages) {
    window?.log?.info('no new messages');
    return [];
  }
  const parsedMessages = [];

  // tslint:disable-next-line: prefer-for-of
  for (let i = 0; i < rawMessages.length; i++) {
    try {
      const opengroupv2Message = OpenGroupMessageV2.fromJson(rawMessages[i]);
      if (
        !opengroupv2Message?.serverId ||
        !opengroupv2Message.sentTimestamp || // this is our serverTimestamp
        !opengroupv2Message.base64EncodedData ||
        !opengroupv2Message.base64EncodedSignature
      ) {
        window?.log?.warn('invalid open group message received');
        continue;
      }
      // Validate the message signature
      console.time(`worker1-${opengroupv2Message?.serverId}`);
      const senderPubKey = PubKey.cast(opengroupv2Message.sender).withoutPrefix();
      const signature = (await window.callWorker(
        'fromBase64ToArrayBuffer',
        opengroupv2Message.base64EncodedSignature
      )) as ArrayBuffer;
      console.timeEnd(`worker1-${opengroupv2Message?.serverId}`);
      console.time(`worker2-${opengroupv2Message?.serverId}`);

      const messageData = (await window.callWorker(
        'fromBase64ToArrayBuffer',
        opengroupv2Message.base64EncodedData
      )) as ArrayBuffer;
      console.timeEnd(`worker2-${opengroupv2Message?.serverId}`);

      // throws if signature failed
      console.time(`verifySignature-${opengroupv2Message?.serverId}`);

      // const senderEd = (await getSodium()).crypto_sign_ed25519_sk_to_curve25519(
      //   fromHexToArray(senderPubKey),
      //   'uint8array'
      // );

      const valid = (await getSodium()).crypto_sign_verify_detached(
        new Uint8Array(signature),
        new Uint8Array(messageData),
        fromHexToArray(senderPubKey)
      );

      // const signatureValid = (await window.callWorker(
      //   'verifySignature',
      //   fromHexToArray(senderPubKey),
      //   new Uint8Array(messageData),
      //   new Uint8Array(signature)
      // )) as boolean;
      if (!valid) {
        console.timeEnd(`verifySignature-${opengroupv2Message?.serverId}`);
        throw new Error('opengroup message signature invalisd');
      }
      console.timeEnd(`verifySignature-${opengroupv2Message?.serverId}`);

      parsedMessages.push(opengroupv2Message);
      // as we are not running in a worker, just give some time for UI events
      await sleepFor(5);
    } catch (e) {
      window?.log?.error('An error happened while fetching getMessages output:', e);
    }
  }

  return _.compact(parsedMessages).sort((a, b) => (a.serverId || 0) - (b.serverId || 0));
};
// tslint:disable: no-http-string
const defaultServerUrl = 'http://116.203.70.33';
const defaultServerPublicKey = 'a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238';
const defaultRoom = `${defaultServerUrl}/main?public_key=${defaultServerPublicKey}`;

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
          window?.log?.warn('loadDefaultRoomloadDefaultRoomssIfNeeded failed', e);
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
export const loadDefaultRooms = async () => {
  window.inboxStore?.dispatch(updateDefaultRoomsInProgress(true));
  const allRooms: Array<OpenGroupV2InfoJoinable> = await loadDefaultRoomsSingle();
  window.inboxStore?.dispatch(updateDefaultRoomsInProgress(false));

  if (allRooms !== undefined) {
    window.inboxStore?.dispatch(updateDefaultRooms(allRooms));
  }
};
