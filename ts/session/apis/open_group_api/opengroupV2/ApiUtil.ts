import _ from 'lodash';
import { FileServerV2Request } from '../../file_server_api/FileServerApiV2';
import { PubKey } from '../../../types';
import { allowOnlyOneAtATime } from '../../../utils/Promise';
import {
  updateDefaultRooms,
  updateDefaultRoomsInProgress,
} from '../../../../state/ducks/defaultRooms';
import { BlockedNumberController } from '../../../../util';
import { getCompleteUrlFromRoom } from '../utils/OpenGroupUtils';
import { parseOpenGroupV2 } from './JoinOpenGroupV2';
import { getAllRoomInfos } from './OpenGroupAPIV2';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import { callUtilsWorker } from '../../../../webworker/workers/util_worker_interface';

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

export const TextToBase64 = async (text: string) => {
  const arrayBuffer = await callUtilsWorker('bytesFromString', text);

  const base64 = await callUtilsWorker('arrayBufferToStringBase64', arrayBuffer);

  return base64;
};

export const textToArrayBuffer = async (text: string) => {
  return callUtilsWorker('bytesFromString', text);
};

export const verifyED25519Signature = async (
  pubkey: string,
  base64EncodedData: string,
  base64EncondedSignature: string
): Promise<Boolean> => {
  return callUtilsWorker('verifySignature', pubkey, base64EncodedData, base64EncondedSignature);
};

export const parseMessages = async (
  rawMessages: Array<Record<string, any>>
): Promise<Array<OpenGroupMessageV2>> => {
  if (!rawMessages || rawMessages.length === 0) {
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
      const senderPubKey = PubKey.cast(opengroupv2Message.sender).withoutPrefix();

      const signatureValid = (await callUtilsWorker(
        'verifySignature',
        senderPubKey,
        opengroupv2Message.base64EncodedData,
        opengroupv2Message.base64EncodedSignature
      )) as boolean;
      if (!signatureValid) {
        throw new Error('opengroup message signature invalisd');
      }

      parsedMessages.push(opengroupv2Message);
    } catch (e) {
      window?.log?.error('An error happened while fetching getMessages output:', e);
    }
  }

  return _.compact(
    parsedMessages.map(m =>
      m && m.sender && !BlockedNumberController.isBlocked(m.sender) ? m : null
    )
  ).sort((a, b) => (a.serverId || 0) - (b.serverId || 0));
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
