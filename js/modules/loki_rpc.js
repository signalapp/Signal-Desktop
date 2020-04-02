/* global log, libloki, textsecure, getStoragePubKey, lokiSnodeAPI, StringView,
  libsignal, window, TextDecoder, TextEncoder, dcodeIO, process, crypto */

const nodeFetch = require('node-fetch');
const https = require('https');

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const endpointBase = '/storage_rpc/v1';

// Request index for debugging
let onionReqIdx = 0;

const timeoutDelay = ms => new Promise(resolve => setTimeout(resolve, ms));

const encryptForNode = async (node, payload) => {
  const textEncoder = new TextEncoder();
  const plaintext = textEncoder.encode(payload);

  const ephemeral = libloki.crypto.generateEphemeralKeyPair();

  const snPubkey = StringView.hexToArrayBuffer(node.pubkey_x25519);

  const ephemeralSecret = libsignal.Curve.calculateAgreement(
    snPubkey,
    ephemeral.privKey
  );

  const salt = window.Signal.Crypto.bytesFromString('LOKI');

  const key = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  const symmetricKey = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    ephemeralSecret
  );

  const ciphertext = await window.libloki.crypto.EncryptGCM(
    symmetricKey,
    plaintext
  );

  return { ciphertext, symmetricKey, ephemeral_key: ephemeral.pubKey };
};

// Returns the actual ciphertext, symmetric key that will be used
// for decryption, and an ephemeral_key to send to the next hop
const encryptForDestination = async (node, payload) => {
  // Do we still need "headers"?
  const reqStr = JSON.stringify({ body: payload, headers: '' });

  return encryptForNode(node, reqStr);
};

// `ctx` holds info used by `node` to relay further
const encryptForRelay = async (node, nextNode, ctx) => {
  const payload = ctx.ciphertext;

  const reqJson = {
    ciphertext: dcodeIO.ByteBuffer.wrap(payload).toString('base64'),
    ephemeral_key: StringView.arrayBufferToHex(ctx.ephemeral_key),
    destination: nextNode.pubkey_ed25519,
  };

  const reqStr = JSON.stringify(reqJson);

  return encryptForNode(node, reqStr);
};

const BAD_PATH = 'bad_path';

// May return false BAD_PATH, indicating that we should try a new
const sendOnionRequest = async (reqIdx, nodePath, targetNode, plaintext) => {
  log.debug('Sending an onion request');

  const ctx1 = await encryptForDestination(targetNode, plaintext);
  const ctx2 = await encryptForRelay(nodePath[2], targetNode, ctx1);
  const ctx3 = await encryptForRelay(nodePath[1], nodePath[2], ctx2);
  const ctx4 = await encryptForRelay(nodePath[0], nodePath[1], ctx3);

  const ciphertextBase64 = dcodeIO.ByteBuffer.wrap(ctx4.ciphertext).toString(
    'base64'
  );

  const payload = {
    ciphertext: ciphertextBase64,
    ephemeral_key: StringView.arrayBufferToHex(ctx4.ephemeral_key),
  };

  const fetchOptions = {
    method: 'POST',
    body: JSON.stringify(payload),
  };

  const url = `https://${nodePath[0].ip}:${nodePath[0].port}/onion_req`;

  // we only proxy to snodes...
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const response = await nodeFetch(url, fetchOptions);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

  return processOnionResponse(reqIdx, response, ctx1.symmetricKey, true);
};

