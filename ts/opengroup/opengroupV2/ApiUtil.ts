import _ from 'underscore';
import { PubKey } from '../../session/types';
import { fromBase64ToArrayBuffer, fromHex } from '../../session/utils/String';
import { OpenGroupMessageV2 } from './OpenGroupMessageV2';

export const defaultServer = 'https://sessionopengroup.com';
export const defaultServerPublicKey =
  '658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231b';

export type OpenGroupRequestCommonType = {
  serverUrl: string;
  roomId: string;
};

export type OpenGroupV2Request = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  room: string;
  server: string;
  endpoint: string;
  // queryParams are used for post or get, but not the same way
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
  isAuthRequired: boolean;
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

/**
 * Try to build an full url and check it for validity.
 * @returns null if the check failed. the built URL otherwise
 */
export const buildUrl = (request: OpenGroupV2Request): URL | null => {
  let rawURL = `${request.server}/${request.endpoint}`;
  if (request.method === 'GET') {
    const entries = Object.entries(request.queryParams || {});

    if (entries.length) {
      const queryString = entries.map(([key, value]) => `${key}=${value}`).join('&');
      rawURL += `?${queryString}`;
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
export const cachedModerators: Map<string, Map<string, Set<string>>> = new Map();

export const setCachedModerators = (
  serverUrl: string,
  roomId: string,
  newModerators: Array<string>
) => {
  let allRoomsMods = cachedModerators.get(serverUrl);
  if (!allRoomsMods) {
    cachedModerators.set(serverUrl, new Map());
    allRoomsMods = cachedModerators.get(serverUrl);
  }
  // tslint:disable: no-non-null-assertion
  if (!allRoomsMods!.get(roomId)) {
    allRoomsMods!.set(roomId, new Set());
  }
  newModerators.forEach(m => {
    allRoomsMods!.get(roomId)?.add(m);
  });
};

export const parseMessages = async (
  rawMessages: Array<Record<string, any>>
): Promise<Array<OpenGroupMessageV2>> => {
  if (!rawMessages) {
    window.log.info('no new messages');
    return [];
  }
  const messages = await Promise.all(
    rawMessages.map(async r => {
      try {
        const opengroupMessage = OpenGroupMessageV2.fromJson(r);
        if (
          !opengroupMessage?.serverId ||
          !opengroupMessage.sentTimestamp ||
          !opengroupMessage.base64EncodedData ||
          !opengroupMessage.base64EncodedSignature
        ) {
          window.log.warn('invalid open group message received');
          return null;
        }
        // Validate the message signature
        const senderPubKey = PubKey.cast(opengroupMessage.sender).withoutPrefix();
        const signature = fromBase64ToArrayBuffer(opengroupMessage.base64EncodedSignature);
        const messageData = fromBase64ToArrayBuffer(opengroupMessage.base64EncodedData);
        // throws if signature failed
        await window.libsignal.Curve.async.verifySignature(
          fromHex(senderPubKey),
          messageData,
          signature
        );
        return opengroupMessage;
      } catch (e) {
        window.log.error('An error happened while fetching getMessages output:', e);
        return null;
      }
    })
  );
  return _.compact(messages);
};
