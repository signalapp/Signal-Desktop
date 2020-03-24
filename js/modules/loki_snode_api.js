/* eslint-disable class-methods-use-this */
/* global window, textsecure, ConversationController, _, log, clearTimeout */

const is = require('@sindresorhus/is');
const { lokiRpc } = require('./loki_rpc');
const nodeFetch = require('node-fetch');

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

    this.onionPaths = [];
    this.guardNodes = [];
  }

  async getRandomSnodePool() {

    if (this.randomSnodePool.length === 0) {
      await this.refreshRandomPool();
    }
    return this.randomSnodePool;
  }

  async test_guard_node(snode) {

    log.info("[maxim] Testing a candidate guard node ", snode);

    // Send a post request and make sure it is OK
    const endpoint = "/storage_rpc/v1";

    const url = `https://${snode.ip}:${snode.port}${endpoint}`;

    const our_pk = textsecure.storage.user.getNumber();
    const pubKey = window.getStoragePubKey(our_pk); // truncate if testnet

    const method = 'get_snodes_for_pubkey';
    const params = { pubKey }
    const body = {
      jsonrpc: '2.0',
      id: '0',
      method,
      params,
    };

    const fetchOptions = {
      method: 'POST',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // 10s, we want a smaller timeout for testing
    };

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    let response;

    try {
      response = await nodeFetch(url, fetchOptions);
    } catch (e) {
      if (e.type === 'request-timeout') {
        log.warn(`[maxim] test timeout for node,`, snode);
      }
      return false;
    } finally {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }

    if (!response.ok) {
      log.info(`Node failed the guard test:`, snode);
    }

    return response.ok;
  }

  async selectGuardNodes() {

    const _ = window.Lodash;

    let node_pool = await this.getRandomSnodePool();

    if (node_pool.length === 0) {
      log.error(`Could not select guarn nodes: node pool is empty`)
      return [];
    }

    let shuffled = _.shuffle(node_pool);

    let guard_nodes = [];

    const DESIRED_GUARD_COUNT = 3;

    while (guard_nodes.length < 3) {

      if (shuffled.length < DESIRED_GUARD_COUNT) {
        log.error(`Not enought nodes in the pool`);
        break;
      }

      const candidate_nodes = shuffled.splice(0, DESIRED_GUARD_COUNT);

      // Test all three nodes at once
      const idx_ok = await Promise.all(candidate_nodes.map(n => this.test_guard_node(n)));

      const good_nodes = _.zip(idx_ok, candidate_nodes).filter(x => x[0]).map(x => x[1]);

      guard_nodes = _.concat(guard_nodes, good_nodes);
    }

    if (guard_nodes.length < DESIRED_GUARD_COUNT) {
      log.error(`COULD NOT get enough guard nodes, only have: ${guard_nodes.length}`);
      debugger;
    }

    console.log("new guard nodes: ", guard_nodes);

    const edKeys = guard_nodes.map(n => n.pubkey_ed25519);

    await window.libloki.storage.updateGuardNodes(edKeys);

    return guard_nodes;
  }

  async getOnionPath(toExclude = null) {

    const _ = window.Lodash;

    const good_paths = this.onionPaths.filter(x => !x.bad);

    if (good_paths.length < 2) {
      log.error(`Must have at least 2 good onion paths, actual: ${good_paths.length}`);
      await this.buildNewOnionPaths();
    }

    const paths = _.shuffle(good_paths);

    if (!toExclude) {
      return paths[0];
    }

    // Select a path that doesn't contain `toExclude`
    const other_paths = paths.filter(path => !_.some(path, node => node.pubkey_ed25519 == toExclude.pubkey_ed25519));

    if (other_paths.length === 0) {
      // This should never happen!
      log.error("No onion paths available after filtering");
    }

    return other_paths[0].path;
  }

  async markPathAsBad(path) {
    this.onionPaths.forEach(p => {
      if (p.path == path) {
        p.bad = true;
      }
    })
  }
  
  async buildNewOnionPaths() {

    // Note: this function may be called concurrently, so
    // might consider blocking the other calls
    
    const _ = window.Lodash;

    log.info("building new onion paths");

    const all_nodes = await this.getRandomSnodePool();

    log.info("[maxim] all nodes: ", all_nodes.length);

    if (this.guardNodes.length == 0) {

      // Not cached, load from DB
      let nodes = await window.libloki.storage.getGuardNodes();

      if (nodes.length == 0) {
        log.warn("no guard nodes in DB. Will be selecting new guards nodes...");
      } else {
        // We only store the nodes' keys, need to find full entries:
        let ed_keys = nodes.map(x => x.ed25519PubKey);
        this.guardNodes = all_nodes.filter(x => ed_keys.indexOf(x.pubkey_ed25519) !== -1);

        if (this.guardNodes.length < ed_keys.length) {
          log.warn(`could not find some guard nodes: ${this.guardNodes.length}/${ed_keys.length}`);
        }

      }

      // If guard nodes is still empty (the old nodes are now invalid), select new ones:
      if (this.guardNodes.length == 0 || true) {
        this.guardNodes = await this.selectGuardNodes();
      }

    }

    // TODO: select one guard node and 2 other nodes randomly
    let other_nodes = _.difference(all_nodes, this.guardNodes);

    if (other_nodes.length < 2) {
      log.error("Too few nodes to build an onion path!");
      return;
    }

    other_nodes = _.shuffle(other_nodes);
    const guards = _.shuffle(this.guardNodes);

    // Create path for every guard node:

    // Each path needs 2 nodes in addition to the guard node:
    const max_path = Math.floor(Math.min(guards.length, other_nodes.length / 2));

    // TODO: might want to keep some of the existing paths
    this.onionPaths = [];

    for (let i = 0; i < max_path; i++) {
      const path = [guards[i], other_nodes[i * 2], other_nodes[i * 2 + 1]];
      this.onionPaths.push({path, bad: false});
    }

    log.info("Built onion paths: ", this.onionPaths);
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

          // Removed limit until there is a way to get snode info
          // for individual nodes (needed for guard nodes);  this way
          // we get all active nodes
          const params = {
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
  }

  getRandomPoolLength() {
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
      this.markRandomNodeUnreachable(snode);
      const randomPoolRemainingCount = this.getRandomPoolLength();
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
