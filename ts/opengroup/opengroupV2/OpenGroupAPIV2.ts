import _ from 'lodash';
import {
  getV2OpenGroupRoomByRoomId,
  saveV2OpenGroupRoom,
} from '../../data/opengroups';
import { getSodium } from '../../session/crypto';
import { sendViaOnion } from '../../session/onions/onionSend';
import { PubKey } from '../../session/types';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import {
  fromBase64ToArray,
  fromBase64ToArrayBuffer,
  fromHexToArray,
  toHex,
} from '../../session/utils/String';
import {
  getIdentityKeyPair,
  getOurPubKeyStrFromCache,
} from '../../session/utils/User';
import {
  buildUrl,
  cachedModerators,
  OpenGroupRequestCommonType,
  OpenGroupV2Info,
  OpenGroupV2Request,
  parseMessages,
  setCachedModerators,
} from './ApiUtil';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';

// This function might throw
async function sendOpenGroupV2Request(
  request: OpenGroupV2Request
): Promise<Object> {
  const builtUrl = buildUrl(request);

  if (!builtUrl) {
    throw new Error('Invalid request');
  }

  // set the headers sent by the caller, and the roomId.
  const headers = request.headers || {};
  headers.Room = request.room;
  console.warn(`sending request: ${builtUrl}`);
  let body = '';
  if (request.method !== 'GET') {
    body = JSON.stringify(request.queryParams);
  }

  // request.useOnionRouting === undefined defaults to true
  if (request.useOnionRouting || request.useOnionRouting === undefined) {
    const roomDetails = await getV2OpenGroupRoomByRoomId({
      serverUrl: request.server,
      roomId: request.room,
    });
    if (!roomDetails?.serverPublicKey) {
      throw new Error('PublicKey not found for this server.');
    }
    // Because auth happens on a per-room basis, we need both to make an authenticated request
    if (request.isAuthRequired && request.room) {
      // this call will either return the token on the db,
      // or the promise currently fetching a new token for that same room
      // or fetch a new token for that room if no other request are currently being made.
      const token = await getAuthToken({
        roomId: request.room,
        serverUrl: request.server,
      });
      if (!token) {
        throw new Error('Failed to get token for open group v2');
      }
      headers.Authorization = token;
      const res = await sendViaOnion(roomDetails.serverPublicKey, builtUrl, {
        method: request.method,
        headers,
        body,
      });
      // A 401 means that we didn't provide a (valid) auth token for a route that required one. We use this as an
      // indication that the token we're using has expired. Note that a 403 has a different meaning; it means that
      // we provided a valid token but it doesn't have a high enough permission level for the route in question.
      return res;
    } else {
      // no need for auth, just do the onion request
      const res = await sendViaOnion(roomDetails.serverPublicKey, builtUrl, {
        method: request.method,
        headers,
        body,
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
export async function requestNewAuthToken({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<string> {
  const userKeyPair = await getIdentityKeyPair();
  if (!userKeyPair) {
    throw new Error('Failed to fetch user keypair');
  }

  const ourPubkey = getOurPubKeyStrFromCache();
  const parameters = {} as Record<string, string>;
  parameters.public_key = ourPubkey;
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomId,
    server: serverUrl,
    queryParams: parameters,
    isAuthRequired: false,
    endpoint: 'auth_token_challenge',
  };
  const json = (await sendOpenGroupV2Request(request)) as any;
  // parse the json
  if (!json || !json?.result?.challenge) {
    throw new Error('Parsing failed');
  }
  const {
    ciphertext: base64EncodedCiphertext,
    ephemeral_public_key: base64EncodedEphemeralPublicKey,
  } = json?.result?.challenge;

  if (!base64EncodedCiphertext || !base64EncodedEphemeralPublicKey) {
    throw new Error('Parsing failed');
  }
  const ciphertext = fromBase64ToArrayBuffer(base64EncodedCiphertext);
  const ephemeralPublicKey = fromBase64ToArrayBuffer(
    base64EncodedEphemeralPublicKey
  );
  try {
    const symmetricKey = await window.libloki.crypto.deriveSymmetricKey(
      ephemeralPublicKey,
      userKeyPair.privKey
    );

    const plaintextBuffer = await window.libloki.crypto.DecryptAESGCM(
      symmetricKey,
      ciphertext
    );

    const token = toHex(plaintextBuffer);

    console.warn('token', token);
    return token;
  } catch (e) {
    window.log.error('Failed to decrypt token open group v2');
    throw e;
  }
}

/**
 * This function might throw
 *
 */
export async function openGroupV2GetRoomInfo({
  serverUrl,
  roomId,
}: {
  roomId: string;
  serverUrl: string;
}): Promise<OpenGroupV2Info> {
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
  roomId: string
): Promise<string> {
  // Set explicitly here because is isn't in the database yet at this point
  const headers = { Authorization: authToken };
  const request: OpenGroupV2Request = {
    method: 'POST',
    headers,
    room: roomId,
    server: serverUrl,
    queryParams: { public_key: getOurPubKeyStrFromCache() },
    isAuthRequired: false,
    endpoint: 'claim_auth_token',
  };
  const result = (await sendOpenGroupV2Request(request)) as any;
  if (result?.result?.status_code !== 200) {
    throw new Error(
      `Could not claim token, status code: ${result?.result?.status_code}`
    );
  }
  return authToken;
}

export async function getAuthToken({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<string> {
  // first try to fetch from db a saved token.
  const roomDetails = await getV2OpenGroupRoomByRoomId({ serverUrl, roomId });
  if (!roomDetails) {
    throw new Error('getAuthToken Room does not exist.');
  }
  if (roomDetails?.token) {
    return roomDetails?.token;
  }

  await allowOnlyOneAtATime(
    `getAuthTokenV2${serverUrl}:${roomId}`,
    async () => {
      try {
        const token = await requestNewAuthToken({ serverUrl, roomId });
        // claimAuthToken throws if the status code is not valid
        const claimedToken = await claimAuthToken(token, serverUrl, roomId);
        roomDetails.token = token;
        await saveV2OpenGroupRoom(roomDetails);
      } catch (e) {
        window.log.error('Failed to getAuthToken', e);
        throw e;
      }
    }
  );

  return 'token';
}

export const getModerators = async ({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<Array<string>> => {
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomId,
    server: serverUrl,
    isAuthRequired: true,
    endpoint: 'moderators',
  };
  const result = (await sendOpenGroupV2Request(request)) as any;
  if (result?.result?.status_code !== 200) {
    throw new Error(
      `Could not getModerators, status code: ${result?.result?.status_code}`
    );
  }
  const moderatorsGot = result?.result?.moderators;
  if (moderatorsGot === undefined) {
    throw new Error(
      'Could not getModerators, got no moderatorsGot at all in json.'
    );
  }
  setCachedModerators(serverUrl, roomId, moderatorsGot || []);
  return moderatorsGot || [];
};

export const deleteAuthToken = async ({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType) => {
  const request: OpenGroupV2Request = {
    method: 'DELETE',
    room: roomId,
    server: serverUrl,
    isAuthRequired: false,
    endpoint: 'auth_token',
  };
  const result = (await sendOpenGroupV2Request(request)) as any;
  if (result?.result?.status_code !== 200) {
    throw new Error(
      `Could not deleteAuthToken, status code: ${result?.result?.status_code}`
    );
  }
};

export const getMessages = async ({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<Array<OpenGroupMessageV2>> => {
  const roomInfos = await getV2OpenGroupRoomByRoomId({ serverUrl, roomId });
  if (!roomInfos) {
    throw new Error('Could not find this room getMessages');
  }
  const { lastMessageFetchedServerID } = roomInfos;

  const queryParams = {} as Record<string, any>;
  if (lastMessageFetchedServerID) {
    queryParams.from_server_id = lastMessageFetchedServerID;
  }

  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomId,
    server: serverUrl,
    isAuthRequired: true,
    endpoint: 'messages',
  };
  const result = (await sendOpenGroupV2Request(request)) as any;
  if (result?.result?.status_code !== 200) {
    throw new Error(
      `Could not getMessages, status code: ${result?.result?.status_code}`
    );
  }

  // we have a 200
  const rawMessages = result?.result?.messages as Array<Record<string, any>>;
  if (!rawMessages) {
    window.log.info('no new messages');
    return [];
  }
  const validMessages = await parseMessages(rawMessages);
  console.warn('validMessages', validMessages);
  return validMessages;
};

export const postMessage = async (
  message: OpenGroupMessageV2,
  room: OpenGroupRequestCommonType
) => {
  try {
    const signedMessage = await message.sign();
    const json = signedMessage.toJson();
    console.warn('posting message json', json);

    const request: OpenGroupV2Request = {
      method: 'POST',
      room: room.roomId,
      server: room.serverUrl,
      queryParams: json,
      isAuthRequired: true,
      endpoint: 'messages',
    };
    const result = (await sendOpenGroupV2Request(request)) as any;
    if (result?.result?.status_code !== 200) {
      throw new Error(
        `Could not postMessage, status code: ${result?.result?.status_code}`
      );
    }
    const rawMessage = result?.result?.message;
    if (!rawMessage) {
      throw new Error('postMessage parsing failed');
    }
    // this will throw if the json is not valid
    return OpenGroupMessageV2.fromJson(rawMessage);
  } catch (e) {
    window.log.error('Failed to post message to open group v2', e);
    throw e;
  }
};