// Process a response as it arrives from `nodeFetch`, handling
// http errors and attempting to decrypt the body with `sharedKey`
const processOnionResponse = async (reqIdx, response, sharedKey, useAesGcm) => {
  log.debug(`(${reqIdx}) [path] processing onion response`);

  // detect SNode is not ready (not in swarm; not done syncing)
  if (response.status === 503) {
    log.warn(`(${reqIdx}) [path] Got 503: snode not ready`);

    return BAD_PATH;
  }

  if (response.status === 504) {
    log.warn(`(${reqIdx}) [path] Got 504: Gateway timeout`);
    return BAD_PATH;
  }

  if (response.status === 404) {
    // Why would we get this error on testnet?
    log.warn(`(${reqIdx}) [path] Got 404: Gateway timeout`);
    return BAD_PATH;
  }

  if (response.status !== 200) {
    log.warn(
      `(${reqIdx}) [path] fetch unhandled error code: ${response.status}`
    );
    return false;
  }

  const ciphertext = await response.text();
  if (!ciphertext) {
    log.warn(`(${reqIdx}) [path]: Target node return empty ciphertext`);
    return false;
  }

  let plaintext;
  let ciphertextBuffer;
  try {
    ciphertextBuffer = dcodeIO.ByteBuffer.wrap(
      ciphertext,
      'base64'
    ).toArrayBuffer();

    const decryptFn = useAesGcm
      ? window.libloki.crypto.DecryptGCM
      : window.libloki.crypto.DHDecrypt;

    const plaintextBuffer = await decryptFn(sharedKey, ciphertextBuffer);

    const textDecoder = new TextDecoder();
    plaintext = textDecoder.decode(plaintextBuffer);
  } catch (e) {
    log.error(`(${reqIdx}) [path] decode error`);
    if (ciphertextBuffer) {
      log.error(`(${reqIdx}) [path] ciphertextBuffer`, ciphertextBuffer);
    }
    return false;
  }

  try {
    const jsonRes = JSON.parse(plaintext);
    // emulate nodeFetch response...
    jsonRes.json = () => {
      try {
        const res = JSON.parse(jsonRes.body);
        return res;
      } catch (e) {
        log.error(`(${reqIdx}) [path] parse error json: `, jsonRes.body);
      }
      return false;
    };
    return jsonRes;
  } catch (e) {
    log.error('[path] parse error', e.code, e.message, `json:`, plaintext);
    return false;
  }
};

