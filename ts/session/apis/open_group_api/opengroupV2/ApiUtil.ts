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

export const parseMessages = async (
  rawMessages: Array<Record<string, any>>
): Promise<Array<OpenGroupMessageV2>> => {
  if (!rawMessages || rawMessages.length === 0) {
    return [];
  }

  const startParse = Date.now();

  const opengroupMessagesSignatureUnchecked = _.compact(
    rawMessages.map(rawMessage => {
      try {
        const opengroupv2Message = OpenGroupMessageV2.fromJson(rawMessage);
        if (
          !opengroupv2Message?.serverId ||
          !opengroupv2Message.sentTimestamp || // this is our serverTimestamp
          !opengroupv2Message.base64EncodedData ||
          !opengroupv2Message.base64EncodedSignature
        ) {
          window?.log?.warn('invalid open group message received');
          return null;
        }
        const sender = PubKey.cast(opengroupv2Message.sender).withoutPrefix();
        return { opengroupv2Message, sender };
      } catch (e) {
        window.log.warn('an error happened with opengroup message', e);
        return null;
      }
    })
  );
  window.log.debug(`[perf] parseMessage took ${Date.now() - startParse}ms`);

  const sentToWorker = opengroupMessagesSignatureUnchecked.map(m => {
    return {
      sender: m.sender,
      base64EncodedSignature: m.opengroupv2Message.base64EncodedSignature,
      base64EncodedData: m.opengroupv2Message.base64EncodedData,
    };
  });
  const startVerify = Date.now();

  // this filters out any invalid signature and returns the array of valid encoded data
  const signatureValidEncodedData = (await callUtilsWorker(
    'verifyAllSignatures',
    sentToWorker
  )) as Array<string>;
  window.log.info(`[perf] verifyAllSignatures took ${Date.now() - startVerify}ms.`);

  const parsedMessages = opengroupMessagesSignatureUnchecked
    .filter(m => signatureValidEncodedData.includes(m.opengroupv2Message.base64EncodedData))
    .map(m => m.opengroupv2Message);

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
