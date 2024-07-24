import { compact } from 'lodash';

import { OpenGroupData } from '../../../../data/opengroups';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';
import { UserUtils } from '../../../utils';
import { fromHexToArray } from '../../../utils/String';
import { getSodiumRenderer } from '../../../crypto';
import { SogsBlinding } from '../sogsv3/sogsBlinding';
import { GetNetworkTime } from '../../snode_api/getNetworkTime';
import { OpenGroupV2Room } from '../../../../data/types';

export type OpenGroupRequestHeaders = {
  'X-SOGS-Pubkey': string;
  'X-SOGS-Timestamp': string | number;
  'X-SOGS-Signature': string;
  'X-SOGS-Nonce': string;
  /** content-type required for batch requests */
  'Content-Type'?: string;
};

/**
 * Creates headers for an authenticated open group request using our information
 * @param serverPublicKey Public key of server we're requesting to
 * @param endpoint endpoint of request we're making
 * @param method method of request we're making
 * @param blinded is the server being requested to blinded or not
 * @param body the body of the request we're making
 * @returns object of headers, including X-SOGS and other headers.
 */
const getOurOpenGroupHeaders = async (
  serverPublicKey: string,
  endpoint: string,
  method: string,
  blinded: boolean,
  body: string | null | Uint8Array
): Promise<OpenGroupRequestHeaders | undefined> => {
  // this value is cached
  const signingKeys = await UserUtils.getUserED25519KeyPairBytes();
  if (!signingKeys) {
    window?.log?.error('getOurOpenGroupHeaders - Unable to get our signing keys');
    return undefined;
  }

  const nonce = (await getSodiumRenderer()).randombytes_buf(16);

  const timestamp = Math.floor(GetNetworkTime.getNowWithNetworkOffset() / 1000);
  return SogsBlinding.getOpenGroupHeaders({
    signingKeys,
    serverPK: fromHexToArray(serverPublicKey),
    nonce,
    method,
    path: endpoint,
    timestamp,
    blinded,
    body,
  });
};

/**
 * This function fetches the valid roomInfos from the database.
 * It also makes sure that the pubkey for all those rooms are the same, or returns null.
 */
const getAllValidRoomInfos = (
  serverUrl: string,
  rooms: Set<string>
): Array<OpenGroupV2Room> | null => {
  const allServerPubKeys: Array<string> = [];

  // fetch all the roomInfos for the specified rooms.
  // those invalid (like, not found in db) are excluded (with lodash compact)
  const validRoomInfos = compact(
    [...rooms].map(roomId => {
      try {
        const fetchedInfo = OpenGroupData.getV2OpenGroupRoomByRoomId({
          serverUrl,
          roomId,
        });
        if (!fetchedInfo) {
          window?.log?.warn('Could not find this room getMessages');
          return null;
        }
        allServerPubKeys.push(fetchedInfo.serverPublicKey);

        return fetchedInfo;
      } catch (e) {
        window?.log?.warn('failed to fetch roominfos for room', roomId);
        return null;
      }
    })
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
      window?.log?.warn('All pubkeys do not match:', allServerPubKeys);
      return null;
    }
  } else {
    window?.log?.warn('No pubkeys found:', allServerPubKeys);
    return null;
  }
  return validRoomInfos;
};

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

export const OpenGroupPollingUtils = { getAllValidRoomInfos, getOurOpenGroupHeaders };
