import _ from 'lodash';
import {
  getV2OpenGroupRoomByRoomId,
  OpenGroupV2Room,
  saveV2OpenGroupRoom,
} from '../../data/opengroups';
import { ConversationController } from '../../session/conversations';
import { sendViaOnion } from '../../session/onions/onionSend';
import { PubKey } from '../../session/types';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import {
  fromArrayBufferToBase64,
  fromBase64ToArrayBuffer,
  toHex,
} from '../../session/utils/String';
import { getIdentityKeyPair, getOurPubKeyStrFromCache } from '../../session/utils/User';
import { getCompleteEndpointUrl, getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import {
  buildUrl,
  OpenGroupRequestCommonType,
  OpenGroupV2Info,
  OpenGroupV2Request,
  parseMessages,
} from './ApiUtil';
import {
  parseMemberCount,
  parseRooms,
  parseStatusCodeFromOnionRequest,
} from './OpenGroupAPIV2Parser';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';

/**
 * This send function is to be used for all non polling stuff
 * download and upload of attachments for instance, but most of the logic happens in
 * the compact_poll endpoint
 */
async function sendOpenGroupV2Request(request: OpenGroupV2Request): Promise<Object | null> {
  const builtUrl = buildUrl(request);

  if (!builtUrl) {
    throw new Error('Invalid request');
  }

  // set the headers sent by the caller, and the roomId.
  const headers = request.headers || {};
  headers.Room = request.room;

  let body = '';
  if (request.method !== 'GET') {
    body = JSON.stringify(request.queryParams);
  }

  let serverPubKey: string;
  if (!request.serverPublicKey) {
    const roomDetails = await getV2OpenGroupRoomByRoomId({
      serverUrl: request.server,
      roomId: request.room,
    });
    if (!roomDetails?.serverPublicKey) {
      throw new Error('PublicKey not found for this server.');
    }
    serverPubKey = roomDetails.serverPublicKey;
  } else {
    serverPubKey = request.serverPublicKey;
  }
  // Because auth happens on a per-room basis, we need both to make an authenticated request
  if (request.isAuthRequired && request.room) {
    // this call will either return the token on the db,
    // or the promise currently fetching a new token for that same room
    // or fetch from the open group a new token for that room.
    const token = await getAuthToken({
      roomId: request.room,
      serverUrl: request.server,
    });
    if (!token) {
      window.log.error('Failed to get token for open group v2');
      return null;
    }
    headers.Authorization = token;
    const res = await sendViaOnion(
      serverPubKey,
      builtUrl,
      {
        method: request.method,
        headers,
        body,
      },
      { noJson: true }
    );

    const statusCode = parseStatusCodeFromOnionRequest(res);
    if (!statusCode) {
      window.log.warn('sendOpenGroupV2Request Got unknown status code; res:', res);
      return res as object;
    }
    // A 401 means that we didn't provide a (valid) auth token for a route that required one. We use this as an
    // indication that the token we're using has expired.
    // Note that a 403 has a different meaning; it means that
    // we provided a valid token but it doesn't have a high enough permission level for the route in question.
    if (statusCode === 401) {
      const roomDetails = await getV2OpenGroupRoomByRoomId({
        serverUrl: request.server,
        roomId: request.room,
      });
      if (!roomDetails) {
        window.log.warn('Got 401, but this room does not exist');
        return null;
      }
      roomDetails.token = undefined;
      // we might need to retry doing the request here, but how to make sure we don't retry indefinetely?
      await saveV2OpenGroupRoom(roomDetails);
    }
    return res as object;
  } else {
    // no need for auth, just do the onion request
    const res = await sendViaOnion(serverPubKey, builtUrl, {
      method: request.method,
      headers,
      body,
    });
    return res as object;
  }
}

// tslint:disable: member-ordering
export async function requestNewAuthToken({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<string | null> {
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
    window.log.warn('Parsing failed');
    return null;
  }
  const {
    ciphertext: base64EncodedCiphertext,
    ephemeral_public_key: base64EncodedEphemeralPublicKey,
  } = json?.result?.challenge;

  if (!base64EncodedCiphertext || !base64EncodedEphemeralPublicKey) {
    window.log.warn('Parsing failed');
    return null;
  }
  const ciphertext = fromBase64ToArrayBuffer(base64EncodedCiphertext);
  const ephemeralPublicKey = fromBase64ToArrayBuffer(base64EncodedEphemeralPublicKey);
  try {
    const symmetricKey = await window.libloki.crypto.deriveSymmetricKey(
      ephemeralPublicKey,
      userKeyPair.privKey
    );

    const plaintextBuffer = await window.libloki.crypto.DecryptAESGCM(symmetricKey, ciphertext);

    const token = toHex(plaintextBuffer);

    console.warn('token', token);
    return token;
  } catch (e) {
    window.log.error('Failed to decrypt token open group v2');
    return null;
  }
}

/**
 *
 */
export async function openGroupV2GetRoomInfo({
  serverUrl,
  roomId,
}: {
  roomId: string;
  serverUrl: string;
}): Promise<OpenGroupV2Info | null> {
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
      window.log.warn('getRoominfo Parsing failed');
      return null;
    }
    const info: OpenGroupV2Info = {
      id,
      name,
      imageId,
    };

    return info;
  }
  window.log.warn('getInfo failed');
  return null;
}

