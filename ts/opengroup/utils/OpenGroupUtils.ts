import { default as insecureNodeFetch } from 'node-fetch';
import { OpenGroupV2Room } from '../../data/opengroups';
import { sendViaOnion } from '../../session/onions/onionSend';
import { OpenGroupRequestCommonType } from '../opengroupV2/ApiUtil';

const protocolRegex = new RegExp('(https?://)?');

const dot = '\\.';
const qMark = '\\?';
const hostnameRegex = new RegExp(
  `(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])${dot})*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])`
);
const portRegex = '(:[0-9]+)?';

// roomIds allows between 2 and 64 of '0-9' or 'a-z' or '_' chars
export const roomIdV2Regex = '[0-9a-z_]{2,64}';
export const publicKeyRegex = '[0-9a-z]{64}';
export const publicKeyParam = 'public_key=';
export const openGroupV2ServerUrlRegex = new RegExp(
  `${protocolRegex.source}${hostnameRegex.source}${portRegex}`
);

export const openGroupV2CompleteURLRegex = new RegExp(
  `^${openGroupV2ServerUrlRegex.source}\/${roomIdV2Regex}${qMark}${publicKeyParam}${publicKeyRegex}$`,
  'gm'
);

/**
 * Just a constant to have less `publicChat:` everywhere.
 * This is the prefix used to identify our open groups in the conversation database (v1 or v2)
 * Note: It does already have the ':' included
 */
export const openGroupPrefix = 'publicChat:';

/**
 * Just a regex to match a public chat (i.e. a string starting with publicChat:)
 */
export const openGroupPrefixRegex = new RegExp(`^${openGroupPrefix}`);

/**
 * An open group v1 conversation id can only have the char '1' as roomId
 */
export const openGroupV1ConversationIdRegex = new RegExp(
  `${openGroupPrefix}1@${protocolRegex.source}${hostnameRegex.source}`
);

export const openGroupV2ConversationIdRegex = new RegExp(
  `${openGroupPrefix}${roomIdV2Regex}@${protocolRegex.source}${hostnameRegex.source}${portRegex}`
);

/**
 * This function returns a full url on an open group v2 room used for sync messages for instance.
 * This is basically what the QRcode encodes
 *
 */
export function getCompleteUrlFromRoom(roomInfos: OpenGroupV2Room) {
  // serverUrl has the port and protocol already
  return `${roomInfos.serverUrl}/${roomInfos.roomId}?${publicKeyParam}${roomInfos.serverPublicKey}`;
}

/**
 * This function returns a base url to this room
 * This is basically used for building url after posting an attachment
 * hasRoomInEndpoint = true means the roomId is already in the endpoint.
 * so we don't add the room after the serverUrl.
 *
 */
export function getCompleteEndpointUrl(
  roomInfos: OpenGroupRequestCommonType,
  endpoint: string,
  hasRoomInEndpoint: boolean
) {
  // serverUrl has the port and protocol already
  if (!hasRoomInEndpoint) {
    return `${roomInfos.serverUrl}/${roomInfos.roomId}/${endpoint}`;
  }
  // not room based, the endpoint already has the room in it
  return `${roomInfos.serverUrl}/${endpoint}`;
}

/**
 * Tries to establish a connection with the specified open group url.
 *
 * This will try to do an onion routing call if the `useFileOnionRequests` feature flag is set,
 * or call directly insecureNodeFetch if it's not.
 *
 * Returns
 *  * true if useFileOnionRequests is false and no exception where thrown by insecureNodeFetch
 *  * true if useFileOnionRequests is true and we established a connection to the server with onion routing
 *  * false otherwise
 *
 */
