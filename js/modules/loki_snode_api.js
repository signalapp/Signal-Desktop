/* eslint-disable class-methods-use-this */
/* global window, textsecure, ConversationController, _, log, clearTimeout, process, Buffer, StringView, dcodeIO */

const is = require('@sindresorhus/is');
const { lokiRpc } = require('./loki_rpc');
const https = require('https');
const nodeFetch = require('node-fetch');
const semver = require('semver');

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM = 3;
const SEED_NODE_RETRIES = 3;

const timeoutDelay = ms => new Promise(resolve => setTimeout(resolve, ms));

// just get the filtered list
async function tryGetSnodeListFromLokidSeednode(
  seedNodes = [...window.seedNodeList]
) {
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
  // FIXME: use sample
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
    // throw before clearing the lock, so the retries can kick in
    if (snodes.length === 0) {
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
    return snodes;
  } catch (e) {
    log.warn(
      'loki_snodes:::tryGetSnodeListFromLokidSeednode - error',
      e.code,
      e.message
    );
    if (snodes.length === 0) {
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
  }
  return [];
}

async function getSnodeListFromLokidSeednode(
  seedNodes = [...window.seedNodeList],
  retries = 0
) {
  let snodes = [];
  try {
    snodes = await tryGetSnodeListFromLokidSeednode(seedNodes);
  } catch (e) {
    log.warn(
      'loki_snodes:::getSnodeListFromLokidSeednode - error',
      e.code,
      e.message
    );
    // handle retries in case of temporary hiccups
    if (retries < SEED_NODE_RETRIES) {
      setTimeout(() => {
        log.info(
          'loki_snodes:::refreshRandomPoolPromise - Retrying initialising random snode pool, try #',
          retries
        );
        getSnodeListFromLokidSeednode(seedNodes, retries + 1);
      }, retries * retries * 5000);
    } else {
      log.error('loki_snodes:::getSnodeListFromLokidSeednode - failing');
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
  }
  return snodes;
}

// FIXME: move out to more generic adv promise library
const snodeGlobalLocks = {};
async function allowOnlyOneAtATime(name, process, timeout) {
  // if currently not in progress
  if (snodeGlobalLocks[name] === undefined) {
    // set lock
    snodeGlobalLocks[name] = new Promise(async (resolve, reject) => {
      // set up timeout feature
      let timeoutTimer = null;
      if (timeout) {
        timeoutTimer = setTimeout(() => {
          log.warn(
            `loki_snodes:::allowOnlyOneAtATime - TIMEDOUT after ${timeout}s`
          );
          delete snodeGlobalLocks[name]; // clear lock
          reject();
        }, timeout);
      }
      // do actual work
      await process();
      // clear timeout timer
      if (timeout) {
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      }
      delete snodeGlobalLocks[name]; // clear lock
      // release the kraken
      resolve();
    });
  }
  try {
    await snodeGlobalLocks[name];
  } catch (e) {
    // we will throw for each time initialiseRandomPool has been called in parallel
    log.error('loki_snodes:::allowOnlyOneAtATime - error', e.code, e.message);
    throw e;
  }
  log.info('loki_snodes:::allowOnlyOneAtATime - RESOLVED');
}

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('WebAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl; // random.snode
    this.localUrl = localUrl; // localhost.loki
    this.randomSnodePool = [];
    this.swarmsPendingReplenish = {};
    this.refreshRandomPoolPromise = undefined;
    this.versionPools = {};
    this.versionMap = {}; // reverse version look up
    this.versionsRetrieved = false; // to mark when it's done getting versions

    this.onionPaths = [];
    this.guardNodes = [];
  }

  async getRandomSnodePool() {
    if (this.randomSnodePool.length === 0) {
      // allow exceptions to pass through upwards without the unhandled promise rejection
      try {
        await this.refreshRandomPool();
      } catch (e) {
        throw e;
      }
    }
    return this.randomSnodePool;
  }

  getRandomPoolLength() {
    return this.randomSnodePool.length;
  }

  async testGuardNode(snode) {
    log.info('Testing a candidate guard node ', snode);

    // Send a post request and make sure it is OK
    const endpoint = '/storage_rpc/v1';

    const url = `https://${snode.ip}:${snode.port}${endpoint}`;

    const ourPK = textsecure.storage.user.getNumber();
    const pubKey = window.getStoragePubKey(ourPK); // truncate if testnet

    const method = 'get_snodes_for_pubkey';
    const params = { pubKey };
    const body = {
      jsonrpc: '2.0',
      id: '0',
      method,
      params,
    };

    const fetchOptions = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000, // 10s, we want a smaller timeout for testing
    };

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    let response;

    try {
      response = await nodeFetch(url, fetchOptions);
    } catch (e) {
      if (e.type === 'request-timeout') {
        log.warn(`test timeout for node,`, snode);
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

    const nodePool = await this.getRandomSnodePool();

    if (nodePool.length === 0) {
      log.error(`Could not select guarn nodes: node pool is empty`);
      return [];
    }

    const shuffled = _.shuffle(nodePool);

    let guardNodes = [];

    const DESIRED_GUARD_COUNT = 3;
    if (shuffled.length < DESIRED_GUARD_COUNT) {
      log.error(
        `Could not select guarn nodes: node pool is not big enough, pool size ${
          shuffled.length
        }, need ${DESIRED_GUARD_COUNT}, attempting to refresh randomPool`
      );
      await this.refreshRandomPool();
      nodePool = await this.getRandomSnodePool();
      shuffled = _.shuffle(nodePool);
      if (shuffled.length < DESIRED_GUARD_COUNT) {
        log.error(
          `Could not select guarn nodes: node pool is not big enough, pool size ${
            shuffled.length
          }, need ${DESIRED_GUARD_COUNT}, failing...`
        );
        return [];
      }
    }
    // The use of await inside while is intentional:
    // we only want to repeat if the await fails
    // eslint-disable-next-line-no-await-in-loop
    while (guardNodes.length < 3) {
      if (shuffled.length < DESIRED_GUARD_COUNT) {
        log.error(`Not enought nodes in the pool`);
        break;
      }

      const candidateNodes = shuffled.splice(0, DESIRED_GUARD_COUNT);

      // Test all three nodes at once
      // eslint-disable-next-line no-await-in-loop
      const idxOk = await Promise.all(
        candidateNodes.map(n => this.testGuardNode(n))
      );

      const goodNodes = _.zip(idxOk, candidateNodes)
        .filter(x => x[0])
        .map(x => x[1]);

      guardNodes = _.concat(guardNodes, goodNodes);
    }

    if (guardNodes.length < DESIRED_GUARD_COUNT) {
      log.error(
        `COULD NOT get enough guard nodes, only have: ${guardNodes.length}`
      );
    }

    log.info('new guard nodes: ', guardNodes);

    const edKeys = guardNodes.map(n => n.pubkey_ed25519);

    await window.libloki.storage.updateGuardNodes(edKeys);

    return guardNodes;
  }

  async getOnionPath(toExclude = null) {
    const _ = window.Lodash;

    const goodPaths = this.onionPaths.filter(x => !x.bad);

    if (goodPaths.length < 2) {
      log.error(
        `Must have at least 2 good onion paths, actual: ${goodPaths.length}`
      );
      await this.buildNewOnionPaths();
    }

    const paths = _.shuffle(goodPaths);

    if (!toExclude) {
      return paths[0];
    }

    // Select a path that doesn't contain `toExclude`
    const otherPaths = paths.filter(
      path =>
        !_.some(path, node => node.pubkey_ed25519 === toExclude.pubkey_ed25519)
    );

    if (otherPaths.length === 0) {
      // This should never happen!
      throw new Error('No onion paths available after filtering');
    }

    return otherPaths[0].path;
  }

  async markPathAsBad(path) {
    this.onionPaths.forEach(p => {
      if (p.path === path) {
        // eslint-disable-next-line no-param-reassign
        p.bad = true;
      }
    });
  }

  async buildNewOnionPaths() {
    // Note: this function may be called concurrently, so
    // might consider blocking the other calls

    const _ = window.Lodash;

    log.info('building new onion paths');

    const allNodes = await this.getRandomSnodePool();

    if (this.guardNodes.length === 0) {
      // Not cached, load from DB
      const nodes = await window.libloki.storage.getGuardNodes();

      if (nodes.length === 0) {
        log.warn('no guard nodes in DB. Will be selecting new guards nodes...');
      } else {
        // We only store the nodes' keys, need to find full entries:
        const edKeys = nodes.map(x => x.ed25519PubKey);
        this.guardNodes = allNodes.filter(
          x => edKeys.indexOf(x.pubkey_ed25519) !== -1
        );

        if (this.guardNodes.length < edKeys.length) {
          log.warn(
            `could not find some guard nodes: ${this.guardNodes.length}/${
              edKeys.length
            } left`
          );
        }
      }

      // If guard nodes is still empty (the old nodes are now invalid), select new ones:
      if (this.guardNodes.length === 0) {
        this.guardNodes = await this.selectGuardNodes();
      }
    }

    // TODO: select one guard node and 2 other nodes randomly
    let otherNodes = _.difference(allNodes, this.guardNodes);

    if (otherNodes.length < 2) {
      log.error('Too few nodes to build an onion path!');
      return;
    }

    otherNodes = _.shuffle(otherNodes);
    const guards = _.shuffle(this.guardNodes);

    // Create path for every guard node:

    // Each path needs 2 nodes in addition to the guard node:
    const maxPath = Math.floor(Math.min(guards.length, otherNodes.length / 2));

    // TODO: might want to keep some of the existing paths
    this.onionPaths = [];

    for (let i = 0; i < maxPath; i += 1) {
      const path = [guards[i], otherNodes[i * 2], otherNodes[i * 2 + 1]];
      this.onionPaths.push({ path, bad: false });
    }

    log.info('Built onion paths: ', this.onionPaths);
  }

  async getRandomSnodeAddress() {
    // resolve random snode
    if (this.randomSnodePool.length === 0) {
      // allow exceptions to pass through upwards without the unhandled promise rejection
      try {
        await this.refreshRandomPool();
      } catch (e) {
        throw e;
      }
      if (this.randomSnodePool.length === 0) {
        throw new window.textsecure.SeedNodeError('Invalid seed node response');
      }
    }
    // FIXME: _.sample?
    return this.randomSnodePool[
      Math.floor(Math.random() * this.randomSnodePool.length)
    ];
  }

  async getNodesMinVersion(minVersion) {
    const _ = window.Lodash;

    return _.flatten(
      _.entries(this.versionPools)
        .filter(v => semver.gte(v[0], minVersion))
        .map(v => v[1])
    );
  }

  // use nodes that support more than 1mb
  async getRandomProxySnodeAddress() {
    // resolve random snode
    if (this.randomSnodePool.length === 0) {
      // allow exceptions to pass through upwards without the unhandled promise rejection
      try {
        await this.refreshRandomPool();
      } catch (e) {
        throw e;
      }
      await this.refreshRandomPool();
      if (this.randomSnodePool.length === 0) {
        throw new window.textsecure.SeedNodeError('Invalid seed node response');
      }
    }
    const goodVersions = Object.keys(this.versionPools).filter(version =>
      semver.gt(version, '2.0.1')
    );
    if (!goodVersions.length) {
      return false;
    }
    // FIXME: _.sample?
    const goodVersion =
      goodVersions[Math.floor(Math.random() * goodVersions.length)];
    const pool = this.versionPools[goodVersion];
    // FIXME: _.sample?
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // WARNING: this leaks our IP to all snodes but with no other identifying information
  // except that a client started up or ran out of random pool snodes
  // and the order of the list is randomized, so a snode can't tell if it just started or not
  async getVersion(node) {
    try {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      const result = await nodeFetch(
        `https://${node.ip}:${node.port}/get_stats/v1`,
        { agent: snodeHttpsAgent }
      );
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
      const data = await result.json();
      if (data.version) {
        if (this.versionPools[data.version] === undefined) {
          this.versionPools[data.version] = [node];
        } else {
          this.versionPools[data.version].push(node);
        }
        // set up reverse mapping for removal lookup
        this.versionMap[`${node.ip}:${node.port}`] = data.version;
      }
    } catch (e) {
      // ECONNREFUSED likely means it's just offline...
      // ECONNRESET seems to retry and fail as ECONNREFUSED (so likely a node going offline)
      // ETIMEDOUT not sure what to do about these
      // retry for now but maybe we should be marking bad...
      if (e.code === 'ECONNREFUSED') {
        this.markRandomNodeUnreachable(node, { versionPoolFailure: true });
        const randomNodesLeft = this.getRandomPoolLength();
        // clean up these error messages to be a little neater
        log.warn(
          `loki_snode:::getVersion - ${node.ip}:${
            node.port
          } is offline, removing, leaving ${randomNodesLeft} in the randomPool`
        );
      } else {
        // mostly ECONNRESETs
        // ENOTFOUND could mean no internet or hiccup
        log.warn(
          'loki_snode:::getVersion - Error',
          e.code,
          e.message,
          `on ${node.ip}:${node.port} retrying in 1s`
        );
        await timeoutDelay(1000);
        await this.getVersion(node);
      }
    }
  }

  async getAllVerionsForRandomSnodePool() {
    // now get version for all snodes
    // also acts an early online test/purge of bad nodes
    let count = 0;
    const verionStart = Date.now();
    const total = this.randomSnodePool.length;
    const noticeEvery = parseInt(total / 10, 10);
    // eslint-disable-next-line no-restricted-syntax
    for (const node of this.randomSnodePool) {
      count += 1;
      // eslint-disable-next-line no-await-in-loop
      await this.getVersion(node);
      if (count % noticeEvery === 0) {
        // give stats
        const diff = Date.now() - verionStart;
        log.info(
          `loki_snode:::getAllVerionsForRandomSnodePool - ${count}/${total} pool version status update, has taken ${diff.toLocaleString()}ms`
        );
        Object.keys(this.versionPools).forEach(version => {
          const nodes = this.versionPools[version].length;
          log.info(
            `loki_snode:::getAllVerionsForRandomSnodePool - version ${version} has ${nodes.toLocaleString()} snodes`
          );
        });
      }
    }
    log.info('Versions retrieved from network!');
    this.versionsRetrieved = true;
  }

  async refreshRandomPool(seedNodes = [...window.seedNodeList]) {
    await allowOnlyOneAtATime('refreshRandomPool', async () => {
      let snodes = [];
      try {
        snodes = await getSnodeListFromLokidSeednode(seedNodes);
        // make sure order of the list is random, so we get version in a non-deterministic way
        snodes = _.shuffle(snodes);
        // commit changes to be live
        // we'll update the version (in case they upgrade) every cycle
        this.versionPools = {};
        this.versionsRetrieved = false;
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
        // start polling versions but no need to await it
        this.getAllVerionsForRandomSnodePool();
      } catch (e) {
        log.warn(
          'loki_snodes:::refreshRandomPoolPromise - error',
          e.code,
          e.message
        );
        /*
        log.error(
          'loki_snodes:::refreshRandomPoolPromise -  Giving up trying to contact seed node'
        );
        */
        if (snodes.length === 0) {
          throw new window.textsecure.SeedNodeError(
            'Failed to contact seed node'
          );
        }
      }
    });
  }

  async refreshRandomPool2(seedNodes = [...window.seedNodeList]) {
    // if currently not in progress
    if (this.refreshRandomPoolPromise) {
      // set lock
      this.refreshRandomPoolPromise = new Promise(async (resolve, reject) => {
        let timeoutTimer = null;
        // private retry container
        const trySeedNode = async (consecutiveErrors = 0) => {
          let snodes = [];
          try {
            log.info(
              'loki_snodes:::refreshRandomPoolPromise - Refreshing random snode pool'
            );
            snodes = await getSnodeListFromLokidSeednode(seedNodes);
            // make sure order of the list is random, so we get version in a non-deterministic way
            snodes = _.shuffle(snodes);
            // commit changes to be live
            // we'll update the version (in case they upgrade) every cycle
            this.versionPools = {};
            this.versionsRetrieved = false;
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
            delete this.refreshRandomPoolPromise;
            if (timeoutTimer !== null) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }
            // start polling versions but no need to await it
            this.getAllVerionsForRandomSnodePool();
            resolve();
          } catch (e) {
            log.warn(
              'loki_snodes:::refreshRandomPoolPromise - error',
              e.code,
              e.message
            );
            // handle retries in case of temporary hiccups
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
                throw new window.textsecure.SeedNodeError(
                  'Failed to contact seed node'
                );
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
      throw e;
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

  markRandomNodeUnreachable(snode, options = {}) {
    // avoid retries when we can't get the version because they're offline
    if (!options.versionPoolFailure) {
      const snodeVersion = this.versionMap[`${snode.ip}:${snode.port}`];
      if (this.versionPools[snodeVersion]) {
        this.versionPools[snodeVersion] = _.without(
          this.versionPools[snodeVersion],
          snode
        );
      } else {
        const retries = options.retries || 0;
        if (snodeVersion) {
          // reverse map (versionMap) is out of sync with versionPools
          log.error(
            'loki_snode:::markRandomNodeUnreachable - No snodes for version',
            snodeVersion,
            `try #${retries} retrying in 10s`
          );
        } else {
          // we don't know our version yet
          // and if we're offline, we'll likely not get it until it restarts if it does...
          log.warn(
            'loki_snode:::markRandomNodeUnreachable - No version for snode',
            `${snode.ip}:${snode.port}`,
            `try #${retries} retrying in 10s`
          );
        }
        // make sure we don't retry past 15 mins (10s * 100 ~ 1000s)
        if (retries < 100) {
          setTimeout(() => {
            this.markRandomNodeUnreachable(snode, {
              ...options,
              retries: retries + 1,
            });
          }, 10 * 1000);
        }
      }
    }
    this.randomSnodePool = _.without(this.randomSnodePool, snode);
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

  // helper function
  async _requestLnsMapping(node, nameHash) {
    log.debug('[lns] lns requests to {}:{}', node.ip, node.port);

    try {
      // Hm, in case of proxy/onion routing we
      // are not even using ip/port...
      return lokiRpc(
        `https://${node.ip}`,
        node.port,
        'get_lns_mapping',
        {
          name_hash: nameHash,
        },
        {},
        '/storage_rpc/v1',
        node
      );
    } catch (e) {
      log.warn('exception caught making lns requests to a node', node, e);
      return false;
    }
  }

  async getLnsMapping(lnsName) {
    const _ = window.Lodash;

    const input = Buffer.from(lnsName);

    const output = await window.blake2b(input);

    const nameHash = dcodeIO.ByteBuffer.wrap(output).toString('base64');

    // Get nodes capable of doing LNS
    let lnsNodes = await this.getNodesMinVersion('2.0.3');
    lnsNodes = _.shuffle(lnsNodes);

    // Loop until 3 confirmations

    // We don't trust any single node, so we accumulate
    // answers here and select a dominating answer
    const allResults = [];
    let ciphertextHex = null;

    while (!ciphertextHex) {
      if (lnsNodes.length < 3) {
        log.error('Not enough nodes for lns lookup');
        return false;
      }

      // extract 3 and make requests in parallel
      const nodes = lnsNodes.splice(0, 3);

      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.all(
        nodes.map(node => this._requestLnsMapping(node, nameHash))
      );

      results.forEach(res => {
        if (
          res &&
          res.result &&
          res.result.status === 'OK' &&
          res.result.entries &&
          res.result.entries.length > 0
        ) {
          allResults.push(results[0].result.entries[0].encrypted_value);
        }
      });

      const [winner, count] = _.maxBy(
        _.entries(_.countBy(allResults)),
        x => x[1]
      );

      if (count >= 3) {
        // eslint-disable-next-lint prefer-destructuring
        ciphertextHex = winner;
      }
    }

    const ciphertext = new Uint8Array(
      StringView.hexToArrayBuffer(ciphertextHex)
    );

    const res = await window.decryptLnsEntry(lnsName, ciphertext);

    const pubkey = StringView.arrayBufferToHex(res);

    return pubkey;
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
