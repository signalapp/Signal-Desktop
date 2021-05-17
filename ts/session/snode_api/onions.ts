import { default as insecureNodeFetch, Response } from 'node-fetch';
import https from 'https';

import {
  dropSnodeFromSnodePool,
  dropSnodeFromSwarmIfNeeded,
  Snode,
  updateSwarmFor,
} from './snodePool';
import ByteBuffer from 'bytebuffer';
import { OnionPaths } from '../onions';
import { fromBase64ToArrayBuffer, toHex } from '../utils/String';

export enum RequestError {
  BAD_PATH = 'BAD_PATH',
  OTHER = 'OTHER',
  ABORTED = 'ABORTED',
}

// hold the ed25519 key of a snode against the time it fails. Used to remove a snode only after a few failures (snodeFailureThreshold failures)
const snodeFailureCount: Record<string, number> = {};

// The number of times a snode can fail before it's replaced.
const snodeFailureThreshold = 3;
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
async function encryptForPubKey(pubKeyX25519hex: string, reqObj: any): Promise<DestinationContext> {
  const reqStr = JSON.stringify(reqObj);

  const textEncoder = new TextEncoder();
  const plaintext = textEncoder.encode(reqStr);

  return window.libloki.crypto.encryptForPubkey(pubKeyX25519hex, plaintext);
}

export type DestinationRelayV2 = {
  host?: string;
  protocol?: string;
  port?: number;
  destination?: string;
  method?: string;
  target?: string;
};

// `ctx` holds info used by `node` to relay further
async function encryptForRelayV2(
  relayX25519hex: string,
  destination: DestinationRelayV2,
  ctx: DestinationContext
) {
  const { log } = window;

  if (!destination.host && !destination.destination) {
    log.warn('loki_rpc::encryptForRelayV2 - no destination', destination);
  }

  const reqObj = {
    ...destination,
    ephemeral_key: toHex(ctx.ephemeralKey),
  };

  const plaintext = encodeCiphertextPlusJson(ctx.ciphertext, reqObj);

  return window.libloki.crypto.encryptForPubkey(relayX25519hex, plaintext);
}

/// Encode ciphertext as (len || binary) and append payloadJson as utf8
function encodeCiphertextPlusJson(
  ciphertext: Uint8Array,
  payloadJson: Record<string, any>
): Uint8Array {
  const payloadStr = JSON.stringify(payloadJson);

  const bufferJson = ByteBuffer.wrap(payloadStr, 'utf8');

  const len = ciphertext.length;
  const arrayLen = bufferJson.buffer.length + 4 + len;
  const littleEndian = true;
  const buffer = new ByteBuffer(arrayLen, littleEndian);

  buffer.writeInt32(len);
  buffer.append(ciphertext);
  buffer.append(bufferJson);

  return new Uint8Array(buffer.buffer);
}

