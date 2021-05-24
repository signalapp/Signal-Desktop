import { default as insecureNodeFetch } from 'node-fetch';
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
import pRetry from 'p-retry';
import { incrementBadPathCountOrDrop } from '../onions/onionPath';

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

const NEXT_NODE_NOT_FOUND_PREFIX = 'Next node not found: ';

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
  if (!destination.host && !destination.destination) {
    window?.log?.warn('loki_rpc::encryptForRelayV2 - no destination', destination);
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
  finalRelayOptions?: FinalRelayOptions
) {
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
          window?.log?.error(
            'loki_rpc:::buildOnionGuardNodePayload - no ed25519 for',
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
      window?.log?.error(
        'loki_rpc:::buildOnionGuardNodePayload - encryptForRelayV2 failure',
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
  finalRelayOptions?: FinalRelayOptions
) {
  const ctxes = await buildOnionCtxs(nodePath, destCtx, targetED25519Hex, finalRelayOptions);

  // this is the OUTER side of the onion, the one encoded with multiple layer
  // So the one we will send to the first guard node.
  const guardCtx = ctxes[ctxes.length - 1]; // last ctx

  // New "semi-binary" encoding

  const guardPayloadObj = {
    ephemeral_key: toHex(guardCtx.ephemeralKey),
  };

  return encodeCiphertextPlusJson(guardCtx.ciphertext, guardPayloadObj);
}

function process406Error(statusCode: number) {
  if (statusCode === 406) {
    // clock out of sync
    console.warn('clock out of sync todo');
    // this will make the pRetry stop
    throw new pRetry.AbortError('You clock is out of sync with the network. Check your clock.');
  }
}

async function process421Error(
  statusCode: number,
  body: string,
  associatedWith?: string,
  lsrpcEd25519Key?: string
) {
  if (statusCode === 421) {
    if (!lsrpcEd25519Key || !associatedWith) {
      throw new Error('status 421 without a final destination or no associatedWith makes no sense');
    }
    window?.log?.info('Invalidating swarm');
    await handle421InvalidSwarm(lsrpcEd25519Key, body, associatedWith);
  }
}

/**
 * Handle throwing errors for destination errors.
 * A destination can either be a server (like an opengroup server) in this case destinationEd25519 is unset or be a snode (for snode rpc calls) and destinationEd25519 is set in this case.
 *
 * If destinationEd25519 is set, we will increment the failure count of the specified snode
 */
async function processOnionRequestErrorAtDestination({
  statusCode,
  body,
  destinationEd25519,
  associatedWith,
}: {
  statusCode: number;
  body: string;
  destinationEd25519?: string;
  associatedWith?: string;
}) {
  if (statusCode === 200) {
    window?.log?.info('processOnionRequestErrorAtDestination. statusCode ok:', statusCode);
    return;
  }
  process406Error(statusCode);
  await process421Error(statusCode, body, associatedWith, destinationEd25519);
  if (destinationEd25519) {
    await processAnyOtherErrorAtDestination(statusCode, body, destinationEd25519, associatedWith);
  } else {
    console.warn(
      'processOnionRequestErrorAtDestination: destinationEd25519 unset. was it an open group call?',
      statusCode
    );
  }
}

async function processAnyOtherErrorOnPath(
  status: number,
  guardNodeEd25519: string,
  ciphertext?: string,
  associatedWith?: string
) {
  // this test checks for on error in your path.
  if (
    // response.status === 502 ||
    // response.status === 503 ||
    // response.status === 504 ||
    // response.status === 404 ||
    status !== 200 // this is pretty strong. a 400 (Oxen server error) will be handled as a bad path.
  ) {
    window?.log?.warn(`[path] Got status: ${status}`);
    //
    let nodeNotFound;
    if (ciphertext?.startsWith(NEXT_NODE_NOT_FOUND_PREFIX)) {
      nodeNotFound = ciphertext.substr(NEXT_NODE_NOT_FOUND_PREFIX.length);
    }

    // If we have a specific node in fault we can exclude just this node.
    // Otherwise we increment the whole path failure count
    if (nodeNotFound) {
      await incrementBadSnodeCountOrDrop({
        snodeEd25519: nodeNotFound,
        associatedWith,
        isNodeNotFound: true,
      });

      // we are checking errors on the path, a nodeNotFound on the path should trigger a rebuild
    } else {
      await incrementBadPathCountOrDrop(guardNodeEd25519);
    }
    throw new Error(`Bad Path handled. Retry this request. Status: ${status}`);
  }
}

async function processAnyOtherErrorAtDestination(
  status: number,
  body: string,
  destinationEd25519: string,
  associatedWith?: string
) {
  // this test checks for on error in your path.
  if (
    // response.status === 502 ||
    // response.status === 503 ||
    // response.status === 504 ||
    // response.status === 404 ||
    status !== 200 // this is pretty strong. a 400 (Oxen server error) will be handled as a bad path.
  ) {
    window?.log?.warn(`[path] Got status at destination: ${status}`);

    let nodeNotFound;
    if (body?.startsWith(NEXT_NODE_NOT_FOUND_PREFIX)) {
      nodeNotFound = body.substr(NEXT_NODE_NOT_FOUND_PREFIX.length);

      if (nodeNotFound) {
        await incrementBadSnodeCountOrDrop({ snodeEd25519: destinationEd25519, associatedWith });
        // if we get a nodeNotFound at the desitnation. it means the targetNode to which we made the request is not found.
        // We have to retry with another targetNode so it's not just rebuilding the path. We have to go one lever higher (lokiOnionFetch).
        // status is 502 for a node not found
        throw new pRetry.AbortError(
          `Bad Path handled. Retry this request with another targetNode. Status: ${status}`
        );
      }
    }

    // If we have a specific node in fault we can exclude just this node.
    // Otherwise we increment the whole path failure count
    // if (nodeNotFound) {
    await incrementBadSnodeCountOrDrop({ snodeEd25519: destinationEd25519, associatedWith });

    throw new Error(`Bad Path handled. Retry this request. Status: ${status}`);
  }
}

async function processOnionRequestErrorOnPath(
  httpStatusCode: number, // this is the one on the response object, not inside the json response
  ciphertext: string,
  guardNodeEd25519: string,
  lsrpcEd25519Key?: string,
  associatedWith?: string
) {
  if (httpStatusCode !== 200) {
    console.warn('errorONpath:', ciphertext);
  }
  process406Error(httpStatusCode);
  await process421Error(httpStatusCode, ciphertext, associatedWith, lsrpcEd25519Key);
  await processAnyOtherErrorOnPath(httpStatusCode, guardNodeEd25519, ciphertext, associatedWith);
}

function processAbortedRequest(abortSignal?: AbortSignal) {
  if (abortSignal?.aborted) {
    window?.log?.warn('[path] Call aborted');
    // this will make the pRetry stop
    throw new pRetry.AbortError('Request got aborted');
  }
}

const debug = false;

/**
 * Only exported for testing purpose
 */
export async function decodeOnionResult(symmetricKey: ArrayBuffer, ciphertext: string) {
  const ciphertextBuffer = fromBase64ToArrayBuffer(ciphertext);

  const plaintextBuffer = await window.libloki.crypto.DecryptAESGCM(symmetricKey, ciphertextBuffer);

  return { plaintext: new TextDecoder().decode(plaintextBuffer), ciphertextBuffer };
}

/**
 * Only exported for testing purpose
 */
export async function processOnionResponse(
  response: { text: () => Promise<string>; status: number },
  symmetricKey: ArrayBuffer,
  guardNode: Snode,
  lsrpcEd25519Key?: string,
  abortSignal?: AbortSignal,
  associatedWith?: string
): Promise<SnodeResponse> {
  let ciphertext = '';

  processAbortedRequest(abortSignal);

  try {
    ciphertext = await response.text();
  } catch (e) {
    window?.log?.warn(e);
  }

  await processOnionRequestErrorOnPath(
    response.status,
    ciphertext,
    guardNode.pubkey_ed25519,
    lsrpcEd25519Key,
    associatedWith
  );

  if (!ciphertext) {
    window?.log?.warn(
      '[path] lokiRpc::processingOnionResponse - Target node return empty ciphertext'
    );
    throw new Error('Target node return empty ciphertext');
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
    const decoded = await exports.decodeOnionResult(symmetricKey, ciphertext);
    plaintext = decoded.plaintext;
    ciphertextBuffer = decoded.ciphertextBuffer;
  } catch (e) {
    console.warn(e);
    window?.log?.error('[path] lokiRpc::processingOnionResponse - decode error', e);
    window?.log?.error(
      '[path] lokiRpc::processingOnionResponse - symmetricKey',
      toHex(symmetricKey)
    );
    if (ciphertextBuffer) {
      window?.log?.error(
        '[path] lokiRpc::processingOnionResponse - ciphertextBuffer',
        toHex(ciphertextBuffer)
      );
    }
    throw new Error('Ciphertext decode error');
  }

  if (debug) {
    window?.log?.debug('lokiRpc::processingOnionResponse - plaintext', plaintext);
  }

  try {
    const jsonRes = JSON.parse(plaintext, (key, value) => {
      if (typeof value === 'number' && value > Number.MAX_SAFE_INTEGER) {
        window?.log?.warn('Received an out of bounds js number');
      }
      return value;
    }) as Record<string, any>;

    const status = jsonRes.status_code || jsonRes.status;
    await processOnionRequestErrorAtDestination({
      statusCode: status,
      body: plaintext,
      destinationEd25519: lsrpcEd25519Key,
      associatedWith,
    });

    return jsonRes as SnodeResponse;
  } catch (e) {
    window?.log?.error(
      `[path] lokiRpc::processingOnionResponse - parse error outer json ${e.code} ${e.message} json: '${plaintext}'`
    );
    throw e;
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
  if (!associatedWith) {
    window?.log?.warn('Got a 421 without an associatedWith publickey');
    return;
  }
  try {
    const json = JSON.parse(body);

    // The snode isn't associated with the given public key anymore
    if (json.snodes?.length) {
      // the snode gave us the new swarm. Save it for the next retry
      window?.log?.warn('Wrong swarm, now looking at snodes', json.snodes);

      return updateSwarmFor(associatedWith, json.snodes);
    }
    // remove this node from the swarm of this pubkey
    return dropSnodeFromSwarmIfNeeded(associatedWith, snodeEd25519);
  } catch (e) {
    console.warn('dropSnodeFromSwarmIfNeeded', snodeEd25519);
    window?.log?.warn(
      'Got error while parsing 421 result. Dropping this snode from the swarm of this pubkey',
      e
    );
    // could not parse result. Consider that this snode as invalid
    return dropSnodeFromSwarmIfNeeded(associatedWith, snodeEd25519);
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
 * @param isNodeNotFound if set, we will drop this snode right now as this is an invalid node for the network.
 */
export async function incrementBadSnodeCountOrDrop({
  snodeEd25519,
  associatedWith,
  isNodeNotFound,
}: {
  snodeEd25519: string;
  associatedWith?: string;
  isNodeNotFound?: boolean;
}) {
  const oldFailureCount = snodeFailureCount[snodeEd25519] || 0;
  const newFailureCount = oldFailureCount + 1;
  snodeFailureCount[snodeEd25519] = newFailureCount;

  if (newFailureCount >= snodeFailureThreshold || isNodeNotFound) {
    if (isNodeNotFound) {
      window?.log?.warn(`Node not found reported for: ${snodeEd25519}; dropping it.`);
    } else {
      window?.log?.warn(`Failure threshold reached for: ${snodeEd25519}; dropping it.`);
    }

    if (associatedWith) {
      window?.log?.info(`Dropping ${snodeEd25519} from swarm of ${associatedWith}`);
      await dropSnodeFromSwarmIfNeeded(associatedWith, snodeEd25519);
    }
    window?.log?.info(`Dropping ${snodeEd25519} from snodepool`);

    dropSnodeFromSnodePool(snodeEd25519);
    // the snode was ejected from the pool so it won't be used again.
    // in case of snode pool refresh, we need to be able to try to contact this node again so reset its failure count to 0.
    snodeFailureCount[snodeEd25519] = 0;

    try {
      await OnionPaths.dropSnodeFromPath(snodeEd25519);
    } catch (e) {
      window?.log?.warn(
        'dropSnodeFromPath, got error while patchingup... incrementing the whole path as bad',
        e
      );
      // if dropSnodeFromPath throws, it means there is an issue patching up the path, increment the whole path issues count
      await OnionPaths.incrementBadPathCountOrDrop(snodeEd25519);
    }
  } else {
    window?.log?.warn(
      `Couldn't reach snode at: ${snodeEd25519}; setting his failure count to ${newFailureCount}`
    );
  }
}

/**
 * This call tries to send the request via onion. If we get a bad path, it handles the snode removing of the swarm and snode pool.
 * But the caller needs to handle the retry (and rebuild the path on his side if needed)
 */
const sendOnionRequestHandlingSnodeEject = async ({
  destX25519Any,
  finalDestOptions,
  nodePath,
  abortSignal,
  associatedWith,
  finalRelayOptions,
}: {
  nodePath: Array<Snode>;
  destX25519Any: string;
  finalDestOptions: {
    destination_ed25519_hex?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  finalRelayOptions?: FinalRelayOptions;
  abortSignal?: AbortSignal;
  associatedWith?: string;
}): Promise<SnodeResponse> => {
  // this sendOnionRequest() call has to be the only one like this.
  // If you need to call it, call it through sendOnionRequestHandlingSnodeEject because this is the one handling path rebuilding and known errors
  const { response, decodingSymmetricKey } = await sendOnionRequest({
    nodePath,
    destX25519Any,
    finalDestOptions,
    finalRelayOptions,
    abortSignal,
  });

  // this call will handle the common onion failure logic.
  // if an error is not retryable a AbortError is triggered, which is handled by pRetry and retries are stopped
  const processed = await processOnionResponse(
    response,
    decodingSymmetricKey,
    nodePath[0],
    finalDestOptions?.destination_ed25519_hex,
    abortSignal,
    associatedWith
  );

  return processed;
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
  nodePath,
  destX25519Any,
  finalDestOptions,
  finalRelayOptions,
  abortSignal,
}: {
  nodePath: Array<Snode>;
  destX25519Any: string;
  finalDestOptions: {
    destination_ed25519_hex?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  finalRelayOptions?: FinalRelayOptions;
  abortSignal?: AbortSignal;
}) => {
  // get destination pubkey in array buffer format
  let destX25519hex = destX25519Any;
  if (typeof destX25519hex !== 'string') {
    // convert AB to hex
    window?.log?.warn('destX25519hex was not a string');
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
    window?.log?.error(
      'loki_rpc::sendOnionRequest - encryptForPubKey failure [',
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
    finalRelayOptions
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
  // window?.log?.info('insecureNodeFetch => plaintext for sendOnionRequest');

  const response = await insecureNodeFetch(guardUrl, guardFetchOptions);
  return { response, decodingSymmetricKey: destCtx.symmetricKey };
};

async function sendOnionRequestSnodeDest(
  onionPath: Array<Snode>,
  targetNode: Snode,
  plaintext?: string,
  associatedWith?: string
) {
  return sendOnionRequestHandlingSnodeEject({
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
  onionPath: Array<Snode>,
  destX25519Any: string,
  finalRelayOptions: FinalRelayOptions,
  payloadObj: FinalDestinationOptions,
  abortSignal?: AbortSignal
): Promise<SnodeResponse> {
  return sendOnionRequestHandlingSnodeEject({
    nodePath: onionPath,
    destX25519Any,
    finalDestOptions: payloadObj,
    finalRelayOptions,
    abortSignal,
  });
}

export function getPathString(pathObjArr: Array<{ ip: string; port: number }>): string {
  return pathObjArr.map(node => `${node.ip}:${node.port}`).join(', ');
}

async function onionFetchRetryable(
  targetNode: Snode,
  body?: string,
  associatedWith?: string
): Promise<SnodeResponse> {
  // Get a path excluding `targetNode`:
  const path = await OnionPaths.getOnionPath(targetNode);
  const result = await sendOnionRequestSnodeDest(path, targetNode, body, associatedWith);
  return result;
}

/**
 * If the fetch throws a retryable error we retry this call with a new path at most 3 times. If another error happens, we return it. If we have a result we just return it.
 */
export async function lokiOnionFetch(
  targetNode: Snode,
  body?: string,
  associatedWith?: string
): Promise<SnodeResponse | undefined> {
  try {
    const retriedResult = await pRetry(
      async () => {
        return onionFetchRetryable(targetNode, body, associatedWith);
      },
      {
        retries: 10,
        factor: 1,
        minTimeout: 200,
        maxTimeout: 2000,
        onFailedAttempt: e => {
          window?.log?.warn(
            `onionFetchRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
          );
        },
      }
    );

    return retriedResult;
  } catch (e) {
    window?.log?.warn('onionFetchRetryable failed ', e);
    console.warn('error to show to user');
    throw e;
  }
}
