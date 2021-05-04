import {
  getV2OpenGroupRoomByRoomId,
  OpenGroupV2Room,
  saveV2OpenGroupRoom,
} from '../../data/opengroups';
import { OpenGroupV2CompactPollRequest, OpenGroupV2Info, parseMessages } from './ApiUtil';
import { parseStatusCodeFromOnionRequest } from './OpenGroupAPIV2Parser';
import _ from 'lodash';
import { sendViaOnion } from '../../session/onions/onionSend';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import { downloadPreviewOpenGroupV2, getAuthToken, getMemberCount } from './OpenGroupAPIV2';

const COMPACT_POLL_ENDPOINT = 'compact_poll';

export const compactFetchEverything = async (
  serverUrl: string,
  rooms: Set<string>,
  abortSignal: AbortSignal
): Promise<Array<ParsedRoomCompactPollResults> | null> => {
  // fetch all we need
  const compactPollRequest = await getCompactPollRequest(serverUrl, rooms);
  if (!compactPollRequest) {
    window.log.info('Nothing found to be fetched. returning');
    return null;
  }

  const result = await sendOpenGroupV2RequestCompactPoll(compactPollRequest, abortSignal);
  return result ? result : null;
};

export const getAllBase64AvatarForRooms = async (
  serverUrl: string,
  rooms: Set<string>,
  abortSignal: AbortSignal
): Promise<Array<ParsedBase64Avatar> | null> => {
  // fetch all we need
  const allValidRoomInfos = await getAllValidRoomInfos(serverUrl, rooms);
  if (!allValidRoomInfos?.length) {
    window.log.info('getAllBase64AvatarForRooms: no valid roominfos got.');
    return null;
  }
  if (abortSignal.aborted) {
    window.log.info('preview download aborted, returning null');
    return null;
  }
  // Currently this call will not abort if AbortSignal is aborted,
  // but the call will return null.
  const validPreviewBase64 = _.compact(
    await Promise.all(
      allValidRoomInfos.map(async room => {
        try {
          const base64 = await downloadPreviewOpenGroupV2(room);
          if (base64) {
            return {
              roomId: room.roomId,
              base64,
            };
          }
        } catch (e) {
          window.log.warn('getPreview failed for room', room);
        }
        return null;
      })
    )
  );

  if (abortSignal.aborted) {
    window.log.info('preview download aborted, returning null');
    return null;
  }

  return validPreviewBase64 ? validPreviewBase64 : null;
};

export const getAllMemberCount = async (
  serverUrl: string,
  rooms: Set<string>,
  abortSignal: AbortSignal
): Promise<Array<ParsedMemberCount> | null> => {
  // fetch all we need
  const allValidRoomInfos = await getAllValidRoomInfos(serverUrl, rooms);
  if (!allValidRoomInfos?.length) {
    window.log.info('getAllMemberCount: no valid roominfos got.');
    return null;
  }
  if (abortSignal.aborted) {
    window.log.info('memberCount aborted, returning null');
    return null;
  }
  // Currently this call will not abort if AbortSignal is aborted,
  // but the call will return null.
  const validMemberCount = _.compact(
    await Promise.all(
      allValidRoomInfos.map(async room => {
        try {
          const memberCount = await getMemberCount(room);
          if (memberCount !== undefined) {
            return {
              roomId: room.roomId,
              memberCount,
            };
          }
        } catch (e) {
          window.log.warn('getPreview failed for room', room);
        }
        return null;
      })
    )
  );

  if (abortSignal.aborted) {
    window.log.info('getMemberCount aborted, returning null');
    return null;
  }

  return validMemberCount ? validMemberCount : null;
};

/**
 * This function fetches the valid roomInfos from the database.
 * It also makes sure that the pubkey for all those rooms are the same, or returns null.
 */
const getAllValidRoomInfos = async (
  serverUrl: string,
  rooms: Set<string>
): Promise<Array<OpenGroupV2Room> | null> => {
  const allServerPubKeys: Array<string> = [];

  // fetch all the roomInfos for the specified rooms.
  // those invalid (like, not found in db) are excluded (with lodash compact)
  const validRoomInfos = _.compact(
    await Promise.all(
      [...rooms].map(async roomId => {
        try {
          const fetchedInfo = await getV2OpenGroupRoomByRoomId({
            serverUrl,
            roomId,
          });
          if (!fetchedInfo) {
            window.log.warn('Could not find this room getMessages');
            return null;
          }
          allServerPubKeys.push(fetchedInfo.serverPublicKey);

          return fetchedInfo;
        } catch (e) {
          window.log.warn('failed to fetch roominfos for room', roomId);
          return null;
        }
      })
    )
  );
  if (!validRoomInfos?.length) {
    return null;
  }
  // double check that all those server pubkeys are the same
  let firstPubkey: string;
  if (allServerPubKeys?.length) {
    firstPubkey = allServerPubKeys[0];
    const allMatch = allServerPubKeys.every(p => p === firstPubkey);
    if (!allMatch) {
      window.log.warn('All pubkeys do not match:', allServerPubKeys);
      return null;
    }
  } else {
    window.log.warn('No pubkeys found:', allServerPubKeys);
    return null;
  }
  return validRoomInfos;
};

/**
 * This return body to be used to do the compactPoll
 */
