import { default as insecureNodeFetch } from 'node-fetch';
import https from 'https';

import { Snode } from './snodePool';
import ByteBuffer from 'bytebuffer';
import { StringUtils } from '../utils';
import { OnionPaths } from '../onions';

export enum RequestError {
  BAD_PATH = 'BAD_PATH',
  OTHER = 'OTHER',
  ABORTED = 'ABORTED',
}

/**
 * When sending a request over onion, we might get two status.
 * The first one, on the request itself, the other one in the json returned.
 *
 * If the request failed to reach the one of the node of the onion path, the one on the request is set.
 * But if the request reaches the destination node and it fails to process the request (bad node for this pubkey), you will get a 200 on the request itself, but the json you get will contain the real status.
 */
export interface SnodeResponse {
  body: string;
  status: number;
}

// Returns the actual ciphertext, symmetric key that will be used
// for decryption, and an ephemeral_key to send to the next hop
async function encryptForPubKey(
  pubKeyX25519hex: string,
  reqObj: any
): Promise<DestinationContext> {
  const reqStr = JSON.stringify(reqObj);

  const textEncoder = new TextEncoder();
  const plaintext = textEncoder.encode(reqStr);

  return window.libloki.crypto.encryptForPubkey(pubKeyX25519hex, plaintext);
}

// `ctx` holds info used by `node` to relay further
async function encryptForRelay(
  relayX25519hex: string,
  destination: any,
  ctx: any
) {
  const { log, StringView } = window;

  // ctx contains: ciphertext, symmetricKey, ephemeralKey
  const payload = ctx.ciphertext;

  if (!destination.host && !destination.destination) {
    log.warn('loki_rpc::encryptForRelay - no destination', destination);
  }

  const reqObj = {
    ...destination,
    ciphertext: ByteBuffer.wrap(payload).toString('base64'),
    ephemeral_key: StringView.arrayBufferToHex(ctx.ephemeralKey),
  };

  return encryptForPubKey(relayX25519hex, reqObj);
}

// `ctx` holds info used by `node` to relay further
async function encryptForRelayV2(
  relayX25519hex: string,
  destination: any,
  ctx: any
) {
  const { log, StringView } = window;

  if (!destination.host && !destination.destination) {
    log.warn('loki_rpc::encryptForRelay - no destination', destination);
  }

  const reqObj = {
    ...destination,
    ephemeral_key: StringView.arrayBufferToHex(ctx.ephemeralKey),
  };

  const plaintext = encodeCiphertextPlusJson(ctx.ciphertext, reqObj);

  return window.libloki.crypto.encryptForPubkey(relayX25519hex, plaintext);
}

function makeGuardPayload(guardCtx: any): Uint8Array {
  const ciphertextBase64 = StringUtils.decode(guardCtx.ciphertext, 'base64');

  const payloadObj = {
    ciphertext: ciphertextBase64,
    ephemeral_key: StringUtils.decode(guardCtx.ephemeralKey, 'hex'),
  };

  const payloadStr = JSON.stringify(payloadObj);

  const buffer = ByteBuffer.wrap(payloadStr, 'utf8');

  return buffer.buffer;
}

/// Encode ciphertext as (len || binary) and append payloadJson as utf8
function encodeCiphertextPlusJson(
  ciphertext: any,
  payloadJson: any
): Uint8Array {
  const payloadStr = JSON.stringify(payloadJson);

  const bufferJson = ByteBuffer.wrap(payloadStr, 'utf8');

  const len = ciphertext.length as number;
  const arrayLen = bufferJson.buffer.length + 4 + len;
  const littleEndian = true;
  const buffer = new ByteBuffer(arrayLen, littleEndian);

  buffer.writeInt32(len);
  buffer.append(ciphertext);
  buffer.append(bufferJson);

  return new Uint8Array(buffer.buffer);
}

// New "semi-binary" encoding
function makeGuardPayloadV2(guardCtx: any): Uint8Array {
  const guardPayloadObj = {
    ephemeral_key: StringUtils.decode(guardCtx.ephemeralKey, 'hex'),
  };

  return encodeCiphertextPlusJson(guardCtx.ciphertext, guardPayloadObj);
}

