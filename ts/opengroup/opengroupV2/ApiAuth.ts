import { getV2OpenGroupRoomByRoomId, saveV2OpenGroupRoom } from '../../data/opengroups';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import { fromBase64ToArrayBuffer, toHex } from '../../session/utils/String';
import { getIdentityKeyPair, getOurPubKeyStrFromCache } from '../../session/utils/User';
import { OpenGroupRequestCommonType, OpenGroupV2Request } from './ApiUtil';
import { sendApiV2Request } from './OpenGroupAPIV2';
import { parseStatusCodeFromOnionRequest } from './OpenGroupAPIV2Parser';

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
  const result = await sendApiV2Request(request);
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
      window.log.info('TRIGGERING NEW AUTH TOKEN WITH', { serverUrl, roomId });
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
    const result = await sendApiV2Request(request);
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
  const json = (await sendApiV2Request(request)) as any;
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

    return token;
  } catch (e) {
    window.log.error('Failed to decrypt token open group v2');
    return null;
  }
}
