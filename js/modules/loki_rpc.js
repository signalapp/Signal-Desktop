/* global log, libloki, textsecure */

const nodeFetch = require('node-fetch');
const { parse } = require('url');

const LOKI_EPHEMKEY_HEADER = 'X-Loki-EphemKey';
const endpointBase = '/v1/storage_rpc';
const seedEndpointBase = '/json_rpc';

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

// A small wrapper around node-fetch which deserializes response
const fetch = async (url, options = {}) => {
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

  try {
    const response = await nodeFetch(url, {
      ...options,
      timeout,
      method,
    });

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
const rpc = (
  address,
  port,
  method,
  params,
  options = {},
  seedRequest = false
) => {
  const headers = options.headers || {};
  const portString = port ? `:${port}` : '';
  const endpoint = seedRequest ? seedEndpointBase : endpointBase;
  const url = `${address}${portString}${endpoint}`;
  // TODO: The jsonrpc and body field will be ignored on storage server
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

  return fetch(url, fetchOptions);
};

module.exports = {
  rpc,
};
