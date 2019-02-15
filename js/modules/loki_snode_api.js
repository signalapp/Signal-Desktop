/* eslint-disable class-methods-use-this */
/* global log, window, ConversationController */

const fetch = require('node-fetch');
const is = require('@sindresorhus/is');
const dns = require('dns');

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SWARM_NODES = 1;
const FAILURE_THRESHOLD = 3;

const resolve4 = url =>
  new Promise((resolve, reject) => {
    dns.resolve4(url, (err, ip) => {
      if (err) {
        reject(err);
      } else {
        resolve(ip);
      }
    });
  });

const resolveCname = url =>
  new Promise((resolve, reject) => {
    dns.resolveCname(url, (err, address) => {
      if (err) {
        reject(err);
      } else {
        resolve(address[0]);
      }
    });
  });

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl, swarmServerPort }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl;
    this.localUrl = localUrl;
    this.swarmServerPort = swarmServerPort ? `:${swarmServerPort}` : '';
    this.swarmsPendingReplenish = {};
    this.ourSwarmNodes = {};
    this.contactSwarmNodes = {};
  }

  async getMyLokiIp() {
    const address = await resolveCname(this.localUrl);
    return resolve4(address);
  }

  async getMyLokiAddress() {
    /* resolve our local loki address */
    return resolveCname(this.localUrl);
  }

  getRandomSnodeAddress() {
    /* resolve random snode */
    return resolveCname(this.serverUrl);
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
      if (this.ourSwarmNodes[nodeUrl].failureCount < FAILURE_THRESHOLD) {
        return false;
      }
      delete this.ourSwarmNodes[nodeUrl];
      return true;
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
    const swarmNodes = [...conversation.get('swarmNodes')];
    if (swarmNodes.includes(nodeUrl)) {
      const filteredNodes = swarmNodes.filter(node => node !== nodeUrl);
      await conversation.updateSwarmNodes(filteredNodes);
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
    try {
      const conversation = ConversationController.get(pubKey);
      const swarmNodes = [...conversation.get('swarmNodes')];
      return swarmNodes;
    } catch (e) {
      throw new window.textsecure.ReplayableError({
        message: 'Could not get conversation',
      });
    }
  }

  async updateSwarmNodes(pubKey, newNodes) {
    try {
      const conversation = ConversationController.get(pubKey);
      await conversation.updateSwarmNodes(newNodes);
    } catch (e) {
      throw new window.textsecure.ReplayableError({
        message: 'Could not get conversation',
      });
    }
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
    this.updateSwarmNodes(pubKey, newNodes);
  }

  async getFreshSwarmNodes(pubKey) {
    if (!(pubKey in this.swarmsPendingReplenish)) {
      this.swarmsPendingReplenish[pubKey] = new Promise(async resolve => {
        let newSwarmNodes;
        try {
          newSwarmNodes = await this.getSwarmNodes(pubKey);
        } catch (e) {
          // TODO: Handle these errors sensibly
          log.error(e);
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
