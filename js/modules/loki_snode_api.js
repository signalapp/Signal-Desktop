/* eslint-disable class-methods-use-this */
/* global window, ConversationController, _ */

const is = require('@sindresorhus/is');
const dns = require('dns');
const process = require('process');
const { rpc } = require('./loki_rpc');

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
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl;
    this.localUrl = localUrl;
    this.randomSnodePool = [];
    this.swarmsPendingReplenish = {};
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

  getMyLokiAddress() {
    /* resolve our local loki address */
    return resolveCname(this.localUrl);
  }

  async getRandomSnodeAddress() {
    /* resolve random snode */
    if (this.randomSnodePool.length === 0) {
      await this.initialiseRandomPool();
    }
    if (this.randomSnodePool.length === 0) {
      throw new window.textsecure.SeedNodeError('Invalid seed node response');
    }
    return this.randomSnodePool[
      Math.floor(Math.random() * this.randomSnodePool.length)
    ];
  }

  async initialiseRandomPool() {
    const params = {
      limit: 20,
      fields: {
        public_ip: true,
        storage_port: true,
      },
    };
    try {
      const result = await rpc(
        `http://${window.seedNodeUrl}`,
        window.seedNodePort,
        'get_n_service_nodes',
        params,
        {}, // Options
        '/json_rpc' // Seed request endpoint
      );
      // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
      const snodes = result.result.service_node_states.filter(
        snode => snode.public_ip !== '0.0.0.0'
      );
      this.randomSnodePool = snodes.map(snode => ({
        ip: snode.public_ip,
        port: snode.storage_port,
      }));
    } catch (e) {
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
  }

  async unreachableNode(pubKey, nodeUrl) {
    const conversation = ConversationController.get(pubKey);
    const swarmNodes = [...conversation.get('swarmNodes')];
    const filteredNodes = swarmNodes.filter(node => node.address !== nodeUrl);
    await conversation.updateSwarmNodes(filteredNodes);
  }

  async updateLastHash(nodeUrl, lastHash, expiresAt) {
    await window.Signal.Data.updateLastHash({ nodeUrl, lastHash, expiresAt });
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
    const { ip, port } = await this.getRandomSnodeAddress();
    try {
      const result = await rpc(`https://${ip}`, port, 'get_snodes_for_pubkey', {
        pubKey,
      });
      const snodes = result.snodes.filter(snode => snode.ip !== '0.0.0.0');
      return snodes;
    } catch (e) {
      this.randomSnodePool = _.without(
        this.randomSnodePool,
        _.find(this.randomSnodePool, { ip })
      );
      return this.getSwarmNodes(pubKey);
    }
  }
}

module.exports = LokiSnodeAPI;
