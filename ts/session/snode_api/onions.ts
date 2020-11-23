import fetch from 'node-fetch';
import https from 'https';

import { Snode } from './snodePool';
import ByteBuffer from 'bytebuffer';
import { StringUtils } from '../utils';
import { OnionAPI } from '../onions';

let onionPayload = 0;

enum RequestError {
  BAD_PATH,
  OTHER,
}

export interface SnodeResponse {
  body: string;
  status: number;
}

// Returns the actual ciphertext, symmetric key that will be used
// for decryption, and an ephemeral_key to send to the next hop
async function encryptForPubKey(pubKeyX25519hex: string, reqObj: any) {
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
  destCtx: any,
  targetED25519Hex: string,
  // whether to use the new "semi-binary" protocol
  useV2: boolean,
  fileServerOptions?: any,
  id = ''
) {
  const { log } = window;

  const ctxes = [destCtx];
  // from (3) 2 to 0
  const firstPos = nodePath.length - 1;

  for (let i = firstPos; i > -1; i -= 1) {
    let dest;
    const relayingToFinalDestination = i === firstPos; // if last position

    if (relayingToFinalDestination && fileServerOptions) {
      let target = useV2 ? '/loki/v2/lsrpc' : '/loki/v1/lsrpc';

      if (window.lokiFeatureFlags.useFileOnionRequestsV2) {
        target = '/loki/v3/lsrpc';
      }

      dest = {
        host: fileServerOptions.host,
        target,
        method: 'POST',
      };
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
  destCtx: any,
  targetED25519Hex: string,
  // whether to use the new (v2) protocol
  useV2: boolean,
  finalRelayOptions?: any,
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
  reqIdx: any,
  response: any,
  sharedKey: any,
  useAesGcm: boolean,
  debug: boolean
): Promise<SnodeResponse | RequestError> => {
  const { log, libloki, StringView, dcodeIO } = window;

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
    log.warn(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - fetch unhandled error code: ${response.status}`
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
        StringView.arrayBufferToHex(ciphertextBuffer),
        'useAesGcm',
        useAesGcm
      );
    }

    const decryptFn = useAesGcm
      ? libloki.crypto.DecryptGCM
      : libloki.crypto.DHDecrypt;

    const plaintextBuffer = await decryptFn(sharedKey, ciphertextBuffer, debug);
    if (debug) {
      log.debug(
        'lokiRpc::processOnionResponse - plaintextBuffer',
        plaintextBuffer.toString()
      );
    }

    const textDecoder = new TextDecoder();
    plaintext = textDecoder.decode(plaintextBuffer);
  } catch (e) {
    log.error(
      `(${reqIdx}) [path] lokiRpc::processOnionResponse - decode error`,
      e.code,
      e.message
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
    const jsonRes = JSON.parse(plaintext);
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

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// finalDestOptions is an object
// FIXME: internally track reqIdx, not externally
const sendOnionRequest = async (
  reqIdx: any,
  nodePath: Array<Snode>,
  destX25519Any: string,
  finalDestOptions: any,
  finalRelayOptions?: any,
  lsrpcIdx?: any
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
    destX25519hex = StringView.arrayBufferToHex(destX25519Any);
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
    options.headers = '';
  }

  const useV2 = window.lokiFeatureFlags.useOnionRequestsV2;

  const isLsrpc = !!finalRelayOptions;

  let destCtx;
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
    targetEd25519hex,
    useV2,
    finalRelayOptions,
    id
  );
  onionPayload += payload.length;
  log.debug('Onion payload size: ', payload.length, ' total:', onionPayload);

  const guardFetchOptions = {
    method: 'POST',
    body: payload,
    // we are talking to a snode...
    agent: snodeHttpsAgent,
  };

  const target = useV2 ? '/onion_req/v2' : '/onion_req';

  const guardUrl = `https://${nodePath[0].ip}:${nodePath[0].port}${target}`;
  const response = await fetch(guardUrl, guardFetchOptions);

  return processOnionResponse(
    reqIdx,
    response,
    destCtx.symmetricKey,
    true,
    false
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
  reqIdx: any,
  nodePath: Array<Snode>,
  destX25519Any: any,
  host: any,
  payloadObj: any,
  lsrpcIdx: number
): Promise<SnodeResponse | RequestError> {
  return sendOnionRequest(
    reqIdx,
    nodePath,
    destX25519Any,
    payloadObj,
    { host },
    lsrpcIdx
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
    const path = await OnionAPI.getOnionPath(targetNode);
    const thisIdx = OnionAPI.assignOnionRequestNumber();

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
      OnionAPI.markPathAsBad(path);
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
    } else {
      return result;
    }
  }
}
