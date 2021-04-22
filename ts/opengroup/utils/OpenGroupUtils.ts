import { default as insecureNodeFetch } from 'node-fetch';
import { sendViaOnion } from '../../session/onions/onionSend';

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
 * No sql access. Just how our open groupv2 url looks like
 * @returns `publicChat:${roomId}@${serverUrl}`
 */
export function getOpenGroupV2ConversationId(serverUrl: string, roomId: string) {
  if (roomId.length < 2) {
    throw new Error('Invalid roomId: too short');
  }
  return `publicChat:${roomId}@${serverUrl}`;
}