async function buildOnionCtxs(
  nodePath: Array<Snode>,
  destCtx: DestinationContext,
  targetED25519Hex: string,
  // whether to use the new "semi-binary" protocol
  useV2: boolean,
  finalRelayOptions?: FinalRelayOptions,
  id = ''
) {
  const { log } = window;

  const ctxes = [destCtx];
  // from (3) 2 to 0
  const firstPos = nodePath.length - 1;

  for (let i = firstPos; i > -1; i -= 1) {
    let dest: {
      host?: string;
      protocol?: string;
      port?: string;
      destination?: string;
      method?: string;
      target?: string;
    };
    const relayingToFinalDestination = i === firstPos; // if last position

    if (relayingToFinalDestination && finalRelayOptions) {
      let target = useV2 ? '/loki/v2/lsrpc' : '/loki/v1/lsrpc';

      const isCallToPn = finalRelayOptions?.host === 'live.apns.getsession.org';
      if (!isCallToPn && window.lokiFeatureFlags.useFileOnionRequestsV2) {
        target = '/loki/v3/lsrpc';
      }

      dest = {
        host: finalRelayOptions.host,
        target,
        method: 'POST',
      };
      // FIXME http open groups v2 are not working
      // tslint:disable-next-line: no-http-string
      // if (finalRelayOptions?.protocol === 'http:') {
      //   dest.protocol = 'http';
      //   dest.port = '80';
      // }
    } else {
      // set x25519 if destination snode
      let pubkeyHex = targetED25519Hex; // relayingToFinalDestination
      // or ed25519 snode destination
      if (!relayingToFinalDestination) {
        pubkeyHex = nodePath[i + 1].pubkey_ed25519;
        if (!pubkeyHex) {
          log.error(
            `loki_rpc:::makeOnionRequest ${id} - no ed25519 for`,
            nodePath[i + 1],
            'path node',
            i + 1
          );
        }
      }
      // destination takes a hex key
      dest = {
        destination: pubkeyHex,
      };
    }
    try {
      const encryptFn = useV2 ? encryptForRelayV2 : encryptForRelay;
      // eslint-disable-next-line no-await-in-loop
      const ctx = await encryptFn(
        nodePath[i].pubkey_x25519,
        dest,
        ctxes[ctxes.length - 1]
      );
      ctxes.push(ctx);
    } catch (e) {
      log.error(
        `loki_rpc:::makeOnionRequest ${id} - encryptForRelay failure`,
        e.code,
        e.message
      );
      throw e;
    }
  }

  return ctxes;
}

// we just need the targetNode.pubkey_ed25519 for the encryption
// targetPubKey is ed25519 if snode is the target
async function makeOnionRequest(
  nodePath: Array<Snode>,
  destCtx: DestinationContext,
  targetED25519Hex: string,
  // whether to use the new (v2) protocol
  useV2: boolean,
  finalRelayOptions?: FinalRelayOptions,
  id = ''
) {
  const ctxes = await buildOnionCtxs(
    nodePath,
    destCtx,
    targetED25519Hex,
    useV2,
    finalRelayOptions,
    id
  );

  const guardCtx = ctxes[ctxes.length - 1]; // last ctx

  const payload = useV2
    ? makeGuardPayloadV2(guardCtx)
    : makeGuardPayload(guardCtx);

  // all these requests should use AesGcm
  return payload;
}

