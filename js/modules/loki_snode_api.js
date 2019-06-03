/* eslint-disable class-methods-use-this */
/* global window, ConversationController */

const is = require('@sindresorhus/is');
const dns = require('dns');
const process = require('process');
const { rpc } = require('./loki_rpc');

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SWARM_NODES = 1;

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
  constructor({ serverUrl, localUrl, snodeServerPort }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl;
    this.localUrl = localUrl;
    this.snodeServerPort = snodeServerPort ? `:${snodeServerPort}` : '';
    this.swarmsPendingReplenish = {};
    this.ourSwarmNodes = {};
    this.contactSwarmNodes = {};
    // When we package lokinet with messenger we can ensure this ip is correct
    if (process.platform === 'win32') {
      dns.setServers(['127.0.0.1']);
    }
  }

  async getMyLokiIp() {
    try {
      const address = await resolveCname(this.localUrl);
      return resolve4(address);
    } catch (e) {
      throw new window.textsecure.LokiIpError(
        'Failed to resolve localhost.loki',
        e
      );
    }
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
      delete this.ourSwarmNodes[nodeUrl];
      return;
    }

    const conversation = ConversationController.get(pubKey);
    const swarmNodes = [...conversation.get('swarmNodes')];
    if (swarmNodes.includes(nodeUrl)) {
      const filteredNodes = swarmNodes.filter(node => node !== nodeUrl);
      await conversation.updateSwarmNodes(filteredNodes);
      delete this.contactSwarmNodes[nodeUrl];
    }
  }

  async updateLastHash(nodeUrl, lastHash, expiresAt) {
    await window.Signal.Data.updateLastHash({ nodeUrl, lastHash, expiresAt });
    if (!this.ourSwarmNodes[nodeUrl]) {
      this.ourSwarmNodes[nodeUrl] = {
        lastHash,
      };
    } else {
      this.ourSwarmNodes[nodeUrl].lastHash = lastHash;
    }
  }

  getSwarmNodesForPubKey(pubKey) {
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

  async updateOurSwarmNodes(newNodes) {
    this.ourSwarmNodes = {};
    const ps = newNodes.map(async url => {
      const lastHash = await window.Signal.Data.getLastHashBySnode(url);
      this.ourSwarmNodes[url] = {
        lastHash,
      };
    });
    await Promise.all(ps);
  }

  async getOurSwarmNodes() {
    if (
      !this.ourSwarmNodes ||
      Object.keys(this.ourSwarmNodes).length < MINIMUM_SWARM_NODES
    ) {
      const ourKey = window.textsecure.storage.user.getNumber();
      const nodeAddresses = await this.getSwarmNodes(ourKey);
      await this.updateOurSwarmNodes(nodeAddresses);
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
    const nodeUrl = await this.getRandomSnodeAddress();

    const result = await rpc(
      `http://${nodeUrl}`,
      this.snodeServerPort,
      'get_snodes_for_pubkey',
      {
        pubKey,
      }
    );
    return result.snodes;
  }
}

module.exports = LokiSnodeAPI;
