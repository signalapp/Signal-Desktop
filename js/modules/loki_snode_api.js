/* eslint-disable class-methods-use-this */
/* global window, ConversationController, _, log, clearTimeout */

const is = require('@sindresorhus/is');
const { lokiRpc } = require('./loki_rpc');

const RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM = 3;
const RANDOM_SNODES_POOL_SIZE = 1024;
const SEED_NODE_RETRIES = 3;

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl; // random.snode
    this.localUrl = localUrl; // localhost.loki
    this.randomSnodePool = [];
    this.swarmsPendingReplenish = {};
    this.refreshRandomPoolPromise = false;
  }

  async getRandomSnodeAddress() {
    /* resolve random snode */
    if (this.randomSnodePool.length === 0) {
      // allow exceptions to pass through upwards
      await this.refreshRandomPool();
    }
    if (this.randomSnodePool.length === 0) {
      throw new window.textsecure.SeedNodeError('Invalid seed node response');
    }
    return this.randomSnodePool[
      Math.floor(Math.random() * this.randomSnodePool.length)
    ];
  }

  async refreshRandomPool(seedNodes = [...window.seedNodeList]) {
    // if currently not in progress
    if (this.refreshRandomPoolPromise === false) {
      // set lock
      this.refreshRandomPoolPromise = new Promise(async (resolve, reject) => {
        let timeoutTimer = null;
        // private retry container
        const trySeedNode = async (consecutiveErrors = 0) => {
          const params = {
            limit: RANDOM_SNODES_POOL_SIZE,
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
            log.info(
              'loki_snodes:::refreshRandomPoolPromise - Refreshing random snode pool'
            );
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
            log.info(
              'loki_snodes:::refreshRandomPoolPromise - Refreshed random snode pool with',
              this.randomSnodePool.length,
              'snodes'
            );
            // clear lock
            this.refreshRandomPoolPromise = null;
            if (timeoutTimer !== null) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }
            resolve();
          } catch (e) {
            log.warn(
              'loki_snodes:::refreshRandomPoolPromise - error',
              e.code,
              e.message
            );
            if (consecutiveErrors < SEED_NODE_RETRIES) {
              // retry after a possible delay
              setTimeout(() => {
                log.info(
                  'loki_snodes:::refreshRandomPoolPromise - Retrying initialising random snode pool, try #',
                  consecutiveErrors
                );
                trySeedNode(consecutiveErrors + 1);
              }, consecutiveErrors * consecutiveErrors * 5000);
            } else {
              log.error(
                'loki_snodes:::refreshRandomPoolPromise -  Giving up trying to contact seed node'
              );
              if (snodes.length === 0) {
                this.refreshRandomPoolPromise = null; // clear lock
                if (timeoutTimer !== null) {
                  clearTimeout(timeoutTimer);
                  timeoutTimer = null;
                }
                reject();
              }
            }
          }
        };
        const delay = (SEED_NODE_RETRIES + 1) * (SEED_NODE_RETRIES + 1) * 5000;
        timeoutTimer = setTimeout(() => {
          log.warn(
            'loki_snodes:::refreshRandomPoolPromise - TIMEDOUT after',
            delay,
            's'
          );
          reject();
        }, delay);
        trySeedNode();
      });
    }
    try {
      await this.refreshRandomPoolPromise;
    } catch (e) {
      // we will throw for each time initialiseRandomPool has been called in parallel
      log.error(
        'loki_snodes:::refreshRandomPoolPromise - error',
        e.code,
        e.message
      );
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
    log.info('loki_snodes:::refreshRandomPoolPromise - RESOLVED');
  }

  // unreachableNode.url is like 9hrje1bymy7hu6nmtjme9idyu3rm8gr3mkstakjyuw1997t7w4ny.snode
  async unreachableNode(pubKey, unreachableNode) {
    const conversation = ConversationController.get(pubKey);
    const swarmNodes = [...conversation.get('swarmNodes')];
    if (typeof unreachableNode === 'string') {
      log.warn(
        'loki_snodes:::unreachableNode - String passed as unreachableNode to unreachableNode'
      );
      return swarmNodes;
    }
    let found = false;
    const filteredNodes = swarmNodes.filter(node => {
      // keep all but thisNode
      const thisNode =
        node.address === unreachableNode.address &&
        node.ip === unreachableNode.ip &&
        node.port === unreachableNode.port;
      if (thisNode) {
        found = true;
      }
      return !thisNode;
    });
    if (!found) {
      log.warn(
        `loki_snodes:::unreachableNode - snode ${unreachableNode.ip}:${
          unreachableNode.port
        } has already been marked as bad`
      );
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
          log.error(
            'loki_snodes:::getFreshSwarmNodes - error',
            e.code,
            e.message
          );
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
          `loki_snode:::getSnodesForPubkey - lokiRpc on ${snode.ip}:${
            snode.port
          } returned falsish value`,
          result
        );
        return [];
      }
      if (!result.snodes) {
        // we hit this when snode gives 500s
        log.warn(
          `loki_snode:::getSnodesForPubkey - lokiRpc on ${snode.ip}:${
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
        'loki_snodes:::getSnodesForPubkey - error',
        e.code,
        e.message,
        `for ${snode.ip}:${
          snode.port
        }. ${randomPoolRemainingCount} snodes remaining in randomPool`
      );
      return [];
    }
  }

  async getSwarmNodes(pubKey) {
    const snodes = [];
    const questions = [...Array(RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM).keys()];
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
