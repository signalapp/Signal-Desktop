import { isEmpty } from 'lodash';
import { OpenGroupData, OpenGroupV2Room } from '../../../../data/opengroups';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';
import { getOpenGroupManager } from '../opengroupV2/OpenGroupManagerV2';
import { SessionUtilUserGroups } from '../../../utils/libsession/libsession_utils_user_groups';
import { getConversationController } from '../../../conversations';

// eslint-disable-next-line prefer-regex-literals
const protocolRegex = new RegExp('https?://');

const dot = '\\.';
const qMark = '\\?';
const hostSegment = '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?';
const hostnameRegex = new RegExp(`(?:${hostSegment}${dot})+${hostSegment}`);
const portRegex = ':[1-9][0-9]{0,4}';

// roomIds allow up to 64 ascii numbers, letters, '_', or '-' chars
const roomIdV2Regex = '[0-9a-zA-Z_-]{1,64}';
const publicKeyRegex = '[0-9a-fA-F]{64}';
export const publicKeyParam = 'public_key=';
const openGroupV2ServerUrlRegex = new RegExp(
  `(?:${protocolRegex.source})?${hostnameRegex.source}(?:${portRegex})?`
);

/**
 * Regex to use to check if a string is a v2open completeURL with pubkey.
 * Be aware that the /g flag is not set as .test() will otherwise return alternating result
 *
 * see https://stackoverflow.com/a/9275499/1680951
 */
export const openGroupV2CompleteURLRegex = new RegExp(
  // eslint-disable-next-line no-useless-escape
  `^${openGroupV2ServerUrlRegex.source}\/${roomIdV2Regex}${qMark}${publicKeyParam}${publicKeyRegex}$`
);

/**
 * Just a constant to have less 'http' everywhere.
 * This is the prefix used to identify our open groups in the conversation database (v1 or v2)
 */

const openGroupPrefix = 'http'; // can be http:// or https://

/**
 * This function returns a full url on an open group v2 room used for sync messages for instance.
 * This is basically what the QRcode encodes
 *
 */
export function getCompleteUrlFromRoom(roomInfos: OpenGroupV2Room) {
  if (
    isEmpty(roomInfos.serverUrl) ||
    isEmpty(roomInfos.roomId) ||
    isEmpty(roomInfos.serverPublicKey)
  ) {
    throw new Error('getCompleteUrlFromRoom needs serverPublicKey, roomid and serverUrl to be set');
  }
  // serverUrl has the port and protocol already
  return `${roomInfos.serverUrl}/${roomInfos.roomId}?${publicKeyParam}${roomInfos.serverPublicKey}`;
}

/**
 * Prefix server with https:// if it's not already prefixed with http or https.
 */
export function prefixify(server: string): string {
  const hasPrefix = server.match('^https?://');
  if (hasPrefix) {
    return server;
  }

  return `http://${server}`;
}

/**
 * No sql access. Just how our open groupv2 url looks like.
 * ServerUrl can have the protocol and port included, or not
 * @returns `${openGroupPrefix}${roomId}@${serverUrl}`
 */
export function getOpenGroupV2ConversationId(serverUrl: string, roomId: string) {
  // TODOLATER we should probably make this force the serverURL to be our sogs with https when it matches pubkey or domain name
  if (!roomId.match(`^${roomIdV2Regex}$`)) {
    throw new Error('getOpenGroupV2ConversationId: Invalid roomId');
  }
  if (!serverUrl.match(openGroupV2ServerUrlRegex)) {
    throw new Error('getOpenGroupV2ConversationId: Invalid serverUrl');
  }
  return `${serverUrl}/${roomId}`;
}

/**
 * No sql access. Just plain string logic
 */
export function getOpenGroupV2FromConversationId(
  conversationId: string
): OpenGroupRequestCommonType {
  if (isOpenGroupV2(conversationId)) {
    const endProtocolStr = '://';
    const startOfDoubleSlashes = conversationId.indexOf(endProtocolStr); // works for both http or https
    if (startOfDoubleSlashes < 0) {
      throw new Error('We need :// to be present in an opengroup URL');
    }
    const firstSlashAfterProtocol = conversationId.indexOf(
      '/',
      startOfDoubleSlashes + endProtocolStr.length + 1
    );
    const baseUrlWithProtocol = conversationId.substring(0, firstSlashAfterProtocol);
    const lastSlash = conversationId.lastIndexOf('/');
    const roomId = conversationId.slice(lastSlash + 1);
    return {
      serverUrl: baseUrlWithProtocol,
      roomId,
    };
  }
  throw new Error('Not a v2 open group convo id');
}

/**
 * Check if this conversation id corresponds to an OpenGroupV2 conversation.
 */
export function isOpenGroupV2(conversationId: string) {
  return Boolean(conversationId?.startsWith(openGroupPrefix));
}

/**
 * Fetches all roomInfos for all of our opengroup conversations.
 * We consider the conversations as our source-of-truth, so if there is a roomInfo without an associated convo, we remove it before returning.
 * @returns A map of conversationIds to roomInfos for all valid open group conversations or undefined
 */
export async function getAllValidOpenGroupV2ConversationRoomInfos() {
  const inWrapperCommunities = await SessionUtilUserGroups.getAllCommunitiesNotCached();

  const inWrapperIds = inWrapperCommunities.map(m =>
    getOpenGroupV2ConversationId(m.baseUrl, m.roomCasePreserved)
  );

  let allRoomInfos = OpenGroupData.getAllV2OpenGroupRoomsMap();

  // It is time for some cleanup!
  // We consider the wrapper to be our source-of-truth,
  // so if there is a roomInfos without an associated entry in the wrapper, we remove it from the map of opengroups rooms
  if (allRoomInfos?.size) {
    const roomInfosAsArray = [...allRoomInfos.values()];
    for (let index = 0; index < roomInfosAsArray.length; index++) {
      const infos = roomInfosAsArray[index];
      try {
        const roomConvoId = getOpenGroupV2ConversationId(infos.serverUrl, infos.roomId);
        if (!inWrapperIds.includes(roomConvoId)) {
          // remove the roomInfos locally for this open group room.

          /* eslint-disable no-await-in-loop */
          await OpenGroupData.removeV2OpenGroupRoom(roomConvoId);
          getOpenGroupManager().removeRoomFromPolledRooms(infos);
          await getConversationController().deleteCommunity(roomConvoId, {
            fromSyncMessage: false,
          });
          /* eslint-enable no-await-in-loop */
        }
      } catch (e) {
        window?.log?.warn('cleanup roomInfos error', e);
      }
    }
  }

  // refresh our roomInfos list
  allRoomInfos = OpenGroupData.getAllV2OpenGroupRoomsMap();
  return allRoomInfos;
}
