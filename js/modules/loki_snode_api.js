/* global log, window, Whisper */

const fetch = require('node-fetch');
const is = require('@sindresorhus/is');
const dns = require('dns');

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SWARM_NODES = 1;

class LokiSnodeAPI {

  constructor({ url, swarmServerPort }) {
    if (!is.string(url)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.url = url;
    this.swarmServerPort = swarmServerPort
      ? `:${swarmServerPort}`
      : '';
    this.swarmsPendingReplenish = {};
    this.ourSwarmNodes = {};
  }

  getRandomSnodeAddress() {
    /* resolve random snode */
    return new Promise((resolve, reject) => {
      dns.resolveCname(this.url, (err, address) => {
        if(err) {
          reject(err);
        } else {
          resolve(address[0]);
        }
      });
    });
  }

  unreachableNode(pubKey, nodeUrl) {
    if (pubKey === window.textsecure.storage.user.getNumber()) {
      delete this.ourSwarmNodes[nodeUrl];
    }
  }

  updateLastHash(nodeUrl, hash) {
    if (!this.ourSwarmNodes[nodeUrl]) {
      this.ourSwarmNodes[nodeUrl] = {
        lastHash: hash,
      }
    } else {
      this.ourSwarmNodes[nodeUrl].lastHash = hash;
    }
  }

  async getOurSwarmNodes() {
    if (
      !this.ourSwarmNodes ||
      Object.keys(this.ourSwarmNodes).length < MINIMUM_SWARM_NODES
    ) {
      // Try refresh our swarm list once
      const ourKey = window.textsecure.storage.user.getNumber();
      const nodeAddresses = await window.LokiSnodeAPI.getSwarmNodes(ourKey);

      this.ourSwarmNodes = {};
      nodeAddresses.forEach(url => {
        this.ourSwarmNodes[url] = {};
      })
      if (!this.ourSwarmNodes || Object.keys(this.ourSwarmNodes).length === 0) {
        throw Error('Could not load our swarm')
      }
    }
    return this.ourSwarmNodes;
  }

  async getSwarmNodesByPubkey(pubKey) {
    const swarmNodes = await window.Signal.Data.getSwarmNodesByPubkey(pubKey);
    // TODO: Check if swarm list is below a threshold rather than empty
    if (swarmNodes && swarmNodes.length !== 0) {
      return swarmNodes;
    }
    return this.replenishSwarm(pubKey);
  }

  async replenishSwarm(pubKey) {
    const conversation = window.ConversationController.get(pubKey);
    if (!(pubKey in this.swarmsPendingReplenish)) {
      this.swarmsPendingReplenish[pubKey] = new Promise(async (resolve) => {
        const newSwarmNodes = await this.getSwarmNodes(pubKey);
        conversation.set({ swarmNodes: newSwarmNodes });
        await window.Signal.Data.updateConversation(conversation.id, conversation.attributes, {
          Conversation: Whisper.Conversation,
        });
        resolve(newSwarmNodes);
      });
    }
    const newSwarmNodes = await this.swarmsPendingReplenish[pubKey];
    delete this.swarmsPendingReplenish[pubKey];
    return newSwarmNodes;
  }

  async getSwarmNodes(pubKey) {
    const node = await this.getRandomSnodeAddress();
    const options = {
      url: `http://${node}${this.swarmServerPort}/json_rpc`,
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
      log.error(options.type, options.url, 0, `Error getting swarm nodes for ${pubKey}`);
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
    log.error(options.type, options.url, response.status, `Error getting swarm nodes for ${pubKey}`);
    throw HTTPError('sendMessage: error response', response.status, result);
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
  LokiSnodeAPI,
};
