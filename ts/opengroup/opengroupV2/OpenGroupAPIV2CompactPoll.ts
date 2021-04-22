import { getV2OpenGroupRoomByRoomId, saveV2OpenGroupRoom } from '../../data/opengroups';
import {
  OpenGroupRequestCommonType,
  OpenGroupV2CompactPollRequest,
  parseMessages,
} from './ApiUtil';
import { parseStatusCodeFromOnionRequest } from './OpenGroupAPIV2Parser';
import _ from 'lodash';
import { sendViaOnion } from '../../session/onions/onionSend';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import { getAuthToken } from './OpenGroupAPIV2';

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
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }
  return result;
};

/**
 * This return body to be used to do the compactPoll
 */
const getCompactPollRequest = async (
  serverUrl: string,
  rooms: Set<string>
): Promise<null | OpenGroupV2CompactPollRequest> => {
  const allServerPubKeys: Array<string> = [];

  const roomsRequestInfos = _.compact(
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

          const {
            lastMessageFetchedServerID,
            lastMessageDeletedServerID,
            token,
            serverPublicKey,
          } = fetchedInfo;
          allServerPubKeys.push(serverPublicKey);
          const roomRequestContent: Record<string, any> = {
            room_id: roomId,
            auth_token: token || '',
          };
          if (lastMessageDeletedServerID) {
            roomRequestContent.from_deletion_server_id = lastMessageDeletedServerID;
          }

          if (lastMessageFetchedServerID) {
            roomRequestContent.from_message_server_id = lastMessageFetchedServerID;
          }

          return roomRequestContent;
        } catch (e) {
          window.log.warn('failed to fetch roominfos for room', roomId);
          return null;
        }
      })
    )
  );
  if (!roomsRequestInfos?.length) {
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
  const body = JSON.stringify({
    requests: roomsRequestInfos,
  });
  return {
    body,
    server: serverUrl,
    serverPubKey: firstPubkey,
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

  console.warn(`sending compactPoll request: ${request.body}`);

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

  const results = await parseCompactPollResults(res);
  if (!results) {
    window.log.info('got empty compactPollResults');
    return null;
  }
  // get all roomIds which needs a refreshed token
  const roomTokensToRefresh = results.filter(ret => ret.statusCode === 401).map(r => r.roomId);

  if (roomTokensToRefresh) {
    await Promise.all(
      roomTokensToRefresh.map(async roomId => {
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
        void getAuthToken({ serverUrl, roomId });
      })
    );
  }

  throw new Error(
    'See how we handle needs of new tokens, and save stuff to db (last deleted, ... conversation commit, etc'
  );

  return results;
}

type ParsedRoomCompactPollResults = {
  roomId: string;
  deletions: Array<number>;
  messages: Array<OpenGroupMessageV2>;
  moderators: Array<string>;
  statusCode: number;
};

const parseCompactPollResult = async (
  singleRoomResult: any
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
  const moderators = rawMods as Array<string>;
  const deletions = rawDeletions as Array<number>;
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
  res: any
): Promise<Array<ParsedRoomCompactPollResults> | null> => {
  if (!res || !res.result || !res.result.results || !res.result.results.length) {
    return null;
  }
  const arrayOfResults = res.result.results as Array<any>;

  const parsedResults: Array<ParsedRoomCompactPollResults> = _.compact(
    await Promise.all(arrayOfResults.map(parseCompactPollResult))
  );

  if (!parsedResults || !parsedResults.length) {
    return null;
  }
  return parsedResults;
};