// Process a response as it arrives from `fetch`, handling
// http errors and attempting to decrypt the body with `sharedKey`
// May return false BAD_PATH, indicating that we should try a new path.
const processOnionResponse = async (
  reqIdx: number,
  response: any,
  sharedKey: ArrayBuffer,
  debug: boolean,
  abortSignal?: AbortSignal
): Promise<SnodeResponse | RequestError> => {
  const { log, libloki, dcodeIO, StringView } = window;

  if (abortSignal?.aborted) {
    log.warn(`(${reqIdx}) [path] Call aborted`);
    return RequestError.ABORTED;
  }

  // FIXME: 401/500 handling?

  // detect SNode is not ready (not in swarm; not done syncing)
  if (response.status === 503) {
    log.warn(`(${reqIdx}) [path] Got 503: snode not ready`);

    return RequestError.BAD_PATH;
  }

  if (response.status === 504) {
    log.warn(`(${reqIdx}) [path] Got 504: Gateway timeout`);
    return RequestError.BAD_PATH;
  }

  if (response.status === 404) {
    // Why would we get this error on testnet?
    log.warn(`(${reqIdx}) [path] Got 404: Gateway timeout`);
    return RequestError.BAD_PATH;
  }

  if (response.status !== 200) {
    const rsp = await response.text();
    log.warn(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - fetch unhandled error code: ${response.status}: ${rsp}`
    );
    return RequestError.OTHER;
  }

  let ciphertext = await response.text();
  if (!ciphertext) {
    log.warn(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - Target node return empty ciphertext`
    );
    return RequestError.OTHER;
  }
  if (debug) {
    log.debug(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - ciphertext`,
      ciphertext
    );
  }

  let plaintext;
  let ciphertextBuffer;

  try {
    const jsonRes = JSON.parse(ciphertext);
    ciphertext = jsonRes.result;
  } catch (e) {
    // just try to get a json object from what is inside (for PN requests), if it fails, continue ()
  }
  try {
    ciphertextBuffer = dcodeIO.ByteBuffer.wrap(
      ciphertext,
      'base64'
    ).toArrayBuffer();

    if (debug) {
      log.debug(
        `(${reqIdx}) [path] lokiRpc::processOnionResponse - ciphertextBuffer`,
        StringView.arrayBufferToHex(ciphertextBuffer)
      );
    }

    const plaintextBuffer = await libloki.crypto.DecryptAESGCM(
      sharedKey,
      ciphertextBuffer
    );
    if (debug) {
      log.debug(
        'lokiRpc::processOnionResponse - plaintextBuffer',
        plaintextBuffer.toString()
      );
    }

    plaintext = new TextDecoder().decode(plaintextBuffer);
  } catch (e) {
    log.error(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - decode error`,
      e
    );
    log.error(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - symKey`,
      StringView.arrayBufferToHex(sharedKey)
    );
    if (ciphertextBuffer) {
      log.error(
        `(${reqIdx}) [path] lokiRpc::processOnionResponse - ciphertextBuffer`,
        StringView.arrayBufferToHex(ciphertextBuffer)
      );
    }
    return RequestError.OTHER;
  }

  if (debug) {
    log.debug('lokiRpc::processOnionResponse - plaintext', plaintext);
  }

  try {
    const jsonRes: SnodeResponse = JSON.parse(plaintext);
    return jsonRes;
  } catch (e) {
    log.error(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - parse error outer json`,
      e.code,
      e.message,
      'json:',
      plaintext
    );
    return RequestError.OTHER;
  }
};

export const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export type FinalRelayOptions = {
  host: string;
  // FIXME http open groups v2 are not working
  // protocol?: string; // default to https
  // port?: string; // default to 443
};

export type DestinationContext = {
  ciphertext: Uint8Array;
  symmetricKey: ArrayBuffer;
  ephemeralKey: ArrayBuffer;
};

export type FinalDestinationOptions = {
  destination_ed25519_hex?: string;
  headers?: Record<string, string>;
  body?: string;
};

/**
 *
 * Onion request looks like this
 * Sender -> 1 -> 2 -> 3 -> Receiver
 * 1, 2, 3 = onion Snodes
 *
 *
 * @param nodePath the onion path to use to send the request
 * @param finalDestOptions those are the options for the request from 3 to R. It contains for instance the payload and headers.
 * @param finalRelayOptions  those are the options 3 will use to make a request to R. It contains for instance the host to make the request to
 */
const sendOnionRequest = async (
  reqIdx: number,
  nodePath: Array<Snode>,
  destX25519Any: string,
  finalDestOptions: {
    destination_ed25519_hex?: string;
    headers?: Record<string, string>;
    body?: string;
  },
  finalRelayOptions?: FinalRelayOptions,
  lsrpcIdx?: any,
  abortSignal?: AbortSignal
): Promise<SnodeResponse | RequestError> => {
  const { log, StringView } = window;

  let id = '';
  if (lsrpcIdx !== undefined) {
    id += `${lsrpcIdx}=>`;
  }
  if (reqIdx !== undefined) {
    id += `${reqIdx}`;
  }

  // get destination pubkey in array buffer format
  let destX25519hex = destX25519Any;
  if (typeof destX25519hex !== 'string') {
    // convert AB to hex
    destX25519hex = StringView.arrayBufferToHex(destX25519Any as any);
  }

  // safely build destination
  let targetEd25519hex;

  if (finalDestOptions.destination_ed25519_hex) {
    // snode destination
    targetEd25519hex = finalDestOptions.destination_ed25519_hex;
    // eslint-disable-next-line no-param-reassign
    delete finalDestOptions.destination_ed25519_hex;
  }

  const options = finalDestOptions; // lint
  // do we need this?
  if (options.headers === undefined) {
    options.headers = {};
  }

  const useV2 = window.lokiFeatureFlags.useOnionRequestsV2;

  const isLsrpc = !!finalRelayOptions;

  let destCtx: DestinationContext;
  try {
    if (useV2 && !isLsrpc) {
      const body = options.body || '';
      delete options.body;

      const textEncoder = new TextEncoder();
      const bodyEncoded = textEncoder.encode(body);

      const plaintext = encodeCiphertextPlusJson(bodyEncoded, options);
      destCtx = await window.libloki.crypto.encryptForPubkey(
        destX25519hex,
        plaintext
      );
    } else {
      destCtx = await encryptForPubKey(destX25519hex, options);
    }
  } catch (e) {
    log.error(
      `loki_rpc::sendOnionRequest ${id} - encryptForPubKey failure [`,
      e.code,
      e.message,
      '] destination X25519',
      destX25519hex.substr(0, 32),
      '...',
      destX25519hex.substr(32),
      'options',
      options
    );
    throw e;
  }

  const payload = await makeOnionRequest(
    nodePath,
    destCtx,
    targetEd25519hex as string, // FIXME
    useV2,
    finalRelayOptions,
    id
  );

  const guardFetchOptions = {
    method: 'POST',
    body: payload,
    // we are talking to a snode...
    agent: snodeHttpsAgent,
    abortSignal,
  };

  const target = useV2 ? '/onion_req/v2' : '/onion_req';

  const guardUrl = `https://${nodePath[0].ip}:${nodePath[0].port}${target}`;
  // no logs for that one as we do need to call insecureNodeFetch to our guardNode
  // window.log.info('insecureNodeFetch => plaintext for sendOnionRequest');

  const response = await insecureNodeFetch(guardUrl, guardFetchOptions);

  return processOnionResponse(
    reqIdx,
    response,
    destCtx.symmetricKey,
    false,
    abortSignal
  );
};

