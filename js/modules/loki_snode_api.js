/* eslint-disable class-methods-use-this */
/* global window, ConversationController, _, log */

const is = require('@sindresorhus/is');
const { lokiRpc } = require('./loki_rpc');

const RANDOM_SNODES_TO_USE = 3;

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl; // random.snode
    this.localUrl = localUrl; // localhost.loki
    this.randomSnodePool = [];
    this.swarmsPendingReplenish = {};
  }

  async getRandomSnodeAddress() {
    /* resolve random snode */
    if (this.randomSnodePool.length === 0) {
      // allow exceptions to pass through upwards
      await this.initialiseRandomPool();
    }
    if (this.randomSnodePool.length === 0) {
      throw new window.textsecure.SeedNodeError('Invalid seed node response');
    }
    return this.randomSnodePool[
      Math.floor(Math.random() * this.randomSnodePool.length)
    ];
  }

  async initialiseRandomPool(
    seedNodes = [...window.seedNodeList],
    consecutiveErrors = 0
  ) {
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
    let snodes = [];
    try {
      const response = await lokiRpc(
        `http://${seedNode.ip}`,
        seedNode.port,
        'get_n_service_nodes',
        params,
        {}, // Options
        '/json_rpc' // Seed request endpoint
      );
      // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
      snodes = response.result.service_node_states.filter(
        snode => snode.public_ip !== '0.0.0.0'
      );
      this.randomSnodePool = snodes.map(snode => ({
        ip: snode.public_ip,
        port: snode.storage_port,
        pubkey_x25519: snode.pubkey_x25519,
        pubkey_ed25519: snode.pubkey_ed25519,
      }));
    } catch (e) {
      log.warn('initialiseRandomPool error', e.code, e.message);
      if (consecutiveErrors < 3) {
        // retry after a possible delay
        setTimeout(() => {
          log.info(
            'Retrying initialising random snode pool, try #',
            consecutiveErrors
          );
          this.initialiseRandomPool(seedNodes, consecutiveErrors + 1);
        }, consecutiveErrors * consecutiveErrors * 5000);
      } else {
        log.error('Giving up trying to contact seed node');
        if (snodes.length === 0) {
          throw new window.textsecure.SeedNodeError(
            'Failed to contact seed node'
          );
        }
      }
    }
  }

  // nodeUrl is like 9hrje1bymy7hu6nmtjme9idyu3rm8gr3mkstakjyuw1997t7w4ny.snode
  async unreachableNode(pubKey, nodeUrl) {
    const conversation = ConversationController.get(pubKey);
    const swarmNodes = [...conversation.get('swarmNodes')];
    const filteredNodes = swarmNodes.filter(
      node => node.address !== nodeUrl && node.ip !== nodeUrl
    );
    await conversation.updateSwarmNodes(filteredNodes);
  }

  markRandomNodeUnreachable(snode) {
    this.randomSnodePool = _.without(
      this.randomSnodePool,
      _.find(this.randomSnodePool, { ip: snode.ip, port: snode.port })
    );
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
      return filteredNodes;
    } catch (e) {
      throw new window.textsecure.ReplayableError({
        message: 'Could not get conversation',
      });
    }
  }

  async refreshSwarmNodesForPubKey(pubKey) {
    const newNodes = await this.getFreshSwarmNodes(pubKey);
    const filteredNodes = this.updateSwarmNodes(pubKey, newNodes);
    return filteredNodes;
  }

  async getFreshSwarmNodes(pubKey) {
    if (!(pubKey in this.swarmsPendingReplenish)) {
      this.swarmsPendingReplenish[pubKey] = new Promise(async resolve => {
        let newSwarmNodes;
        try {
          newSwarmNodes = await this.getSwarmNodes(pubKey);
        } catch (e) {
          log.error('getFreshSwarmNodes error', e.code, e.message);
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

  async getSnodesForPubkey(snode, pubKey) {
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
      if (!result) {
        log.warn(
          `getSnodesForPubkey lokiRpc on ${snode.ip}:${
            snode.port
          } returned falsish value`,
          result
        );
        return [];
      }
      const snodes = result.snodes.filter(tSnode => tSnode.ip !== '0.0.0.0');
      return snodes;
    } catch (e) {
      log.error(
        'getSnodesForPubkey error',
        e.code,
        e.message,
        `for ${snode.ip}:${snode.port}`
      );
      this.markRandomNodeUnreachable(snode);
      return [];
    }
  }

  async getSwarmNodes(pubKey) {
    const snodes = [];
    const questions = [...Array(RANDOM_SNODES_TO_USE).keys()];
    await Promise.all(
      questions.map(async () => {
        // allow exceptions to pass through upwards
        const rSnode = await this.getRandomSnodeAddress();
        const resList = await this.getSnodesForPubkey(rSnode, pubKey);
        // should we only activate entries that are in all results?
        resList.map(item => {
          const hasItem = snodes.some(
            hItem => item.ip === hItem.ip && item.port === hItem.port
          );
          if (!hasItem) {
            snodes.push(item);
          }
          return true;
        });
      })
    );
    return snodes;
  }
}

module.exports = LokiSnodeAPI;
