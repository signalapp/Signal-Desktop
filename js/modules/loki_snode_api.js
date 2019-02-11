/* eslint-disable class-methods-use-this */
/* global log, window, ConversationController */

const fetch = require('node-fetch');
const is = require('@sindresorhus/is');
const dns = require('dns');

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SWARM_NODES = 1;
const FAILURE_THRESHOLD = 3;

class LokiSnodeAPI {
  constructor({ url, swarmServerPort }) {
    if (!is.string(url)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.url = url;
    this.swarmServerPort = swarmServerPort ? `:${swarmServerPort}` : '';
    this.swarmsPendingReplenish = {};
    this.ourSwarmNodes = {};
    this.contactSwarmNodes = {};
  }

  getRandomSnodeAddress() {
    /* resolve random snode */
    return new Promise((resolve, reject) => {
      dns.resolveCname(this.url, (err, address) => {
        if (err) {
          reject(err);
        } else {
          resolve(address[0]);
        }
      });
    });
  }

  async unreachableNode(pubKey, nodeUrl) {
    if (pubKey === window.textsecure.storage.user.getNumber()) {
      if (!this.ourSwarmNodes[nodeUrl]) {
        this.ourSwarmNodes[nodeUrl] = {
          failureCount: 1,
        };
      } else {
        this.ourSwarmNodes[nodeUrl].failureCount += 1;
      }
      if (this.ourSwarmNodes[nodeUrl].failureCount >= FAILURE_THRESHOLD) {
        delete this.ourSwarmNodes[nodeUrl];
      }
      return false;
    }
    if (!this.contactSwarmNodes[nodeUrl]) {
      this.contactSwarmNodes[nodeUrl] = {
        failureCount: 1,
      };
    } else {
      this.contactSwarmNodes[nodeUrl].failureCount += 1;
    }
    if (this.contactSwarmNodes[nodeUrl].failureCount < FAILURE_THRESHOLD) {
      return false;
    }
    const conversation = ConversationController.get(pubKey);
    const swarmNodes = conversation.get('swarmNodes');
    if (swarmNodes.delete(nodeUrl)) {
      await conversation.updateSwarmNodes(swarmNodes);
      delete this.contactSwarmNodes[nodeUrl];
    }
    return true;
  }

  updateLastHash(nodeUrl, hash) {
    if (!this.ourSwarmNodes[nodeUrl]) {
      this.ourSwarmNodes[nodeUrl] = {
        lastHash: hash,
      };
    } else {
      this.ourSwarmNodes[nodeUrl].lastHash = hash;
    }
  }

  async getSwarmNodesForPubKey(pubKey) {
    let conversation;
    let swarmNodes;
    try {
      conversation = ConversationController.get(pubKey);
      swarmNodes = conversation.get('swarmNodes');
    } catch (e) {
      throw new window.textsecure.ReplayableError({
        message: 'Could not get conversation',
      });
    }
    return swarmNodes;
  }

  async updateSwarmNodes(pubKey, newNodes) {
    let conversation;
    try {
      conversation = ConversationController.get(pubKey);
    } catch (e) {
      throw new window.textsecure.ReplayableError({
        message: 'Could not get conversation',
      });
    }
    await conversation.updateSwarmNodes(newNodes);
  }

  async getOurSwarmNodes() {
    if (
      !this.ourSwarmNodes ||
      Object.keys(this.ourSwarmNodes).length < MINIMUM_SWARM_NODES
    ) {
      this.ourSwarmNodes = {};
      // Try refresh our swarm list once
      const ourKey = window.textsecure.storage.user.getNumber();
      const nodeAddresses = await this.getSwarmNodes(ourKey);
      if (!nodeAddresses || nodeAddresses.length === 0) {
        throw Error('Could not load our swarm');
      }

      nodeAddresses.forEach(url => {
        this.ourSwarmNodes[url] = {
          failureCount: 0,
        };
      });
    }
    return { ...this.ourSwarmNodes };
  }

  async refreshSwarmNodesForPubKey(pubKey) {
    const newNodes = await this.getFreshSwarmNodes(pubKey);
    try {
      const conversation = ConversationController.get(pubKey);
      await conversation.updateSwarmNodes(newNodes);
    } catch (e) {
      throw e;
    }
  }

  async getFreshSwarmNodes(pubKey) {
    if (!(pubKey in this.swarmsPendingReplenish)) {
      this.swarmsPendingReplenish[pubKey] = new Promise(async resolve => {
        let newSwarmNodes;
        try {
          newSwarmNodes = await this.getSwarmNodes(pubKey);
        } catch (e) {
          // TODO: Handle these errors sensibly
          newSwarmNodes = [];
        }
        resolve(newSwarmNodes);
      });
    }
    const newSwarmNodes = await this.swarmsPendingReplenish[pubKey];
    delete this.swarmsPendingReplenish[pubKey];
    return newSwarmNodes;
  }

  async getSwarmNodes(pubKey) {
    // TODO: Hit multiple random nodes and merge lists?
    const node = await this.getRandomSnodeAddress();
    // TODO: Confirm final API URL and sensible timeout
    const options = {
      url: `http://${node}${this.swarmServerPort}/json_rpc`,
      type: 'POST',
      responseType: 'json',
      timeout: 10000,
    };

    const body = {
      jsonrpc: '2.0',
      id: '0',
      method: 'get_swarm_list_for_messenger_pubkey',
      params: {
        pubkey: pubKey,
      },
    };

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
      log.error(
        options.type,
        options.url,
        0,
        `Error getting swarm nodes for ${pubKey}`
      );
      throw HTTPError('getSwarmNodes fetch error', 0, e.toString());
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
    log.error(
      options.type,
      options.url,
      response.status,
      `Error getting swarm nodes for ${pubKey}`
    );
    throw HTTPError('getSwarmNodes: error response', response.status, result);
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

module.exports = LokiSnodeAPI;
