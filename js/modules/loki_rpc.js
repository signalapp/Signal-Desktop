/* global log, libloki, textsecure, getStoragePubKey, lokiSnodeAPI, StringView,
  libsignal, window, TextDecoder, TextEncoder, dcodeIO, process */

const nodeFetch = require('node-fetch');
const https = require('https');
const { parse } = require('url');

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const LOKI_EPHEMKEY_HEADER = 'X-Loki-EphemKey';
const endpointBase = '/storage_rpc/v1';

const decryptResponse = async (response, address) => {
  let plaintext = false;
  try {
    const ciphertext = await response.text();
    plaintext = await libloki.crypto.snodeCipher.decrypt(address, ciphertext);
    const result = plaintext === '' ? {} : JSON.parse(plaintext);
    return result;
  } catch (e) {
    log.warn(
      `Could not decrypt response [${plaintext}] from [${address}],`,
      e.code,
      e.message
    );
  }
  return {};
};

const timeoutDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendToProxy = async (options = {}, targetNode, retryNumber = 0) => {
  const randSnode = await lokiSnodeAPI.getRandomSnodeAddress();

  // Don't allow arbitrary URLs, only snodes and loki servers
  const url = `https://${randSnode.ip}:${randSnode.port}/proxy`;

  const snPubkeyHex = StringView.hexToArrayBuffer(targetNode.pubkey_x25519);

  const myKeys = window.libloki.crypto.snodeCipher._ephemeralKeyPair;

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
    const randomPoolRemainingCount = lokiSnodeAPI.markRandomNodeUnreachable(randSnode);
    log.warn(
      `lokiRpc sendToProxy`,
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`,
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
    const ciphertext = await response.text();
    // we shouldn't do these,
    // it's seems to be not the random node that's always bad
    // but the target node

    // we got a ton of randomPool nodes, let's just not worry about this one
    const randomPoolRemainingCount = lokiSnodeAPI.markRandomNodeUnreachable(randSnode);
    log.warn(
      `lokiRpc sendToProxy`,
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`,
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
      'lokiRpc sendToProxy fetch non-200 statusCode',
      response.status,
      `from snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`
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
      'lokiRpc sendToProxy decode error',
      e.code,
      e.message,
      `from ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port} ciphertext:`,
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
          'lokiRpc sendToProxy parse error',
          e.code,
          e.message,
          `from ${randSnode.ip}:${randSnode.port} json:`,
          jsonRes.body
        );
      }
      return false;
    };
    if (retryNumber) {
      log.info(`lokiRpc sendToProxy request succeeded,`,
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`,
      `on retry #${retryNumber}`);
    }
    return jsonRes;
  } catch (e) {
    log.error(
      'lokiRpc sendToProxy parse error',
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

  const address = parse(url).hostname;
  // const doEncryptChannel = address.endsWith('.snode');
  const doEncryptChannel = false; // ENCRYPTION DISABLED
  if (doEncryptChannel) {
    try {
      // eslint-disable-next-line no-param-reassign
      options.body = await libloki.crypto.snodeCipher.encrypt(
        address,
        options.body
      );
      // eslint-disable-next-line no-param-reassign
      options.headers = {
        ...options.headers,
        'Content-Type': 'text/plain',
        [LOKI_EPHEMKEY_HEADER]: libloki.crypto.snodeCipher.getChannelPublicKeyHex(),
      };
    } catch (e) {
      log.warn(`Could not encrypt channel for ${address}: `, e);
    }
  }

  const fetchOptions = {
    ...options,
    timeout,
    method,
  };

  try {
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
      log.info ('lokiRpc http communication', url);
    }
    const response = await nodeFetch(url, fetchOptions);
    // restore TLS checking
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    let result;
    // Wrong swarm
    if (response.status === 421) {
      if (doEncryptChannel) {
        result = decryptResponse(response, address);
      } else {
        result = await response.json();
      }
      const newSwarm = result.snodes ? result.snodes : [];
      throw new textsecure.WrongSwarmError(newSwarm);
    }

    // Wrong PoW difficulty
    if (response.status === 432) {
      if (doEncryptChannel) {
        result = decryptResponse(response, address);
      } else {
        result = await response.json();
      }
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
    } else if (doEncryptChannel) {
      result = decryptResponse(response, address);
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
