import _ from 'lodash';
import { FileServerV2Request } from '../../fileserver/FileServerApiV2';
import { PubKey } from '../../session/types';
import { allowOnlyOneAtATime, sleepFor } from '../../session/utils/Promise';
import { fromBase64ToArrayBuffer, fromHex } from '../../session/utils/String';
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
  const chunks = _.chunk(rawMessages, 10);

  const handleChunk = async (chunk: Array<Record<string, any>>) => {
    return Promise.all(
      chunk.map(async r => {
        try {
          const opengroupv2Message = OpenGroupMessageV2.fromJson(r);
          if (
            !opengroupv2Message?.serverId ||
            !opengroupv2Message.sentTimestamp ||
            !opengroupv2Message.base64EncodedData ||
            !opengroupv2Message.base64EncodedSignature
          ) {
            window?.log?.warn('invalid open group message received');
            return null;
          }
          // Validate the message signature
          const senderPubKey = PubKey.cast(opengroupv2Message.sender).withoutPrefix();
          const signature = fromBase64ToArrayBuffer(opengroupv2Message.base64EncodedSignature);
          const messageData = fromBase64ToArrayBuffer(opengroupv2Message.base64EncodedData);
          // throws if signature failed
          await window.libsignal.Curve.async.verifySignature(
            fromHex(senderPubKey),
            messageData,
            signature
          );
          return opengroupv2Message;
        } catch (e) {
          window?.log?.error('An error happened while fetching getMessages output:', e);
          return null;
        }
      })
    );
  };

  const allHandledMessages = [];
  for (const currentChunk of chunks) {
    window?.log?.info('Handling rawMessage chunk of size', currentChunk.length);
    const messagesHandled = await handleChunk(currentChunk);
    allHandledMessages.push(...messagesHandled);
    // as we are not running in a worker, just give some time for UI events
    await sleepFor(2);
  }

  return _.compact(allHandledMessages).sort((a, b) => (a.serverId || 0) - (b.serverId || 0));
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
