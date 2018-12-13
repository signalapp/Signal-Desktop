/* global log, dcodeIO, window, callWorker */

const fetch = require('node-fetch');
const is = require('@sindresorhus/is');

class LokiServer {

  constructor({ urls }) {
    this.nodes = [];
    urls.forEach(url => {
      if (!is.string(url)) {
        throw new Error('WebAPI.initialize: Invalid server url');
      }
      this.nodes.push({ url });
    });
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl) {
    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');
    // Hardcoded to use a single node/server for now
    const currentNode = this.nodes[0];

    const timestamp = Math.floor(Date.now() / 1000);
    // Nonce is returned as a base64 string to include in header
    let nonce;
    try {
      window.Whisper.events.trigger('calculatingPoW', {
        pubKey,
        timestamp: messageTimeStamp,
      });
      const development = window.getEnvironment() !== 'production';
      nonce = await callWorker('calcPoW', timestamp, ttl, pubKey, data64, development);
    } catch (err) {
      // Something went horribly wrong
      // TODO: Handle gracefully
      throw err;
    }

    const options = {
      url: `${currentNode.url}/store`,
      type: 'POST',
      responseType: undefined,
      timeout: undefined,
    };

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
      return result;
    }
    log.error(options.type, options.url, response.status, 'Error');
    throw HTTPError('sendMessage: error response', response.status, result);
  }

  async retrieveMessages(pubKey) {
    // Hardcoded to use a single node/server for now
    const currentNode = this.nodes[0];

    const options = {
      url: `${currentNode.url}/retrieve`,
      type: 'GET',
      responseType: 'json',
      timeout: undefined,
    };

    const headers = {
      'X-Loki-recipient': pubKey,
    };

    if (currentNode.lastHash) {
      headers['X-Loki-last-hash'] = currentNode.lastHash;
    }

    const fetchOptions = {
      method: options.type,
      headers,
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
      if (result.lastHash) {
        currentNode.lastHash = result.lastHash;
      }
      return result;
    }
    log.error(options.type, options.url, response.status, 'Error');
    throw HTTPError('retrieveMessages: error response', response.status, result);
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

module.exports = {
  LokiServer,
};