const sendToProxy = async (options = {}, targetNode, retryNumber = 0) => {
  const _ = window.Lodash;

  const snodePool = await lokiSnodeAPI.getRandomSnodePool();

  if (snodePool.length < 2) {
    log.error(
      'Not enough service nodes for a proxy request, only have: ',
      snodePool.length
    );
    return false;
  }

  // Making sure the proxy node is not the same as the target node:
  const snodePoolSafe = _.without(
    snodePool,
    _.find(snodePool, { pubkey_ed25519: targetNode.pubkey_ed25519 })
  );

  const randSnode = window.Lodash.sample(snodePoolSafe);

  // Don't allow arbitrary URLs, only snodes and loki servers
  const url = `https://${randSnode.ip}:${randSnode.port}/proxy`;

  const snPubkeyHex = StringView.hexToArrayBuffer(targetNode.pubkey_x25519);

  const myKeys = window.libloki.crypto.generateEphemeralKeyPair();

  const symmetricKey = libsignal.Curve.calculateAgreement(
    snPubkeyHex,
    myKeys.privKey
  );

  const textEncoder = new TextEncoder();
  const body = JSON.stringify(options);

  const plainText = textEncoder.encode(body);
  const ivAndCiphertext = await window.libloki.crypto.DHEncrypt(
    symmetricKey,
    plainText
  );

  const firstHopOptions = {
    method: 'POST',
    body: ivAndCiphertext,
    headers: {
      'X-Sender-Public-Key': StringView.arrayBufferToHex(myKeys.pubKey),
      'X-Target-Snode-Key': targetNode.pubkey_ed25519,
    },
    agent: snodeHttpsAgent,
  };

  // we only proxy to snodes...
  const response = await nodeFetch(url, firstHopOptions);

  if (response.status === 401) {
    // decom or dereg
    // remove
    // but which the proxy or the target...
    // we got a ton of randomPool nodes, let's just not worry about this one
    lokiSnodeAPI.markRandomNodeUnreachable(randSnode);
    const randomPoolRemainingCount = lokiSnodeAPI.getRandomPoolLength();
    const ciphertext = await response.text();
    log.warn(
      `lokiRpc:::sendToProxy -`,
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${
        targetNode.port
      }`,
      `snode is decom or dereg: `,
      ciphertext,
      // `marking random snode bad ${randomPoolRemainingCount} remaining`
      `Try #${retryNumber}`,
      `removing randSnode leaving ${randomPoolRemainingCount} in the random pool`
    );
    // retry, just count it happening 5 times to be the target for now
    return sendToProxy(options, targetNode, retryNumber + 1);
  }

  // detect SNode is not ready (not in swarm; not done syncing)
  if (response.status === 503 || response.status === 500) {
    // this doesn't mean the random node is bad, it could be the target node
    // but we got a ton of randomPool nodes, let's just not worry about this one
    lokiSnodeAPI.markRandomNodeUnreachable(randSnode);
    const randomPoolRemainingCount = lokiSnodeAPI.getRandomPoolLength();
    const ciphertext = await response.text();
    log.warn(
      `lokiRpc:::sendToProxy -`,
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${
        targetNode.port
      }`,
      `code ${response.status} error`,
      ciphertext,
      // `marking random snode bad ${randomPoolRemainingCount} remaining`
      `Try #${retryNumber}`,
      `removing randSnode leaving ${randomPoolRemainingCount} in the random pool`
    );
    // mark as bad for this round (should give it some time and improve success rates)
    // retry for a new working snode
    const pRetryNumber = retryNumber + 1;
    if (pRetryNumber > 5) {
      // it's likely a net problem or an actual problem on the target node
      // lets mark the target node bad for now
      // we'll just rotate it back in if it's a net problem
      log.warn(`Failing ${targetNode.ip}:${targetNode.port} after 5 retries`);
      if (options.ourPubKey) {
        lokiSnodeAPI.unreachableNode(options.ourPubKey, targetNode);
      }
      return false;
    }
    // 500 burns through a node too fast,
    // let's slow the retry to give it more time to recover
    if (response.status === 500) {
      await timeoutDelay(5000);
    }
    return sendToProxy(options, targetNode, pRetryNumber);
  }
  /*
  if (response.status === 500) {
    // usually when the server returns nothing...
  }
  */

  // FIXME: handle nodeFetch errors/exceptions...
  if (response.status !== 200) {
    // let us know we need to create handlers for new unhandled codes
    log.warn(
      'lokiRpc:::sendToProxy - fetch non-200 statusCode',
      response.status,
      `from snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${
        targetNode.port
      }`
    );
    return false;
  }

  const ciphertext = await response.text();
  if (!ciphertext) {
    // avoid base64 decode failure
    // usually a 500 but not always
    // could it be a timeout?
    log.warn('Server did not return any data for', options, targetNode);
    return false;
  }

  let plaintext;
  let ciphertextBuffer;
  try {
    ciphertextBuffer = dcodeIO.ByteBuffer.wrap(
      ciphertext,
      'base64'
    ).toArrayBuffer();

    const plaintextBuffer = await window.libloki.crypto.DHDecrypt(
      symmetricKey,
      ciphertextBuffer
    );

    const textDecoder = new TextDecoder();
    plaintext = textDecoder.decode(plaintextBuffer);
  } catch (e) {
    log.error(
      'lokiRpc:::sendToProxy - decode error',
      e.code,
      e.message,
      `from ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${
        targetNode.port
      } ciphertext:`,
      ciphertext
    );
    if (ciphertextBuffer) {
      log.error('ciphertextBuffer', ciphertextBuffer);
    }
    return false;
  }

  try {
    const jsonRes = JSON.parse(plaintext);
    // emulate nodeFetch response...
    jsonRes.json = () => {
      try {
        return JSON.parse(jsonRes.body);
      } catch (e) {
        log.error(
          'lokiRpc:::sendToProxy - parse error',
          e.code,
          e.message,
          `from ${randSnode.ip}:${randSnode.port} json:`,
          jsonRes.body
        );
      }
      return false;
    };
    if (retryNumber) {
      log.info(
        `lokiRpc:::sendToProxy - request succeeded,`,
        `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${
          targetNode.port
        }`,
        `on retry #${retryNumber}`
      );
    }
    return jsonRes;
  } catch (e) {
    log.error(
      'lokiRpc:::sendToProxy - parse error',
      e.code,
      e.message,
      `from ${randSnode.ip}:${randSnode.port} json:`,
      plaintext
    );
  }
  return false;
};

