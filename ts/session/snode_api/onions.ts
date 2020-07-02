import fetch from 'node-fetch';
import https from 'https';

import { Snode } from './snodePool';
import ByteBuffer from 'bytebuffer';
import { StringUtils } from '../utils';

const BAD_PATH = 'bad_path';

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
  const { log, dcodeIO, StringView } = window;

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

async function makeGuardPayload(guardCtx: any) {
  const ciphertextBase64 = StringUtils.decode(guardCtx.ciphertext, 'base64');

  const guardPayloadObj = {
    ciphertext: ciphertextBase64,
    ephemeral_key: StringUtils.decode(guardCtx.ephemeralKey, 'hex'),
  };
  return guardPayloadObj;
}

// we just need the targetNode.pubkey_ed25519 for the encryption
// targetPubKey is ed25519 if snode is the target
async function makeOnionRequest(
  nodePath: Array<Snode>,
  destCtx: any,
  targetED25519Hex: string,
  finalRelayOptions?: any,
  id = ''
) {
  const { log } = window;

  const ctxes = [destCtx];
  // from (3) 2 to 0
  const firstPos = nodePath.length - 1;

  for (let i = firstPos; i > -1; i -= 1) {
    let dest;
    const relayingToFinalDestination = i === firstPos; // if last position

    if (relayingToFinalDestination && finalRelayOptions) {
      dest = {
        host: finalRelayOptions.host,
        target: '/loki/v1/lsrpc',
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
      // eslint-disable-next-line no-await-in-loop
      const ctx = await encryptForRelay(
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
  const guardCtx = ctxes[ctxes.length - 1]; // last ctx

  const payloadObj = makeGuardPayload(guardCtx);

  // all these requests should use AesGcm
  return payloadObj;
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

  const ciphertext = await response.text();
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
) => {
  const { log, StringView } = window;

  // loki-storage may need this to function correctly
  // but ADN calls will not always have a body
  /*
    if (!finalDestOptions.body) {
      finalDestOptions.body = '';
    }
    */

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

  let destCtx;
  try {
    destCtx = await encryptForPubKey(destX25519hex, options);
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

  const payloadObj = await makeOnionRequest(
    nodePath,
    destCtx,
    targetEd25519hex,
    finalRelayOptions,
    id
  );

  const guardFetchOptions = {
    method: 'POST',
    body: JSON.stringify(payloadObj),
    // we are talking to a snode...
    agent: snodeHttpsAgent,
  };

  const guardUrl = `https://${nodePath[0].ip}:${nodePath[0].port}/onion_req`;
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
) {
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
  const { lokiSnodeAPI, log } = window;

  // Loop until the result is not BAD_PATH
  // tslint:disable-next-line no-constant-condition
  while (true) {
    // Get a path excluding `targetNode`:
    // eslint-disable-next-line no-await-in-loop
    const path = await lokiSnodeAPI.getOnionPath(targetNode);
    const thisIdx = lokiSnodeAPI.assignOnionRequestNumber();

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
      lokiSnodeAPI.markPathAsBad(path);
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