async function buildOnionCtxs(
  nodePath: Array<Snode>,
  destCtx: DestinationContext,
  targetED25519Hex?: string,
  finalRelayOptions?: FinalRelayOptions,
  id = ''
) {
  const { log } = window;

  const ctxes = [destCtx];
  // from (3) 2 to 0
  const firstPos = nodePath.length - 1;

  for (let i = firstPos; i > -1; i -= 1) {
    let dest: DestinationRelayV2;
    const relayingToFinalDestination = i === firstPos; // if last position

    if (relayingToFinalDestination && finalRelayOptions) {
      let target = '/loki/v2/lsrpc';

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
      if (finalRelayOptions?.protocol === 'http') {
        dest.protocol = finalRelayOptions.protocol;
        dest.port = finalRelayOptions.port || 80;
      }
    } else {
      // set x25519 if destination snode
      let pubkeyHex = targetED25519Hex; // relayingToFinalDestination
      // or ed25519 snode destination
      if (!relayingToFinalDestination) {
        pubkeyHex = nodePath[i + 1].pubkey_ed25519;
        if (!pubkeyHex) {
          log.error(
            `loki_rpc:::buildOnionGuardNodePayload ${id} - no ed25519 for`,
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
      // eslint-disable-next-line no-await-in-loop
      const ctx = await encryptForRelayV2(nodePath[i].pubkey_x25519, dest, ctxes[ctxes.length - 1]);
      ctxes.push(ctx);
    } catch (e) {
      log.error(
        `loki_rpc:::buildOnionGuardNodePayload ${id} - encryptForRelayV2 failure`,
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
async function buildOnionGuardNodePayload(
  nodePath: Array<Snode>,
  destCtx: DestinationContext,
  targetED25519Hex?: string,
  finalRelayOptions?: FinalRelayOptions,
  id = ''
) {
  const ctxes = await buildOnionCtxs(nodePath, destCtx, targetED25519Hex, finalRelayOptions, id);

  // this is the OUTER side of the onion, the one encoded with multiple layer
  // So the one we will send to the first guard node.
  const guardCtx = ctxes[ctxes.length - 1]; // last ctx

  // New "semi-binary" encoding

  const guardPayloadObj = {
    ephemeral_key: toHex(guardCtx.ephemeralKey),
  };

  return encodeCiphertextPlusJson(guardCtx.ciphertext, guardPayloadObj);
}

// Process a response as it arrives from `fetch`, handling
// http errors and attempting to decrypt the body with `sharedKey`
// May return false BAD_PATH, indicating that we should try a new path.
async function processOnionResponse(
  reqIdx: number,
  response: Response,
  symmetricKey: ArrayBuffer,
  debug: boolean,
  abortSignal?: AbortSignal
): Promise<
  | SnodeResponse
  | { requestError: RequestError; nodeInFault?: string; statusCode?: number; body?: string }
> {
  let ciphertext = '';

  try {
    ciphertext = await response.text();
  } catch (e) {
    window.log.warn(e);
  }

  if (abortSignal?.aborted) {
    window.log.warn(`(${reqIdx}) [path] Call aborted`);
    return { requestError: RequestError.ABORTED };
  }
  console.warn('clocko ut of sync todo');

  if (response.status === 406) {
    // clock out of sync
    console.warn('clocko ut of sync todo');
  }

  if (response.status === 421) {
    // clock out of sync
    window.log.info('Invalidating swarm');
  }

  // detect SNode is deregisted, or SNode is not ready (not in swarm; not done syncing, ...)
  if (
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504 ||
    response.status === 404 ||
    response.status !== 200 // this is pretty strong. a 400 (Oxen server error) will be handled as a bad path.
  ) {
    window.log.warn(`(${reqIdx}) [path] Got status: ${response.status}`);
    const prefix = 'Next node not found: ';
    let nodeNotFound;
    if (ciphertext && ciphertext.startsWith(prefix)) {
      nodeNotFound = ciphertext.substr(prefix.length);
      console.warn('nodeNotFound', nodeNotFound);
    }

    return {
      requestError: RequestError.BAD_PATH,
      nodeInFault: nodeNotFound,
      statusCode: response.status,
      body: ciphertext,
    };
  }

  if (!ciphertext) {
    window.log.warn(
      `(${reqIdx}) [path] lokiRpc::processingOnionResponse - Target node return empty ciphertext`
    );
    return { requestError: RequestError.OTHER };
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
    ciphertextBuffer = fromBase64ToArrayBuffer(ciphertext);
    const plaintextBuffer = await window.libloki.crypto.DecryptAESGCM(
      symmetricKey,
      ciphertextBuffer
    );
    plaintext = new TextDecoder().decode(plaintextBuffer);
  } catch (e) {
    window.log.error(`(${reqIdx}) [path] lokiRpc::processingOnionResponse - decode error`, e);
    window.log.error(
      `(${reqIdx}) [path] lokiRpc::processingOnionResponse - symmetricKey`,
      toHex(symmetricKey)
    );
    if (ciphertextBuffer) {
      window.log.error(
        `(${reqIdx}) [path] lokiRpc::processingOnionResponse - ciphertextBuffer`,
        toHex(ciphertextBuffer)
      );
    }
    return { requestError: RequestError.OTHER };
  }

  if (debug) {
    window.log.debug('lokiRpc::processingOnionResponse - plaintext', plaintext);
  }

  try {
    const jsonRes: SnodeResponse = JSON.parse(plaintext, (key, value) => {
      if (typeof value === 'number' && value > Number.MAX_SAFE_INTEGER) {
        window.log.warn('Received an out of bounds js number');
      }
      return value;
    });

    return jsonRes;
  } catch (e) {
    window.log.error(
      `(${reqIdx}) [path] lokiRpc::processingOnionResponse - parse error outer json ${e.code} ${e.message} json: '${plaintext}'`
    );
    return { requestError: RequestError.OTHER };
  }
}

export const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export type FinalRelayOptions = {
  host: string;
  protocol?: 'http' | 'https'; // default to https
  port?: number; // default to 443
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

function isSnodeResponse(arg: any): arg is SnodeResponse {
  return arg.status !== undefined;
}

/**
 * Handle a 421. The body is supposed to be the new swarm nodes for this publickey.
 * @param snodeEd25519 the snode gaving the reply
 * @param body the new swarm not parsed. If an error happens while parsing this we will drop the snode.
 * @param associatedWith the specific publickey associated with this call
 */
async function handle421InvalidSwarm(snodeEd25519: string, body: string, associatedWith?: string) {
  // The snode isn't associated with the given public key anymore
  // this does not make much sense to have a 421 without a publicKey set.
  if (associatedWith) {
    try {
      const json = JSON.parse(body);
      // The snode isn't associated with the given public key anymore
      if (json.snodes?.length) {
        // the snode gave us the new swarm. Save it for the next retry
        window.log.warn('Wrong swarm, now looking at snodes', json.snodes);

        return updateSwarmFor(associatedWith, json.snodes);
      }
      // remove this node from the swarm of this pubkey
      return dropSnodeFromSwarmIfNeeded(associatedWith, snodeEd25519);
    } catch (e) {
      window.log.warn(
        'Got error while parsing 421 result. Dropping this snode from the swarm of this pubkey',
        e
      );
      // could not parse result. Consider that this snode as invalid
      return dropSnodeFromSwarmIfNeeded(associatedWith, snodeEd25519);
    }
  }
  window.log.warn('Got a 421 without an associatedWith publickey');
}

/**
 * 406 => clock out of sync
 * 421 => swarm changed for this associatedWith publicKey
 * 500, 502, 503, AND default => bad snode.
 */
export async function handleOnionRequestErrors(
  statusCode: number,
  snodeEd25519: string,
  body: string,
  associatedWith?: string
) {
  switch (statusCode) {
    case 406:
      // FIXME audric
      console.warn('Clockoutofsync TODO');
      window.log.warn('The users clock is out of sync with the service node network.');
      debugger;
      throw new Error('ClockOutOfSync TODO');
    // return ClockOutOfSync;
    case 421:
      return handle421InvalidSwarm(snodeEd25519, body, associatedWith);
    default:
      return incrementBadSnodeCountOrDrop(snodeEd25519, associatedWith);
  }
}

/**
 * Handle a bad snode result.
 * The `snodeFailureCount` for that node is incremented. If it's more than `snodeFailureThreshold`,
 * we drop this node from the snode pool and from the associatedWith publicKey swarm if this is set.
 *
 * So after this call, if the snode keeps getting errors, we won't contact it again
 *
 * @param snodeEd25519 the snode ed25519 which cause issues
 * @param associatedWith if set, we will drop this snode from the swarm of the pubkey too
 */
export async function incrementBadSnodeCountOrDrop(snodeEd25519: string, associatedWith?: string) {
  const oldFailureCount = snodeFailureCount[snodeEd25519] || 0;
  const newFailureCount = oldFailureCount + 1;
  snodeFailureCount[snodeEd25519] = newFailureCount;
  window.log.warn(
    `Couldn't reach snode at: ${snodeEd25519}; setting failure count to ${newFailureCount}`
  );

  if (newFailureCount >= snodeFailureThreshold) {
    window.log.warn(`Failure threshold reached for: ${snodeEd25519}; dropping it.`);
    if (associatedWith) {
      console.warn(`Dropping ${snodeEd25519} from swarm of ${associatedWith}`);
      await dropSnodeFromSwarmIfNeeded(associatedWith, snodeEd25519);
    }
    console.warn(`Dropping ${snodeEd25519} from snodepool`);

    dropSnodeFromSnodePool(snodeEd25519);
    // the snode was ejected from the pool so it won't be used again.
    // in case of snode pool refresh, we need to be able to try to contact this node again so reset its failure count to 0.
    snodeFailureCount[snodeEd25519] = 0;

    try {
      await OnionPaths.dropSnodeFromPath(snodeEd25519);
    } catch (e) {
      console.warn('dropSnodeFromPath, patchingup', e);
      // if dropSnodeFromPath throws, it means there is an issue patching up the path, increment the whole path issues
      await OnionPaths.incrementBadPathCountOrDrop(snodeEd25519);
    }
  }
}

/**
 * This call tries to send the request via onion. If we get a bad path, it handles the snode removing of the swarm and snode pool.
 * But the caller needs to handle the retry (and rebuild the path on his side if needed)
 */
const sendOnionRequestHandlingSnodeEject = async ({
  reqIdx,
  destX25519Any,
  finalDestOptions,
  nodePath,
  abortSignal,
  associatedWith,
  finalRelayOptions,
  lsrpcIdx,
}: {
  reqIdx: number;
  nodePath: Array<Snode>;
  destX25519Any: string;
  finalDestOptions: {
    destination_ed25519_hex?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  finalRelayOptions?: FinalRelayOptions;
  lsrpcIdx?: number;
  abortSignal?: AbortSignal;
  associatedWith?: string;
}): Promise<SnodeResponse | RequestError> => {
  const { response, decodingSymmetricKey } = await sendOnionRequest({
    reqIdx,
    nodePath,
    destX25519Any,
    finalDestOptions,
    finalRelayOptions,
    lsrpcIdx,
    abortSignal,
  });
  const processed = await processOnionResponse(
    reqIdx,
    response,
    decodingSymmetricKey,
    false,
    abortSignal
  );

  if (isSnodeResponse(processed)) {
    return processed;
  } else {
    // If we get a bad path here, do what we gotta do to invalidate/increment the failure count of the node/path.
    // This does not retry, it just takes care of ejecting a node if needed. It is to the caller to do the retry
    const { nodeInFault: nodeInFaultEd25519, requestError, statusCode, body } = processed;
    if (requestError === RequestError.BAD_PATH) {
      if (nodeInFaultEd25519) {
        // we have a specific node in fault. This a `Next node not found :` suffix returned by a snode.
        // we can exclude just this node
        await handleOnionRequestErrors(
          statusCode || 0,
          nodeInFaultEd25519,
          body || '',
          associatedWith
        );
      }
    }
    return requestError;
  }
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
const sendOnionRequest = async ({
  reqIdx,
  nodePath,
  destX25519Any,
  finalDestOptions,
  finalRelayOptions,
  lsrpcIdx,
  abortSignal,
}: {
  reqIdx: number;
  nodePath: Array<Snode>;
  destX25519Any: string;
  finalDestOptions: {
    destination_ed25519_hex?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  finalRelayOptions?: FinalRelayOptions;
  lsrpcIdx?: number;
  abortSignal?: AbortSignal;
}) => {
  const { log } = window;

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
    window.log.warn('destX25519hex was not a string');
    destX25519hex = toHex(destX25519Any as any);
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
  options.headers = options.headers || {};

  const isLsrpc = !!finalRelayOptions;

  let destCtx: DestinationContext;
  try {
    if (!isLsrpc) {
      const body = options.body || '';
      delete options.body;

      const textEncoder = new TextEncoder();
      const bodyEncoded = textEncoder.encode(body);

      const plaintext = encodeCiphertextPlusJson(bodyEncoded, options);
      destCtx = await window.libloki.crypto.encryptForPubkey(destX25519hex, plaintext);
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

  const payload = await buildOnionGuardNodePayload(
    nodePath,
    destCtx,
    targetEd25519hex,
    finalRelayOptions,
    id
  );

  const guardNode = nodePath[0];

  const guardFetchOptions = {
    method: 'POST',
    body: payload,
    // we are talking to a snode...
    agent: snodeHttpsAgent,
    abortSignal,
  };

  const guardUrl = `https://${guardNode.ip}:${guardNode.port}/onion_req/v2`;
  // no logs for that one insecureNodeFetch as we do need to call insecureNodeFetch to our guardNode
  // window.log.info('insecureNodeFetch => plaintext for sendOnionRequest');

  const response = await insecureNodeFetch(guardUrl, guardFetchOptions);
  return { response, decodingSymmetricKey: destCtx.symmetricKey };
};

async function sendOnionRequestSnodeDest(
  reqIdx: any,
  onionPath: Array<Snode>,
  targetNode: Snode,
  plaintext?: string,
  associatedWith?: string
) {
  return sendOnionRequestHandlingSnodeEject({
    reqIdx,
    nodePath: onionPath,
    destX25519Any: targetNode.pubkey_x25519,
    finalDestOptions: {
      destination_ed25519_hex: targetNode.pubkey_ed25519,
      body: plaintext,
    },
    associatedWith,
  });
}

/**
 * This call tries to send the request via onion. If we get a bad path, it handles the snode removing of the swarm and snode pool.
 * But the caller needs to handle the retry (and rebuild the path on his side if needed)
 */
export async function sendOnionRequestLsrpcDest(
  reqIdx: number,
  onionPath: Array<Snode>,
  destX25519Any: string,
  finalRelayOptions: FinalRelayOptions,
  payloadObj: FinalDestinationOptions,
  lsrpcIdx: number,
  abortSignal?: AbortSignal
): Promise<SnodeResponse | RequestError> {
  return sendOnionRequestHandlingSnodeEject({
    reqIdx,
    nodePath: onionPath,
    destX25519Any,
    finalDestOptions: payloadObj,
    finalRelayOptions,
    lsrpcIdx,
    abortSignal,
  });
}

export function getPathString(pathObjArr: Array<{ ip: string; port: number }>): string {
  return pathObjArr.map(node => `${node.ip}:${node.port}`).join(', ');
}

export async function lokiOnionFetch(
  targetNode: Snode,
  body?: string,
  associatedWith?: string
): Promise<SnodeResponse | false> {
  const { log } = window;

  // Get a path excluding `targetNode`:
  // eslint-disable no-await-in-loop
  const path = await OnionPaths.getOnionPath(targetNode);
  const thisIdx = OnionPaths.assignOnionRequestNumber();

  // At this point I only care about BAD_PATH
  console.warn('lokiOnionFetch with path', path);
  // FIXME audric to remove, just used to break onion routing
  path[2].pubkey_ed25519 = '11edd12a6f29011a1beb5b245a06b16548f2796eec4057a6c191700ffa780f5c';
  console.warn('FIXME audric to remove, just used to break onion routing');

  const result = await sendOnionRequestSnodeDest(thisIdx, path, targetNode, body, associatedWith);

  if (result === RequestError.BAD_PATH) {
    log.error(
      `[path] Error on the path: ${getPathString(path)} to ${targetNode.ip}:${targetNode.port}`
    );
    // BAD_PATH are now handled in sendOnionRequest directly
    return false;
  } else if (result === RequestError.OTHER) {
    // could mean, fail to parse results
    // or status code wasn't 200
    // or can't decrypt
    // it's not a bad_path, so we don't need to mark the path as bad
    log.error(
      `[path] sendOnionRequest gave false for path: ${getPathString(path)} to ${targetNode.ip}:${
        targetNode.port
      }`
    );
    return false;
  } else if (result === RequestError.ABORTED) {
    // could mean, fail to parse results
    // or status code wasn't 200
    // or can't decrypt
    // it's not a bad_path, so we don't need to mark the path as bad
    log.error(
      `[path] sendOnionRequest gave aborted for path: ${getPathString(path)} to ${targetNode.ip}:${
        targetNode.port
      }`
    );
    return false;
  } else {
    return result;
  }
}