// A small wrapper around node-fetch which deserializes response
const lokiFetch = async (url, options = {}, targetNode = null) => {
  const timeout = options.timeout || 10000;
  const method = options.method || 'GET';

  const fetchOptions = {
    ...options,
    timeout,
    method,
  };

  try {
    // Absence of targetNode indicates that we want a direct connection
    // (e.g. to connect to a seed node for the first time)
    if (window.lokiFeatureFlags.useOnionRequests && targetNode) {
      // Loop until the result is not BAD_PATH
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Get a path excluding `targetNode`:
        // eslint-disable-next-line no-await-in-loop
        const path = await lokiSnodeAPI.getOnionPath(targetNode);
        const thisIdx = onionReqIdx;
        onionReqIdx += 1;

        log.debug(
          `(${thisIdx}) using path ${path[0].ip}:${path[0].port} -> ${
            path[1].ip
          }:${path[1].port} -> ${path[2].ip}:${path[2].port} => ${
            targetNode.ip
          }:${targetNode.port}`
        );

        // eslint-disable-next-line no-await-in-loop
        const result = await sendOnionRequest(
          thisIdx,
          path,
          targetNode,
          fetchOptions.body
        );

        if (result === BAD_PATH) {
          log.error('[path] Error on the path');
          lokiSnodeAPI.markPathAsBad(path);
        } else {
          return result ? result.json() : false;
        }
      }
    }

    if (window.lokiFeatureFlags.useSnodeProxy && targetNode) {
      const result = await sendToProxy(fetchOptions, targetNode);
      // if not result, maybe we should throw??
      return result ? result.json() : {};
    }

    if (url.match(/https:\/\//)) {
      // import that this does not get set in sendToProxy fetchOptions
      fetchOptions.agent = snodeHttpsAgent;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    } else {
      log.info('lokirpc:::lokiFetch - http communication', url);
    }
    const response = await nodeFetch(url, fetchOptions);
    // restore TLS checking
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    let result;
    // Wrong swarm
    if (response.status === 421) {
      result = await response.json();
      const newSwarm = result.snodes ? result.snodes : [];
      throw new textsecure.WrongSwarmError(newSwarm);
    }

    // Wrong PoW difficulty
    if (response.status === 432) {
      result = await response.json();
      const { difficulty } = result;
      throw new textsecure.WrongDifficultyError(difficulty);
    }

    if (response.status === 406) {
      throw new textsecure.TimestampError(
        'Invalid Timestamp (check your clock)'
      );
    }

    if (!response.ok) {
      throw new textsecure.HTTPError('Loki_rpc error', response);
    }

    if (response.headers.get('Content-Type') === 'application/json') {
      result = await response.json();
    } else if (options.responseType === 'arraybuffer') {
      result = await response.buffer();
    } else {
      result = await response.text();
    }

    return result;
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new textsecure.NotFoundError('Failed to resolve address', e);
    }
    throw e;
  }
};

// Wrapper for a JSON RPC request
// Annoyngly, this is used for Lokid requests too
const lokiRpc = (
  address,
  port,
  method,
  params,
  options = {},
  endpoint = endpointBase,
  targetNode
) => {
  const headers = options.headers || {};
  const portString = port ? `:${port}` : '';
  const url = `${address}${portString}${endpoint}`;
  // TODO: The jsonrpc and body field will be ignored on storage server
  if (params.pubKey) {
    // Ensure we always take a copy
    // eslint-disable-next-line no-param-reassign
    params = {
      ...params,
      pubKey: getStoragePubKey(params.pubKey),
    };
  }
  const body = {
    jsonrpc: '2.0',
    id: '0',
    method,
    params,
  };

  const fetchOptions = {
    method: 'POST',
    ...options,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  return lokiFetch(url, fetchOptions, targetNode);
};

module.exports = {
  lokiRpc,
};
