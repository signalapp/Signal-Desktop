/* global log, dcodeIO, window, callWorker */

const fetch = require('node-fetch');
const is = require('@sindresorhus/is');

class LokiServer {

  constructor({ urls, messageServerPort, swarmServerPort }) {
    this.nodes = [];
    this.messageServerPort = messageServerPort;
    this.swarmServerPort = swarmServerPort;
    urls.forEach(url => {
      if (!is.string(url)) {
        throw new Error('WebAPI.initialize: Invalid server url');
      }
      this.nodes.push({ url });
    });
  }

  async loadOurSwarm() {
    const ourKey = window.textsecure.storage.user.getNumber();
    const nodeAddresses = await this.getSwarmNodes(ourKey);
    this.ourSwarmNodes = [];
    nodeAddresses.forEach(url => {
      this.ourSwarmNodes.push({ url });
    })
  }

  async getSwarmNodes(pubKey) {
    const currentNode = this.nodes[0];

    const options = {
      url: `${currentNode.url}${this.swarmServerPort}/json_rpc`,
      type: 'POST',
      responseType: 'json',
      timeout: undefined,
    };

    const body = {
      jsonrpc: '2.0',
      id: '0',
      method: 'get_swarm_list_for_messenger_pubkey',
      params: {
        pubkey: pubKey,
      },
    }

    const fetchOptions = {
      method: options.type,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
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
      return result.nodes;
    }
    log.error(options.type, options.url, response.status, 'Error');
    throw HTTPError('sendMessage: error response', response.status, result);
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl) {
    const swarmNodes = await window.Signal.Data.getSwarmNodesByPubkey(pubKey);
    if (!swarmNodes || swarmNodes.length === 0) {
      // TODO: Refresh the swarm nodes list
      throw Error('No swarm nodes to query!');
    }

    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');
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
      url: `${swarmNodes[0]}${this.messageServerPort}/store`,
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
    if (!this.ourSwarmNodes || this.ourSwarmNodes.length === 0) {
      await this.loadOurSwarm();
    }
    const currentNode = this.ourSwarmNodes[0];
    const options = {
      url: `${currentNode.url}${this.messageServerPort}/retrieve`,
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
