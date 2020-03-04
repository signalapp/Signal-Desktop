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

const sendToProxy = async (options = {}, targetNode) => {
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
  };

  // we only proxy to snodes...
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  const response = await nodeFetch(url, firstHopOptions);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;

  // detect SNode is not ready (not in swarm; not done syncing)
  if (response.status === 503) {
    const ciphertext = await response.text();
    log.error(
      `lokiRpc sendToProxy snode ${randSnode.ip}:${randSnode.port} error`,
      ciphertext
    );
    // mark as bad for this round (should give it some time and improve success rates)
    lokiSnodeAPI.markRandomNodeUnreachable(randSnode);
    // retry for a new working snode
    return sendToProxy(options, targetNode);
  }

  // FIXME: handle nodeFetch errors/exceptions...
  if (response.status !== 200) {
    // let us know we need to create handlers for new unhandled codes
    log.warn('lokiRpc sendToProxy fetch non-200 statusCode', response.status);
  }

  const ciphertext = await response.text();
  if (!ciphertext) {
    // avoid base64 decode failure
    log.warn('Server did not return any data for', options);
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
      `from ${randSnode.ip}:${randSnode.port} ciphertext:`,
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
  if (url.match(/https:\/\//)) {
    fetchOptions.agent = snodeHttpsAgent;
  }

  try {
    if (window.lokiFeatureFlags.useSnodeProxy && targetNode) {
      const result = await sendToProxy(fetchOptions, targetNode);
      return result ? result.json() : false;
    }

    if (url.match(/https:\/\//)) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    }
    const response = await nodeFetch(url, fetchOptions);
    // restore TLS checking
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;

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