async function sendOnionRequestSnodeDest(
  reqIdx: any,
  nodePath: Array<Snode>,
  targetNode: Snode,
  plaintext: any
) {
  return sendOnionRequest(
    reqIdx,
    nodePath,
    targetNode.pubkey_x25519,
    {
      destination_ed25519_hex: targetNode.pubkey_ed25519,
      body: plaintext,
    },
    undefined,
    undefined
  );
}

// need relay node's pubkey_x25519_hex
// always the same target: /loki/v1/lsrpc
export async function sendOnionRequestLsrpcDest(
  reqIdx: number,
  nodePath: Array<Snode>,
  destX25519Any: string,
  finalRelayOptions: FinalRelayOptions,
  payloadObj: FinalDestinationOptions,
  lsrpcIdx: number,
  abortSignal?: AbortSignal
): Promise<SnodeResponse | RequestError> {
  return sendOnionRequest(
    reqIdx,
    nodePath,
    destX25519Any,
    payloadObj,
    finalRelayOptions,
    lsrpcIdx,
    abortSignal
  );
}

function getPathString(pathObjArr: Array<any>): string {
  return pathObjArr.map(node => `${node.ip}:${node.port}`).join(', ');
}

export async function lokiOnionFetch(
  body: any,
  targetNode: Snode
): Promise<SnodeResponse | boolean> {
  const { log } = window;

  // Loop until the result is not BAD_PATH
  // tslint:disable-next-line no-constant-condition
  while (true) {
    // Get a path excluding `targetNode`:
    // eslint-disable-next-line no-await-in-loop
    const path = await OnionPaths.getInstance().getOnionPath(targetNode);
    const thisIdx = OnionPaths.getInstance().assignOnionRequestNumber();

    // At this point I only care about BAD_PATH

    // eslint-disable-next-line no-await-in-loop
    const result = await sendOnionRequestSnodeDest(
      thisIdx,
      path,
      targetNode,
      body
    );

    if (result === RequestError.BAD_PATH) {
      log.error(
        `[path] Error on the path: ${getPathString(path)} to ${targetNode.ip}:${
          targetNode.port
        }`
      );
      OnionPaths.getInstance().markPathAsBad(path);
      return false;
    } else if (result === RequestError.OTHER) {
      // could mean, fail to parse results
      // or status code wasn't 200
      // or can't decrypt
      // it's not a bad_path, so we don't need to mark the path as bad
      log.error(
        `[path] sendOnionRequest gave false for path: ${getPathString(
          path
        )} to ${targetNode.ip}:${targetNode.port}`
      );
      return false;
    } else if (result === RequestError.ABORTED) {
      // could mean, fail to parse results
      // or status code wasn't 200
      // or can't decrypt
      // it's not a bad_path, so we don't need to mark the path as bad
      log.error(
        `[path] sendOnionRequest gave aborted for path: ${getPathString(
          path
        )} to ${targetNode.ip}:${targetNode.port}`
      );
      return false;
    } else {
      return result;
    }
  }
}