export const validOpenGroupServer = async (serverUrl: string) => {
  // test to make sure it's online (and maybe has a valid SSL cert)
  try {
    const url = new URL(serverUrl);

    if (!window.lokiFeatureFlags.useFileOnionRequests) {
      // we are not running with onion request
      // this is an insecure insecureNodeFetch. It will expose the user ip to the serverUrl (not onion routed)
      window.log.info(`insecureNodeFetch => plaintext for ${url.toString()}`);

      // we probably have to check the response here
      await insecureNodeFetch(serverUrl);
      return true;
    }
    // This MUST be an onion routing call, no nodeFetch calls below here.

    /**
     * this is safe (as long as node's in your trust model)
     *
     * First, we need to fetch the open group public key of this open group.
     * The fileserver have all the open groups public keys.
     * We need the open group public key because for onion routing we will need to encode
     * our request with it.
     * We can just ask the file-server to get the one for the open group we are trying to add.
     */

    const result = await window.tokenlessFileServerAdnAPI.serverRequest(
      `loki/v1/getOpenGroupKey/${url.hostname}`
    );

    if (result.response.meta.code === 200) {
      // we got the public key of the server we are trying to add.
      // decode it.
      const obj = JSON.parse(result.response.data);
      const pubKey = window.dcodeIO.ByteBuffer.wrap(obj.data, 'base64').toArrayBuffer();
      // verify we can make an onion routed call to that open group with the decoded public key
      // get around the FILESERVER_HOSTS filter by not using serverRequest
      const res = await sendViaOnion(pubKey, url, { method: 'GET' }, { noJson: true });
      if (res && res.result && res.result.status === 200) {
        window.log.info(
          `loki_public_chat::validOpenGroupServer - onion routing enabled on ${url.toString()}`
        );
        // save pubkey for use...
        window.lokiPublicChatAPI.openGroupPubKeys[serverUrl] = pubKey;
        return true;
      }
      // return here, just so we are sure adding some code below won't do a nodeFetch fallback
      return false;
    } else if (result.response.meta.code !== 404) {
      // unknown error code
      window.log.warn(
        'loki_public_chat::validOpenGroupServer - unknown error code',
        result.response.meta
      );
    }
    return false;
  } catch (e) {
    window.log.warn(
      `loki_public_chat::validOpenGroupServer - failing to create ${serverUrl}`,
      e.code,
      e.message
    );
    // bail out if not valid enough
  }
  return false;
};

/**
 * Prefix server with https:// if it's not already prefixed with http or https.
 */
export function prefixify(server: string, hasSSL: boolean = true): string {
  const hasPrefix = server.match('^https?://');
  if (hasPrefix) {
    return server;
  }

  return `http${hasSSL ? 's' : ''}://${server}`;
}

/**
 * No sql access. Just how our open groupv2 url looks like.
 * ServerUrl can have the protocol and port included, or not
 * @returns `${openGroupPrefix}${roomId}@${serverUrl}`
 */
export function getOpenGroupV2ConversationId(serverUrl: string, roomId: string) {
  if (!roomId.match(roomIdV2Regex)) {
    throw new Error('getOpenGroupV2ConversationId: Invalid roomId');
  }
  if (!serverUrl.match(openGroupV2ServerUrlRegex)) {
    throw new Error('getOpenGroupV2ConversationId: Invalid serverUrl');
  }
  return `${openGroupPrefix}${roomId}@${serverUrl}`;
}

/**
 * No sql access. Just plain string logic
 */
export function getOpenGroupV2FromConversationId(
  conversationId: string
): OpenGroupRequestCommonType {
  if (isOpenGroupV2(conversationId)) {
    const atIndex = conversationId.indexOf('@');
    const roomId = conversationId.slice(openGroupPrefix.length, atIndex);
    const serverUrl = conversationId.slice(atIndex + 1);
    return {
      serverUrl,
      roomId,
    };
  }
  throw new Error('Not a v2 open group convo id');
}

/**
 * Check if this conversation id corresponds to an OpenGroupV1 conversation.
 * No access to database are made. Only regex matches
 * @param conversationId the convo id to evaluate
 * @returns true if this conversation id matches the Opengroupv1 conversation id regex
 */
export function isOpenGroupV1(conversationId: string) {
  return openGroupV1ConversationIdRegex.test(conversationId);
}

/**
 * Check if this conversation id corresponds to an OpenGroupV2 conversation.
 * No access to database are made. Only regex matches
 * @param conversationId the convo id to evaluate
 * @returns true if this conversation id matches the Opengroupv2 conversation id regex
 */
export function isOpenGroupV2(conversationId: string) {
  if (openGroupV1ConversationIdRegex.test(conversationId)) {
    // this is an open group v1
    return false;
  }

  return openGroupV2ConversationIdRegex.test(conversationId);
}
