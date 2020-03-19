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
    this.initialiseRandomPoolPromise = false;
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
    // if currently not in progress
    if (this.initialiseRandomPoolPromise === false) {
      // FIXME: add timeout
      // set lock
      this.initialiseRandomPoolPromise = new Promise(async resolve => {
        const params = {
          limit: 1024,
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
          log.info('loki_snodes: Refreshing random snode pool');
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
          log.info('loki_snodes: Refreshed random snode pool with', this.randomSnodePool.length, 'snodes');
        } catch (e) {
          log.warn('loki_snodes: initialiseRandomPool error', e.code, e.message);
          if (consecutiveErrors < 3) {
            // retry after a possible delay
            setTimeout(() => {
              log.info(
                'loki_snodes: Retrying initialising random snode pool, try #',
                consecutiveErrors
              );
              this.initialiseRandomPool(seedNodes, consecutiveErrors + 1);
            }, consecutiveErrors * consecutiveErrors * 5000);
          } else {
            log.error('loki_snodes: Giving up trying to contact seed node');
            if (snodes.length === 0) {
              throw new window.textsecure.SeedNodeError(
                'Failed to contact seed node'
              );
            }
          }
        }
        // clear lock
        this.initialiseRandomPoolPromise = null;
        resolve();
      })
    }
    await this.initialiseRandomPoolPromise;
  }

  // unreachableNode.url is like 9hrje1bymy7hu6nmtjme9idyu3rm8gr3mkstakjyuw1997t7w4ny.snode
  async unreachableNode(pubKey, unreachableNode) {
    const conversation = ConversationController.get(pubKey);
    const swarmNodes = [...conversation.get('swarmNodes')];
    if (typeof(unreachableNode) === 'string') {
      log.warn('loki_snodes::unreachableNode: String passed as unreachableNode to unreachableNode');
      return swarmNodes;
    }
    let found = false
    const filteredNodes = swarmNodes.filter(
      node => {
        // keep all but thisNode
        const thisNode = (node.address === unreachableNode.address && node.ip === unreachableNode.ip && node.port === unreachableNode.port)
        if (thisNode) {
          found = true
        }
        return !thisNode
      }
    );
    if (!found) {
      log.warn(`loki_snodes::unreachableNode snode ${unreachableNode.ip}:${unreachableNode.port} has already been marked as bad`);
    }
    await conversation.updateSwarmNodes(filteredNodes);
    return filteredNodes;
  }

  markRandomNodeUnreachable(snode) {
    this.randomSnodePool = _.without(
      this.randomSnodePool,
      _.find(this.randomSnodePool, { ip: snode.ip, port: snode.port })
    );
    return this.randomSnodePool.length;
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
          log.error('loki_snodes: getFreshSwarmNodes error', e.code, e.message);
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
      if (!result.snodes) {
        log.warn(
          `getSnodesForPubkey lokiRpc on ${snode.ip}:${
            snode.port
          } returned falsish value for snodes`,
          result
        );
        return [];
      }
      const snodes = result.snodes.filter(tSnode => tSnode.ip !== '0.0.0.0');
      return snodes;
    } catch (e) {
      const randomPoolRemainingCount = this.markRandomNodeUnreachable(snode);
      log.error(
        'loki_snodes: getSnodesForPubkey error',
        e.code,
        e.message,
        `for ${snode.ip}:${snode.port}. ${randomPoolRemainingCount} snodes remaining in randomPool`
      );
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
