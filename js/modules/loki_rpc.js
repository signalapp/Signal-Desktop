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
  try {
    const ciphertext = await response.text();
    const plaintext = await libloki.crypto.snodeCipher.decrypt(
      address,
      ciphertext
    );
    const result = plaintext === '' ? {} : JSON.parse(plaintext);
    return result;
  } catch (e) {
    log.warn(`Could not decrypt response from ${address}`, e);
  }
  return {};
};

// TODO: Don't allow arbitrary URLs, only snodes and loki servers
const sendToProxy = async (options = {}, targetNode) => {
  const randSnode = await lokiSnodeAPI.getRandomSnodeAddress();

  const url = `https://${randSnode.ip}:${randSnode.port}/proxy`;

  log.info(
    `Proxy snode request to ${targetNode.pubkey_ed25519} via ${
      randSnode.pubkey_ed25519
    }`
  );

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

  const ciphertext = await response.text();

  const ciphertextBuffer = dcodeIO.ByteBuffer.wrap(
    ciphertext,
    'base64'
  ).toArrayBuffer();

  const plaintextBuffer = await window.libloki.crypto.DHDecrypt(
    symmetricKey,
    ciphertextBuffer
  );

  const textDecoder = new TextDecoder();
  const plaintext = textDecoder.decode(plaintextBuffer);

  const jsonRes = JSON.parse(plaintext);

  jsonRes.json = () => JSON.parse(jsonRes.body);

  return jsonRes;
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
      return result.json();
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