async function claimAuthToken(
  authToken: string,
  serverUrl: string,
  roomId: string
): Promise<string | null> {
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
  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    window.log.warn(`Could not claim token, status code: ${statusCode}`);
    return null;
  }
  return authToken;
}

export async function getAuthToken({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<string | null> {
  // first try to fetch from db a saved token.
  const roomDetails = await getV2OpenGroupRoomByRoomId({ serverUrl, roomId });
  if (!roomDetails) {
    window.log.warn('getAuthToken Room does not exist.');
    return null;
  }
  if (roomDetails?.token) {
    return roomDetails.token;
  }

  await allowOnlyOneAtATime(`getAuthTokenV2${serverUrl}:${roomId}`, async () => {
    try {
      console.warn('TRIGGERING NEW AUTH TOKEN WITH', { serverUrl, roomId });
      const token = await requestNewAuthToken({ serverUrl, roomId });
      if (!token) {
        window.log.warn('invalid new auth token', token);
        return;
      }
      const claimedToken = await claimAuthToken(token, serverUrl, roomId);
      if (!claimedToken) {
        window.log.warn('invalid claimed token', claimedToken);
      }
      // still save it to the db. just to mark it as to be refreshed later
      roomDetails.token = claimedToken || '';
      await saveV2OpenGroupRoom(roomDetails);
    } catch (e) {
      window.log.error('Failed to getAuthToken', e);
      throw e;
    }
  });

  const refreshedRoomDetails = await getV2OpenGroupRoomByRoomId({
    serverUrl,
    roomId,
  });
  if (!refreshedRoomDetails) {
    window.log.warn('getAuthToken Room does not exist.');
    return null;
  }
  if (refreshedRoomDetails?.token) {
    return refreshedRoomDetails?.token;
  }
  return null;
}

export const deleteAuthToken = async ({
  serverUrl,
  roomId,
}: OpenGroupRequestCommonType): Promise<boolean> => {
  const request: OpenGroupV2Request = {
    method: 'DELETE',
    room: roomId,
    server: serverUrl,
    isAuthRequired: false,
    endpoint: 'auth_token',
  };
  try {
    const result = await sendOpenGroupV2Request(request);
    const statusCode = parseStatusCodeFromOnionRequest(result);
    if (statusCode !== 200) {
      window.log.warn(`Could not deleteAuthToken, status code: ${statusCode}`);
      return false;
    }
    return true;
  } catch (e) {
    window.log.error('deleteAuthToken failed:', e);
    return false;
  }
};

/**
 * Send the specified message to the specified room.
 * If an error happens, this function throws it
 *
 */
export const postMessage = async (
  message: OpenGroupMessageV2,
  room: OpenGroupRequestCommonType
) => {
  const signedMessage = await message.sign();
  const json = signedMessage.toJson();

  const request: OpenGroupV2Request = {
    method: 'POST',
    room: room.roomId,
    server: room.serverUrl,
    queryParams: json,
    isAuthRequired: true,
    endpoint: 'messages',
  };
  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);

  if (statusCode !== 200) {
    throw new Error(`Could not postMessage, status code: ${statusCode}`);
  }
  const rawMessage = (result as any)?.result?.message;
  if (!rawMessage) {
    throw new Error('postMessage parsing failed');
  }
  // this will throw if the json is not valid
  return OpenGroupMessageV2.fromJson(rawMessage);
};

export const banUser = async (
  userToBan: PubKey,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const queryParams = { public_key: userToBan.key };
  const request: OpenGroupV2Request = {
    method: 'POST',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    queryParams,
    endpoint: 'block_list',
  };
  const banResult = await sendOpenGroupV2Request(request);
  const isOk = parseStatusCodeFromOnionRequest(banResult) === 200;
  console.warn('banResult', banResult);
  return isOk;
};

export const unbanUser = async (
  userToBan: PubKey,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const request: OpenGroupV2Request = {
    method: 'DELETE',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: `block_list/${userToBan.key}`,
  };
  const unbanResult = await sendOpenGroupV2Request(request);
  const isOk = parseStatusCodeFromOnionRequest(unbanResult) === 200;
  console.warn('unbanResult', unbanResult);
  return isOk;
};

export const deleteMessageByServerIds = async (
  idsToRemove: Array<number>,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const request: OpenGroupV2Request = {
    method: 'POST',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: 'delete_messages',
    queryParams: { ids: idsToRemove },
  };
  const messageDeletedResult = await sendOpenGroupV2Request(request);
  const isOk = parseStatusCodeFromOnionRequest(messageDeletedResult) === 200;
  return isOk;
};

export const getAllRoomInfos = async (roomInfos: OpenGroupV2Room) => {
  // room should not be required here
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: false,
    endpoint: 'rooms',
    serverPublicKey: roomInfos.serverPublicKey,
  };
  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);

  if (statusCode !== 200) {
    window.log.warn('getAllRoomInfos failed invalid status code');
    return;
  }

  return parseRooms(result);
};

