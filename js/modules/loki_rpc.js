/* global log, libloki, textsecure */

const nodeFetch = require('node-fetch');
const { parse } = require('url');

const LOKI_EPHEMKEY_HEADER = 'X-Loki-EphemKey';
const endpointBase = '/v1/storage_rpc';

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

    if (response.status === 421) {
      let newSwarm = await response.text();
      if (doEncryptChannel) {
        try {
          newSwarm = await libloki.crypto.snodeCipher.decrypt(
            address,
            newSwarm
          );
        } catch (e) {
          log.warn(`Could not decrypt response from ${address}`, e);
        }
        try {
          newSwarm = newSwarm === '' ? {} : JSON.parse(newSwarm);
        } catch (e) {
          log.warn(`Could not parse string to json ${newSwarm}`, e);
        }
      }
      throw new textsecure.WrongSwarmError(newSwarm);
    }

    if (!response.ok) {
      throw new textsecure.HTTPError('Loki_rpc error', response);
    }

    let result;
    if (response.headers.get('Content-Type') === 'application/json') {
      result = await response.json();
    } else if (options.responseType === 'arraybuffer') {
      result = await response.buffer();
    } else {
      result = await response.text();
      if (doEncryptChannel) {
        try {
          result = await libloki.crypto.snodeCipher.decrypt(address, result);
        } catch (e) {
          log.warn(`Could not decrypt response from ${address}`, e);
        }
        try {
          result = result === '' ? {} : JSON.parse(result);
        } catch (e) {
          log.warn(`Could not parse string to json ${result}`, e);
        }
      }
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
const rpc = (address, port, method, params, options = {}) => {
  const headers = options.headers || {};
  const url = `${address}${port}${endpointBase}`;
  const body = {
    method,
    params,
  };

  const fetchOptions = {
    method: 'POST',
    ...options,
    body: JSON.stringify(body),
    headers,
  };

  return fetch(url, fetchOptions);
};

module.exports = {
  rpc,
};