const getCompactPollRequest = async (
  serverUrl: string,
  rooms: Set<string>
): Promise<null | OpenGroupV2CompactPollRequest> => {
  const allValidRoomInfos = await getAllValidRoomInfos(serverUrl, rooms);
  if (!allValidRoomInfos?.length) {
    window.log.info('compactPoll: no valid roominfos got.');
    return null;
  }

  const roomsRequestInfos = _.compact(
    allValidRoomInfos.map(validRoomInfos => {
      try {
        const {
          lastMessageFetchedServerID,
          lastMessageDeletedServerID,
          token,
          roomId,
        } = validRoomInfos;
        const roomRequestContent: Record<string, any> = {
          room_id: roomId,
          auth_token: token || '',
        };
        roomRequestContent.from_deletion_server_id = lastMessageDeletedServerID;
        roomRequestContent.from_message_server_id = lastMessageFetchedServerID;

        return roomRequestContent;
      } catch (e) {
        window.log.warn('failed to fetch roominfos for room', validRoomInfos.roomId);
        return null;
      }
    })
  );
  if (!roomsRequestInfos?.length) {
    return null;
  }

  const body = JSON.stringify({
    requests: roomsRequestInfos,
  });

  // getAllValidRoomInfos return null if the room have not all the same serverPublicKey.
  // so being here, we know this is the case
  return {
    body,
    server: serverUrl,
    serverPubKey: allValidRoomInfos[0].serverPublicKey,
    endpoint: COMPACT_POLL_ENDPOINT,
  };
};

/**
 * This call is separate as a lot of the logic is custom (statusCode handled separately, etc)
 */
async function sendOpenGroupV2RequestCompactPoll(
  request: OpenGroupV2CompactPollRequest,
  abortSignal: AbortSignal
): Promise<Array<ParsedRoomCompactPollResults> | null> {
  const { server: serverUrl, endpoint, body, serverPubKey } = request;
  // this will throw if the url is not valid
  const builtUrl = new URL(`${serverUrl}/${endpoint}`);

  const res = await sendViaOnion(
    serverPubKey,
    builtUrl,
    {
      method: 'POST',
      body,
    },
    {},
    abortSignal
  );

  const statusCode = parseStatusCodeFromOnionRequest(res);
  if (!statusCode) {
    window.log.warn('sendOpenGroupV2Request Got unknown status code; res:', res);
    return null;
  }

  const results = await parseCompactPollResults(res, serverUrl);
  if (!results) {
    window.log.info('got empty compactPollResults');
    return null;
  }
  // get all roomIds which needs a refreshed token
  const roomWithTokensToRefresh = results.filter(ret => ret.statusCode === 401).map(r => r.roomId);

  // this holds only the poll results which are valid
  const roomPollValidResults = results.filter(ret => ret.statusCode === 200);

  if (roomWithTokensToRefresh) {
    await Promise.all(
      roomWithTokensToRefresh.map(async roomId => {
        const roomDetails = await getV2OpenGroupRoomByRoomId({
          serverUrl,
          roomId,
        });
        if (!roomDetails) {
          return;
        }
        roomDetails.token = undefined;
        // we might need to retry doing the request here, but how to make sure we don't retry indefinetely?
        await saveV2OpenGroupRoom(roomDetails);
        // do not await for that. We have a only one at a time logic on a per room basis
        await getAuthToken({ serverUrl, roomId });
      })
    );
  }

  return roomPollValidResults;
}

export type ParsedDeletions = Array<{ id: number; deleted_message_id: number }>;

type StatusCodeType = {
  statusCode: number;
};

export type ParsedRoomCompactPollResults = StatusCodeType & {
  roomId: string;
  deletions: ParsedDeletions;
  messages: Array<OpenGroupMessageV2>;
  moderators: Array<string>;
};

export type ParsedBase64Avatar = {
  roomId: string;
  base64: string;
};

export type ParsedMemberCount = {
  roomId: string;
  memberCount: number;
};

const parseCompactPollResult = async (
  singleRoomResult: any,
  serverUrl: string
): Promise<ParsedRoomCompactPollResults | null> => {
  const {
    room_id,
    deletions: rawDeletions,
    messages: rawMessages,
    moderators: rawMods,
    status_code: rawStatusCode,
  } = singleRoomResult;

  if (
    !room_id ||
    rawDeletions === undefined ||
    rawMessages === undefined ||
    rawMods === undefined ||
    !rawStatusCode
  ) {
    window.log.warn('Invalid compactPoll result', singleRoomResult);
    return null;
  }

  const validMessages = await parseMessages(rawMessages);

  const moderators = rawMods.sort() as Array<string>;
  const deletions = rawDeletions as ParsedDeletions;
  const statusCode = rawStatusCode as number;

  return {
    roomId: room_id,
    deletions,
    messages: validMessages,
    moderators,
    statusCode,
  };
};

const parseCompactPollResults = async (
  res: any,
  serverUrl: string
): Promise<Array<ParsedRoomCompactPollResults> | null> => {
  if (!res || !res.result || !res.result.results || !res.result.results.length) {
    return null;
  }
  const arrayOfResults = res.result.results as Array<any>;

  const parsedResults: Array<ParsedRoomCompactPollResults> = _.compact(
    await Promise.all(
      arrayOfResults.map(async m => {
        return parseCompactPollResult(m, serverUrl);
      })
    )
  );

  if (!parsedResults || !parsedResults.length) {
    return null;
  }
  return parsedResults;
};
