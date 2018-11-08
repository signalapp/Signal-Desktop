/* global log, dcodeIO */

const fetch = require('node-fetch');
const is = require('@sindresorhus/is');
const { fork } = require('child_process');

module.exports = {
  initialize,
};

function initialize({ url }) {
  if (!is.string(url)) {
    throw new Error('WebAPI.initialize: Invalid server url');
  }

  return {
    connect,
  };

  function connect() {
    return {
      sendMessage,
      retrieveMessages,
    };

    function getPoWNonce(timestamp, ttl, pubKey, data) {
      return new Promise((resolve, reject) => {
        // Create forked node process to calculate PoW without blocking main process
        const child = fork('./libloki/proof-of-work.js');

        // Send data required for PoW to child process
        child.send({
          timestamp,
          ttl,
          pubKey,
          data,
        });

        // Handle child process error (should never happen)
        child.on('error', err => {
          reject(err);
        });

        // Callback to receive PoW result
        child.on('message', msg => {
          if (msg.err) {
            reject(msg.err);
          } else {
            child.kill();
            resolve(msg.nonce);
          }
        });
      });
    }

    async function retrieveMessages(pubKey) {
      const options = {
        url: `${url}/retrieve`,
        type: 'GET',
        responseType: 'json',
        timeout: undefined,
      };

      log.info(options.type, options.url);

      const fetchOptions = {
        method: options.type,
        headers: {
          'X-Loki-recipient': pubKey,
        },
        timeout: options.timeout,
      };

      let response;
      try {
        response = await fetch(options.url, fetchOptions);
      } catch (e) {
        log.error(options.type, options.url, 0, 'Error');
        throw HTTPError('fetch error', 0, e.toString());
      }

      let result;
      if (
        options.responseType === 'json' &&
        response.headers.get('Content-Type') === 'application/json'
      ) {
        result = await response.json();
      } else if (options.responseType === 'arraybuffer') {
        result = await response.buffer();
      } else {
        result = await response.text();
      }

      if (response.status >= 0 && response.status < 400) {
        log.info(options.type, options.url, response.status, 'Success');
        return result;
      }
      log.error(options.type, options.url, response.status, 'Error');
      throw HTTPError('retrieveMessages: error response', response.status, result);
    }

    async function sendMessage(pubKey, data, ttl) {
      const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');

      const timestamp = Math.floor(Date.now() / 1000);
      // Nonce is returned as a base64 string to include in header
      let nonce;
      try {
        nonce = await getPoWNonce(timestamp, ttl, pubKey, data64);
      } catch (err) {
        // Something went horribly wrong
        // TODO: Handle gracefully
        log.error('Error computing PoW');
      }

      const options = {
        url: `${url}/store`,
        type: 'POST',
        responseType: undefined,
        timeout: undefined,
      };

      log.info(options.type, options.url);

      const fetchOptions = {
        method: options.type,
        body: data64,
        headers: {
          'X-Loki-pow-nonce': nonce,
          'X-Loki-timestamp': timestamp.toString(),
          'X-Loki-ttl': ttl.toString(),
          'X-Loki-recipient': pubKey,
        },
        timeout: options.timeout,
      };

      let response;
      try {
        response = await fetch(options.url, fetchOptions);
      } catch (e) {
        log.error(options.type, options.url, 0, 'Error');
        throw HTTPError('fetch error', 0, e.toString());
      }

      let result;
      if (
        options.responseType === 'json' &&
        response.headers.get('Content-Type') === 'application/json'
      ) {
        result = await response.json();
      } else if (options.responseType === 'arraybuffer') {
        result = await response.buffer();
      } else {
        result = await response.text();
      }

      if (response.status >= 0 && response.status < 400) {
        log.info(options.type, options.url, response.status, 'Success');
        return result;
      }
      log.error(options.type, options.url, response.status, 'Error');
      throw HTTPError('sendMessage: error response', response.status, result);
    }
  }
}

function HTTPError(message, providedCode, response, stack) {
  const code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
  const e = new Error(`${message}; code: ${code}`);
  e.name = 'HTTPError';
  e.code = code;
  if (stack) {
    e.stack += `\nOriginal stack:\n${stack}`;
  }
  if (response) {
    e.response = response;
  }
  return e;
}
