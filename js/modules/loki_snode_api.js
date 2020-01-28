/* eslint-disable class-methods-use-this */
/* global window, ConversationController, _, log */

const is = require('@sindresorhus/is');
const { lokiRpc } = require('./loki_rpc');

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl;
    this.localUrl = localUrl;
    this.randomSnodePool = [];
    this.swarmsPendingReplenish = {};
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

  async initialiseRandomPool(seedNodes = [...window.seedNodeList]) {
    const params = {
      limit: 20,
      active_only: true,
      fields: {
        public_ip: true,
        storage_port: true,
        pubkey_x25519: true,
        pubkey_ed25519: true,
      },
    };
    const seedNode = seedNodes.splice(
      Math.floor(Math.random() * seedNodes.length),
      1
    )[0];
    try {
      const result = await lokiRpc(
        `http://${seedNode.ip}`,
        seedNode.port,
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
        pubkey_x25519: snode.pubkey_x25519,
        pubkey_ed25519: snode.pubkey_ed25519,
      }));
    } catch (e) {
      log.warn('initialiseRandomPool error', JSON.stringify(e));
      window.mixpanel.track('Seed Node Failed');
      if (seedNodes.length === 0) {
        throw new window.textsecure.SeedNodeError(
          'Failed to contact seed node'
        );
      }
      this.initialiseRandomPool(seedNodes);
    }
  }

  async unreachableNode(pubKey, nodeUrl) {
    const conversation = ConversationController.get(pubKey);
    const swarmNodes = [...conversation.get('swarmNodes')];
    const filteredNodes = swarmNodes.filter(
      node => node.address !== nodeUrl && node.ip !== nodeUrl
    );
    window.mixpanel.track('Unreachable Snode');
    await conversation.updateSwarmNodes(filteredNodes);
  }

  async updateLastHash(snode, hash, expiresAt) {
    await window.Signal.Data.updateLastHash({ snode, hash, expiresAt });
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
      const filteredNodes = newNodes.filter(snode => snode.ip !== '0.0.0.0');
      const conversation = ConversationController.get(pubKey);
      await conversation.updateSwarmNodes(filteredNodes);
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
    const snode = await this.getRandomSnodeAddress();
    try {
      const result = await lokiRpc(
        `https://${snode.ip}`,
        snode.port,
        'get_snodes_for_pubkey',
        {
          pubKey,
        },
        {},
        '/storage_rpc/v1',
        snode
      );
      const snodes = result.snodes.filter(tSnode => tSnode.ip !== '0.0.0.0');
      return snodes;
    } catch (e) {
      log.error('getSwarmNodes', JSON.stringify(e));
      //
      this.randomSnodePool = _.without(
        this.randomSnodePool,
        _.find(this.randomSnodePool, { ip: snode.ip })
      );
      return this.getSwarmNodes(pubKey);
    }
  }
}

module.exports = LokiSnodeAPI;
