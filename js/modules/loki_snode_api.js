/* eslint-disable class-methods-use-this */
/* global window, textsecure, ConversationController, _, log, process, Buffer, StringView, dcodeIO, URL */

const { lokiRpc } = require('./loki_rpc');
// not sure I like this name but it's been than util
const primitives = require('./loki_primitives');

const is = require('@sindresorhus/is');
const https = require('https');
const nodeFetch = require('node-fetch');
const semver = require('semver');

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM = 3;
const SEED_NODE_RETRIES = 3;
const SNODE_VERSION_RETRIES = 3;

const compareSnodes = (current, search) =>
  current.pubkey_ed25519 === search.pubkey_ed25519;

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
    const getSnodesFromSeedUrl = async urlObj => {
      const response = await lokiRpc(
        `${urlObj.protocol}//${urlObj.hostname}`,
        urlObj.port,
        'get_n_service_nodes',
        params,
        {}, // Options
        '/json_rpc' // Seed request endpoint
      );
      // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
      return response.result.service_node_states.filter(
        snode => snode.public_ip !== '0.0.0.0'
      );
    };
    const tryUrl = new URL(seedNode.url);
    snodes = await getSnodesFromSeedUrl(tryUrl);
    // throw before clearing the lock, so the retries can kick in
    if (snodes.length === 0) {
      // fall back on ip_url
      const tryIpUrl = new URL(seedNode.ip_url);
      snodes = await getSnodesFromSeedUrl(tryIpUrl);
      if (snodes.length === 0) {
        // does this error message need to be exactly this?
        throw new window.textsecure.SeedNodeError(
          'Failed to contact seed node'
        );
      }
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

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('LokiSnodeAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl; // random.snode
    this.localUrl = localUrl; // localhost.loki
    this.randomSnodePool = [];
    this.swarmsPendingReplenish = {};
    this.stopGetAllVersionPromiseControl = false;

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

    // FIXME: handle rejections
    let nodePool = await this.getRandomSnodePool();
    if (nodePool.length === 0) {
      log.error(`Could not select guarn nodes: node pool is empty`);
      return [];
    }

    let shuffled = _.shuffle(nodePool);

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
    const nodesNeededPerPaths = window.lokiFeatureFlags.onionRequestHops - 1;

    // Each path needs X (nodesNeededPerPaths) nodes in addition to the guard node:
    const maxPath = Math.floor(
      Math.min(
        guards.length,
        nodesNeededPerPaths
          ? otherNodes.length / nodesNeededPerPaths
          : otherNodes.length
      )
    );

    // TODO: might want to keep some of the existing paths
    this.onionPaths = [];

    for (let i = 0; i < maxPath; i += 1) {
      const path = [guards[i]];
      for (let j = 0; j < nodesNeededPerPaths; j += 1) {
        path.push(otherNodes[i * nodesNeededPerPaths + j]);
      }
      this.onionPaths.push({ path, bad: false });
    }

    log.info(`Built ${this.onionPaths.length} onion paths`, this.onionPaths);
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

  // not cacheable because we write to this.randomSnodePool elsewhere
  getNodesMinVersion(minVersion) {
    return this.randomSnodePool.filter(
      node => node.version && semver.gt(node.version, minVersion)
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
        log.error(
          `loki_snode:::getRandomProxySnodeAddress - error ${e.code} ${
            e.message
          }`
        );
        throw e;
      }
      if (this.randomSnodePool.length === 0) {
        throw new window.textsecure.SeedNodeError('Invalid seed node response');
      }
    }
    const goodPool = this.getNodesMinVersion('2.0.1');
    if (!goodPool.length) {
      // FIXME: retry
      log.warn(
        `loki_snode:::getRandomProxySnodeAddress - no good versions yet`
      );
      return false;
    }
    // FIXME: _.sample?
    const goodRandomNode =
      goodPool[Math.floor(Math.random() * goodPool.length)];
    return goodRandomNode;
  }

  // WARNING: this leaks our IP to all snodes but with no other identifying information
  // except "that a client started up" or "ran out of random pool snodes"
  // and the order of the list is randomized, so a snode can't tell if it just started or not
  async _getVersion(node, options = {}) {
    const retries = options.retries || 0;
    try {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      const result = await nodeFetch(
        `https://${node.ip}:${node.port}/get_stats/v1`,
        { agent: snodeHttpsAgent }
      );
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
      const data = await result.json();
      if (data.version) {
        const foundNodeIdx = this.randomSnodePool.findIndex(n =>
          compareSnodes(n, node)
        );
        if (foundNodeIdx !== -1) {
          this.randomSnodePool[foundNodeIdx].version = data.version;
        } else {
          // maybe already marked bad...
          log.debug(
            `loki_snode:::_getVersion - can't find ${node.ip}:${
              node.port
            } in randomSnodePool`
          );
        }
      }
      return data.version;
    } catch (e) {
      // ECONNREFUSED likely means it's just offline...
      // ECONNRESET seems to retry and fail as ECONNREFUSED (so likely a node going offline)
      // ETIMEDOUT not sure what to do about these
      // retry for now but maybe we should be marking bad...
      if (e.code === 'ECONNREFUSED') {
        this.markRandomNodeUnreachable(node);
        const randomNodesLeft = this.getRandomPoolLength();
        // clean up these error messages to be a little neater
        log.warn(
          `loki_snode:::_getVersion - ${node.ip}:${
            node.port
          } is offline, removing, leaving ${randomNodesLeft} in the randomPool`
        );
        // if not ECONNREFUSED, it's mostly ECONNRESETs
        // ENOTFOUND could mean no internet or hiccup
      } else if (retries < SNODE_VERSION_RETRIES) {
        log.warn(
          'loki_snode:::_getVersion - Error',
          e.code,
          e.message,
          `on ${node.ip}:${node.port} retrying in 1s`
        );
        await primitives.sleepFor(1000);
        return this._getVersion(node, { ...options, retries: retries + 1 });
      } else {
        this.markRandomNodeUnreachable(node);
        const randomNodesLeft = this.getRandomPoolLength();
        log.warn(
          `loki_snode:::_getVersion - failing to get version for ${node.ip}:${
            node.port
          }, removing, leaving ${randomNodesLeft} in the randomPool`
        );
      }
      // maybe throw?
      return false;
    }
  }

  // now get version for all snodes
  // also acts an early online test/purge of bad nodes
  async _getAllVerionsForRandomSnodePool() {
    // let count = 0;
    // const verionStart = Date.now();
    // const total = this.randomSnodePool.length;
    // const noticeEvery = parseInt(total / 10, 10);
    const loop = primitives.abortableIterator(
      this.randomSnodePool,
      async node => {
        // count += 1;
        try {
          await this._getVersion(node);
          /*
          if (count % noticeEvery === 0) {
            // give stats
            const diff = Date.now() - verionStart;
            log.debug(
              `loki_snode:::_getAllVerionsForRandomSnodePool - ${count}/${total} pool version status update, has taken ${diff.toLocaleString()}ms`
            );
            Object.keys(this.versionPools).forEach(version => {
              const nodes = this.versionPools[version].length;
              log.debug(
                `loki_snode:::_getAllVerionsForRandomSnodePool - version ${version} has ${nodes.toLocaleString()} snodes`
              );
            });
          }
          */
        } catch (e) {
          log.error(
            `loki_snode:::_getAllVerionsForRandomSnodePool - error`,
            e.code,
            e.message
          );
          throw e;
        }
      }
    );
    // make abortable accessible outside this scope
    this.stopGetAllVersionPromiseControl = loop.stop;
    await loop.start(true);
    this.stopGetAllVersionPromiseControl = false; // clear lock
    // an array of objects
    const versions = this.randomSnodePool.reduce((curVal, node) => {
      if (curVal.indexOf(node.version) === -1) {
        curVal.push(node.version);
      }
      return curVal;
    }, []);
    log.debug(
      `loki_snode:::_getAllVerionsForRandomSnodePool - ${
        versions.length
      } versions retrieved from network!:`,
      versions.join(',')
    );
  }

  async refreshRandomPool(seedNodes = [...window.seedNodeList]) {
    return primitives.allowOnlyOneAtATime('refreshRandomPool', async () => {
      // are we running any _getAllVerionsForRandomSnodePool
      if (this.stopGetAllVersionPromiseControl !== false) {
        // we are, stop them
        this.stopGetAllVersionPromiseControl();
      }
      let snodes = [];
      try {
        snodes = await getSnodeListFromLokidSeednode(seedNodes);
        // make sure order of the list is random, so we get version in a non-deterministic way
        snodes = _.shuffle(snodes);
        // commit changes to be live
        // we'll update the version (in case they upgrade) every cycle
        this.randomSnodePool = snodes.map(snode => ({
          ip: snode.public_ip,
          port: snode.storage_port,
          pubkey_x25519: snode.pubkey_x25519,
          pubkey_ed25519: snode.pubkey_ed25519,
        }));
        log.info(
          'loki_snodes:::refreshRandomPool - Refreshed random snode pool with',
          this.randomSnodePool.length,
          'snodes'
        );
        // start polling versions but no need to await it
        this._getAllVerionsForRandomSnodePool();
      } catch (e) {
        log.warn('loki_snodes:::refreshRandomPool - error', e.code, e.message);
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
      return this.randomSnodePool;
    });
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
        compareSnodes(unreachableNode, node);
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
    try {
      await conversation.updateSwarmNodes(filteredNodes);
    } catch (e) {
      log.error(`loki_snodes:::unreachableNode - error ${e.code} ${e.message}`);
      throw e;
    }
    return filteredNodes;
  }

  markRandomNodeUnreachable(snode) {
    this.randomSnodePool = _.without(this.randomSnodePool, snode);
  }

  async updateLastHash(convoId, snodeAddress, hash, expiresAt) {
    // FIXME: handle rejections
    await window.Signal.Data.updateLastHash({
      convoId,
      snode: snodeAddress,
      hash,
      expiresAt,
    });
  }

  // called by loki_message:::sendMessage & loki_message:::startLongPolling
  async getSwarmNodesForPubKey(pubKey, options = {}) {
    const { fetchHashes } = options;
    try {
      const conversation = ConversationController.get(pubKey);
      const swarmNodes = [...conversation.get('swarmNodes')];

      // always? include lashHash
      if (fetchHashes) {
        await Promise.all(
          Object.keys(swarmNodes).map(async j => {
            const node = swarmNodes[j];
            // FIXME make a batch function call
            const lastHash = await window.Signal.Data.getLastHashBySnode(
              pubKey,
              node.address
            );
            log.debug(
              `loki_snode:::getSwarmNodesForPubKey - ${j} ${node.ip}:${
                node.port
              }`
            );
            swarmNodes[j] = {
              ...node,
              lastHash,
            };
          })
        );
      }

      return swarmNodes;
    } catch (e) {
      log.error('getSwarmNodesForPubKey expection: ', e);
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
      log.error(
        `loki_snodes:::updateSwarmNodes - error ${e.code} ${e.message}`
      );
      throw new window.textsecure.ReplayableError({
        message: 'Could not get conversation',
      });
    }
  }

  // FIXME: in it's own PR, reorder functions: put _getFreshSwarmNodes and it's callee
  // only loki_message::startLongPolling calls this...
  async refreshSwarmNodesForPubKey(pubKey) {
    // FIXME: handle rejections
    const newNodes = await this._getFreshSwarmNodes(pubKey);
    const filteredNodes = this.updateSwarmNodes(pubKey, newNodes);
    return filteredNodes;
  }

  async _getFreshSwarmNodes(pubKey) {
    return primitives.allowOnlyOneAtATime(`swarmRefresh${pubKey}`, async () => {
      let newSwarmNodes = [];
      try {
        newSwarmNodes = await this._getSwarmNodes(pubKey);
      } catch (e) {
        log.error(
          'loki_snodes:::_getFreshSwarmNodes - error',
          e.code,
          e.message
        );
        // TODO: Handle these errors sensibly
        newSwarmNodes = [];
      }
      return newSwarmNodes;
    });
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
    const lnsNodes = this.getNodesMinVersion('2.0.3');
    // randomPool should already be shuffled
    // lnsNodes = _.shuffle(lnsNodes);

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

  // get snodes for pubkey from random snode
  async _getSnodesForPubkey(pubKey) {
    let snode = {};
    try {
      snode = await this.getRandomSnodeAddress();
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
          `loki_snode:::_getSnodesForPubkey - lokiRpc on ${snode.ip}:${
            snode.port
          } returned falsish value`,
          result
        );
        return [];
      }
      if (!result.snodes) {
        // we hit this when snode gives 500s
        log.warn(
          `loki_snode:::_getSnodesForPubkey - lokiRpc on ${snode.ip}:${
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
        'loki_snodes:::_getSnodesForPubkey - error',
        e.code,
        e.message,
        `for ${snode.ip}:${
          snode.port
        }. ${randomPoolRemainingCount} snodes remaining in randomPool`
      );
      return [];
    }
  }

  async _getSwarmNodes(pubKey) {
    const snodes = [];
    // creates a range: [0, 1, 2]
    const questions = [...Array(RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM).keys()];
    // FIXME: handle rejections
    await Promise.all(
      questions.map(async () => {
        // allow exceptions to pass through upwards
        const resList = await this._getSnodesForPubkey(pubKey);
        resList.map(item => {
          const hasItem = snodes.some(n => compareSnodes(n, item));
          if (!hasItem) {
            snodes.push(item);
          }
          return true;
        });
      })
    );
    // should we only activate entries that are in all results?
    return snodes;
  }
}

module.exports = LokiSnodeAPI;