export const getMemberCount = async (roomInfos: OpenGroupRequestCommonType): Promise<void> => {
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: 'member_count',
  };
  const result = await sendOpenGroupV2Request(request);
  if (parseStatusCodeFromOnionRequest(result) !== 200) {
    window.log.warn('getMemberCount failed invalid status code');
    return;
  }
  const count = parseMemberCount(result);
  if (count === undefined) {
    window.log.warn('getMemberCount failed invalid count');
    return;
  }

  const conversationId = getOpenGroupV2ConversationId(roomInfos.serverUrl, roomInfos.roomId);

  const convo = ConversationController.getInstance().get(conversationId);
  if (!convo) {
    window.log.warn('cannot update conversation memberCount as it does not exist');
    return;
  }
  if (convo.get('subscriberCount') !== count) {
    convo.set({ subscriberCount: count });
    // triggers the save to db and the refresh of the UI
    await convo.commit();
  }
};

/**
 * File upload and download
 */

export const downloadFileOpenGroupV2 = async (
  fileId: number,
  roomInfos: OpenGroupRequestCommonType
): Promise<Uint8Array | null> => {
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: `files/${fileId}`,
  };

  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const base64Data = (result as any)?.result?.result as string | undefined;

  if (!base64Data) {
    return null;
  }
  return new Uint8Array(fromBase64ToArrayBuffer(base64Data));
};

export const downloadFileOpenGroupV2ByUrl = async (
  pathName: string,
  roomInfos: OpenGroupRequestCommonType
): Promise<Uint8Array | null> => {
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: false,
    endpoint: pathName,
  };

  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const base64Data = (result as any)?.result?.result as string | undefined;

  if (!base64Data) {
    return null;
  }
  return new Uint8Array(fromBase64ToArrayBuffer(base64Data));
};

/**
 * Download the preview image for that opengroup room.
 * The returned value is a base64 string.
 * It can be used directly, or saved on the attachments directory if needed, but this function does not handle it
 */
export const downloadPreviewOpenGroupV2 = async (
  roomInfos: OpenGroupV2Room
): Promise<string | null> => {
  const request: OpenGroupV2Request = {
    method: 'GET',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: false,
    endpoint: `rooms/${roomInfos.roomId}/image`,
    serverPublicKey: roomInfos.serverPublicKey,
  };

  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const base64Data = (result as any)?.result?.result as string | undefined;

  if (!base64Data) {
    return null;
  }
  return base64Data;
};

/**
 * Returns the id on which the file is saved, or null
 */
export const uploadFileOpenGroupV2 = async (
  fileContent: Uint8Array,
  roomInfos: OpenGroupRequestCommonType
): Promise<{ fileId: number; fileUrl: string } | null> => {
  if (!fileContent || !fileContent.length) {
    return null;
  }
  const queryParams = {
    file: fromArrayBufferToBase64(fileContent),
  };

  const filesEndpoint = 'files';
  const request: OpenGroupV2Request = {
    method: 'POST',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: filesEndpoint,
    queryParams,
  };

  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const fileId = (result as any)?.result?.result as number | undefined;
  if (!fileId) {
    return null;
  }
  const fileUrl = getCompleteEndpointUrl(roomInfos, `${filesEndpoint}/${fileId}`, false);
  return {
    fileId: fileId,
    fileUrl,
  };
};

export const uploadImageForRoomOpenGroupV2 = async (
  fileContent: Uint8Array,
  roomInfos: OpenGroupRequestCommonType
): Promise<{ fileUrl: string } | null> => {
  if (!fileContent || !fileContent.length) {
    return null;
  }

  const queryParams = {
    file: fromArrayBufferToBase64(fileContent),
  };

  const imageEndpoint = `rooms/${roomInfos.roomId}/image`;
  const request: OpenGroupV2Request = {
    method: 'POST',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: imageEndpoint,
    queryParams,
  };

  const result = await sendOpenGroupV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }
  const fileUrl = getCompleteEndpointUrl(roomInfos, `${imageEndpoint}`, true);
  return {
    fileUrl,
  };
};

/** MODERATORS ADD/REMOVE */

export const addModerator = async (
  userToAddAsMods: PubKey,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const request: OpenGroupV2Request = {
    method: 'POST',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    queryParams: { public_key: userToAddAsMods.key },
    endpoint: 'moderators',
  };
  const addModResult = await sendOpenGroupV2Request(request);
  const isOk = parseStatusCodeFromOnionRequest(addModResult) === 200;
  console.warn('addModResult', addModResult);
  return isOk;
};

export const removeModerator = async (
  userToAddAsMods: PubKey,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const request: OpenGroupV2Request = {
    method: 'DELETE',
    room: roomInfos.roomId,
    server: roomInfos.serverUrl,
    isAuthRequired: true,
    endpoint: `moderators/${userToAddAsMods.key}`,
  };
  const removeModResult = await sendOpenGroupV2Request(request);
  const isOk = parseStatusCodeFromOnionRequest(removeModResult) === 200;
  console.warn('removeModResult', removeModResult);
  return isOk;
};
