import { Headers } from 'node-fetch';
import { allowOnlyOneAtATime } from '../../../js/modules/loki_primitives';
import { getV2OpenGroupRoomByRoomId } from '../../data/opengroups';
import { sendViaOnion } from '../../session/onions/onionSend';
import { fromBase64ToArray } from '../../session/utils/String';
import {
  getIdentityKeyPair,
  getOurPubKeyStrFromCache,
} from '../../session/utils/User';

// HTTP HEADER FOR OPEN GROUP V2
const HEADER_ROOM = 'Room';
const HEADER_AUTHORIZATION = 'Authorization';

const PARAMETER_PUBLIC_KEY = 'public_key';

export const openGroupV2PubKeys: Record<string, string> = {};

export const defaultServer = 'https://sessionopengroup.com';
export const defaultServerPublicKey =
  '658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231b';

type OpenGroupV2Request = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  room: string;
  server: string;
  endpoint: string;
  // queryParams are used for post or get, but not the same way
  queryParams?: Map<string, string>;
  headers?: Headers;
  isAuthRequired: boolean;
  // Always `true` under normal circumstances. You might want to disable this when running over Lokinet.
  useOnionRouting?: boolean;
};

type OpenGroupV2Info = {
  id: string;
  name: string;
  imageId?: string;
};

/**
 * Try to build an full url and check it for validity.
 * @returns null if the check failed. the built URL otherwise
 */
const buildUrl = (request: OpenGroupV2Request): URL | null => {
  let rawURL = `${request.server}/${request.endpoint}`;
  if (request.method === 'GET') {
    if (!!request.queryParams?.size) {
      const entries = [...request.queryParams.entries()];
      const queryString = entries
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      rawURL += `/?${queryString}`;
    }
  }
  // this just check that the URL is valid
  try {
    return new URL(`${rawURL}`);
  } catch (error) {
    return null;
  }
};

/**
 * Map of serverUrl to roomId to list of moderators as a Set
 */
export const moderators: Map<string, Map<string, Set<string>>> = new Map();

// This function might throw
async function sendOpenGroupV2Request(
  request: OpenGroupV2Request
): Promise<Object> {
  const builtUrl = buildUrl(request);

  if (!builtUrl) {
    throw new Error('Invalid request');
  }

  // set the headers sent by the caller, and the roomId.
  const headersWithRoom = request.headers || new Headers();
  headersWithRoom.append(HEADER_ROOM, request.room);
  console.warn(`request: ${builtUrl}`);

  // request.useOnionRouting === undefined defaults to true
  if (request.useOnionRouting || request.useOnionRouting === undefined) {
    const roomDetails = await getV2OpenGroupRoomByRoomId(
      request.server,
      request.room
    );
    if (!roomDetails?.serverPublicKey) {
      throw new Error('PublicKey not found for this server.');
    }
    // Because auth happens on a per-room basis, we need both to make an authenticated request
    if (request.isAuthRequired && request.room) {
      const token = await getAuthToken(request.room, request.server);
      if (!token) {
        throw new Error('Failed to get token for open group v2');
      }
      headersWithRoom.append(HEADER_AUTHORIZATION, token);

      // FIXME use headersWithRoom
    } else {
      // no need for auth, just do the onion request
      const res = await sendViaOnion(roomDetails.serverPublicKey, builtUrl, {
        method: request.method,
        headers: { ...headersWithRoom.entries() },
      });
      return res;
    }

    return {};
  } else {
    throw new Error(
      "It's currently not allowed to send non onion routed requests."
    );
  }
}

// tslint:disable: member-ordering
export async function requestNewAuthToken(
  serverUrl: string,
  roomid: string
): Promise<void> {
  const userKeyPair = await getIdentityKeyPair();
  if (!userKeyPair) {
    throw new Error('Failed to fetch user keypair');
  }

  const ourPubkey = getOurPubKeyStrFromCache();
  const parameters = [PARAMETER_PUBLIC_KEY, ourPubkey] as [string, string];
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomid,
    server: serverUrl,
    queryParams: new Map([parameters]),
    isAuthRequired: false,
    endpoint: 'auth_token_challenge',
  };
  const json = (await sendOpenGroupV2Request(request)) as any;
  // parse the json
  const { challenge } = json;
  if (!challenge) {
    throw new Error('Parsing failed');
  }
  const {
    ciphertext: base64EncodedCiphertext,
    ephemeral_public_key: base64EncodedEphemeralPublicKey,
  } = challenge;

  if (!base64EncodedCiphertext || !base64EncodedEphemeralPublicKey) {
    throw new Error('Parsing failed');
  }
  const ciphertext = fromBase64ToArray(base64EncodedCiphertext);
  const ephemeralPublicKey = fromBase64ToArray(base64EncodedEphemeralPublicKey);
  console.warn('ciphertext', ciphertext);
  console.warn('ephemeralPublicKey', ephemeralPublicKey);
}

/**
 * This function might throw
 *
 */
export async function openGroupV2GetRoomInfo(
  roomId: string,
  serverUrl: string
): Promise<OpenGroupV2Info> {
  const request: OpenGroupV2Request = {
    method: 'GET',
    server: serverUrl,
    room: roomId,
    isAuthRequired: false,
    endpoint: `rooms/${roomId}`,
  };
  const result = (await sendOpenGroupV2Request(request)) as any;
  if (result?.result?.room) {
    const { id, name, image_id: imageId } = result?.result?.room;

    if (!id || !name) {
      throw new Error('Parsing failed');
    }
    const info: OpenGroupV2Info = {
      id,
      name,
      imageId,
    };

    return info;
  }
  throw new Error('getInfo failed');
}

async function claimAuthToken(
  authToken: string,
  serverUrl: string,
  roomid: string
): Promise<void> {
  const ourPubkey = getOurPubKeyStrFromCache();
  const parameters = [PARAMETER_PUBLIC_KEY, ourPubkey] as [string, string];
  // Set explicitly here because is isn't in the database yet at this point
  const headers = new Headers({ HEADER_AUTHORIZATION: authToken });
  const request: OpenGroupV2Request = {
    method: 'POST',
    headers,
    room: roomid,
    server: serverUrl,
    queryParams: new Map([parameters]),
    isAuthRequired: false,
    endpoint: 'claim_auth_token',
  };
  await sendOpenGroupV2Request(request);
}

async function getAuthToken(
  serverUrl: string,
  roomId: string
): Promise<string> {
  // first try to fetch from db a saved token.
  const roomDetails = await getV2OpenGroupRoomByRoomId(serverUrl, roomId);
  if (roomDetails?.token) {
    return roomDetails?.token;
  }

  // const token = await allowOnlyOneAtATime(
  //   `getAuthTokenV2${serverUrl}:${roomId}`,
  //   async () => {
  //     requestNewAuthToken
  //   }
  // );

  return 'token';
}
