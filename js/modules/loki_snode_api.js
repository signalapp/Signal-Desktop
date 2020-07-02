/* eslint-disable class-methods-use-this */
/* global window, textsecure, ConversationController, log, process, Buffer, StringView, dcodeIO */

// not sure I like this name but it's been than util
const primitives = require('./loki_primitives');

const is = require('@sindresorhus/is');
const nodeFetch = require('node-fetch');

const RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM = 3;
const MIN_GUARD_COUNT = 2;

const compareSnodes = (current, search) =>
  current.pubkey_ed25519 === search.pubkey_ed25519;

class LokiSnodeAPI {
  constructor({ serverUrl, localUrl }) {
    if (!is.string(serverUrl)) {
      throw new Error('LokiSnodeAPI.initialize: Invalid server url');
    }
    this.serverUrl = serverUrl; // random.snode
    this.localUrl = localUrl; // localhost.loki
    this.swarmsPendingReplenish = {};
    this.stopGetAllVersionPromiseControl = false;

    this.onionPaths = [];
    this.guardNodes = [];
    this.onionRequestCounter = 0; // Request index for debugging
  }

  assignOnionRequestNumber() {
    this.onionRequestCounter += 1;
    return this.onionRequestCounter;
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
      // Log this line for testing
      // curl -k -X POST -H 'Content-Type: application/json' -d '"+fetchOptions.body.replace(/"/g, "\\'")+"'", url
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
    let nodePool = await window.SnodePool.getRandomSnodePool();
    if (nodePool.length === 0) {
      log.error(`Could not select guard nodes: node pool is empty`);
      return [];
    }

    let shuffled = _.shuffle(nodePool);

    let guardNodes = [];

    const DESIRED_GUARD_COUNT = 3;

    if (shuffled.length < DESIRED_GUARD_COUNT) {
      log.error(
        `Could not select guard nodes: node pool is not big enough, pool size ${shuffled.length}, need ${DESIRED_GUARD_COUNT}, attempting to refresh randomPool`
      );
      await window.SnodePool.refreshRandomPool();
      nodePool = await window.SnodePool.getRandomSnodePool();
      shuffled = _.shuffle(nodePool);
      if (shuffled.length < DESIRED_GUARD_COUNT) {
        log.error(
          `Could not select guard nodes: node pool is not big enough, pool size ${shuffled.length}, need ${DESIRED_GUARD_COUNT}, failing...`
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

    let goodPaths = this.onionPaths.filter(x => !x.bad);

    let attemptNumber = 0;
    while (goodPaths.length < MIN_GUARD_COUNT) {
      log.error(
        `Must have at least 2 good onion paths, actual: ${goodPaths.length}, attempt #${attemptNumber} fetching more...`
      );
      // eslint-disable-next-line no-await-in-loop
      await this.buildNewOnionPaths();
      // should we add a delay? buildNewOnionPaths should act as one

      // reload goodPaths now
      attemptNumber += 1;
      goodPaths = this.onionPaths.filter(x => !x.bad);
    }

    const paths = _.shuffle(goodPaths);

    if (!toExclude) {
      if (!paths[0]) {
        log.error('LokiSnodeAPI::getOnionPath - no path in', paths);
        return [];
      }
      if (!paths[0].path) {
        log.error('LokiSnodeAPI::getOnionPath - no path in', paths[0]);
      }
      return paths[0].path;
    }

    // Select a path that doesn't contain `toExclude`
    const otherPaths = paths.filter(
      path =>
        !_.some(path, node => node.pubkey_ed25519 === toExclude.pubkey_ed25519)
    );

    if (otherPaths.length === 0) {
      // This should never happen!
      // well it did happen, should we
      // await this.buildNewOnionPaths();
      // and restart call?
      log.error(
        `LokiSnodeAPI::getOnionPath - no paths without`,
        toExclude.pubkey_ed25519,
        'path count',
        paths.length,
        'goodPath count',
        goodPaths.length,
        'paths',
        paths
      );
      throw new Error('No onion paths available after filtering');
    }

    if (!otherPaths[0].path) {
      log.error(
        'LokiSnodeAPI::getOnionPath - otherPaths no path in',
        otherPaths[0]
      );
    }

    return otherPaths[0].path;
  }

  markPathAsBad(path) {
    this.onionPaths.forEach(p => {
      if (!p.path) {
        log.error('LokiSnodeAPI::markPathAsBad - no path in', p);
      }
      if (p.path === path) {
        // eslint-disable-next-line no-param-reassign
        p.bad = true;
      }
    });
  }

  async buildNewOnionPathsWorker() {
    const _ = window.Lodash;

    log.info('LokiSnodeAPI::buildNewOnionPaths - building new onion paths');

    const allNodes = await window.SnodePool.getRandomSnodePool();

    if (this.guardNodes.length === 0) {
      // Not cached, load from DB
      const nodes = await window.libloki.storage.getGuardNodes();

      if (nodes.length === 0) {
        log.warn(
          'LokiSnodeAPI::buildNewOnionPaths - no guard nodes in DB. Will be selecting new guards nodes...'
        );
      } else {
        // We only store the nodes' keys, need to find full entries:
        const edKeys = nodes.map(x => x.ed25519PubKey);
        this.guardNodes = allNodes.filter(
          x => edKeys.indexOf(x.pubkey_ed25519) !== -1
        );

        if (this.guardNodes.length < edKeys.length) {
          log.warn(
            `LokiSnodeAPI::buildNewOnionPaths - could not find some guard nodes: ${this.guardNodes.length}/${edKeys.length} left`
          );
        }
      }

      // If guard nodes is still empty (the old nodes are now invalid), select new ones:
      if (this.guardNodes.length < MIN_GUARD_COUNT) {
        // TODO: don't throw away potentially good guard nodes
        this.guardNodes = await this.selectGuardNodes();
      }
    }

    // TODO: select one guard node and 2 other nodes randomly
    let otherNodes = _.difference(allNodes, this.guardNodes);

    if (otherNodes.length < 2) {
      log.warn(
        'LokiSnodeAPI::buildNewOnionPaths - Too few nodes to build an onion path! Refreshing pool and retrying'
      );
      await window.SnodePool.refreshRandomPool();
      await this.buildNewOnionPaths();
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

  async buildNewOnionPaths() {
    // this function may be called concurrently make sure we only have one inflight
    return primitives.allowOnlyOneAtATime('buildNewOnionPaths', async () => {
      await this.buildNewOnionPathsWorker();
    });
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
      if (!conversation) {
        throw new Error('Could not find conversation ', pubKey);
      }
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
              `LokiSnodeAPI::getSwarmNodesForPubKey - ${j} ${node.ip}:${node.port}`
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
        `LokiSnodeAPI::updateSwarmNodes - error ${e.code} ${e.message}`
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
    log.debug(
      'LokiSnodeAPI::refreshSwarmNodesForPubKey - newNodes',
      newNodes.length
    );
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
          'LokiSnodeAPI::_getFreshSwarmNodes - error',
          e.code,
          e.message
        );
        // TODO: Handle these errors sensibly
        newSwarmNodes = [];
      }
      return newSwarmNodes;
    });
  }

  async getLnsMapping(lnsName, timeout) {
    // Returns { pubkey, error }
    // pubkey is
    //      undefined when unconfirmed or no mapping found
    //      string    when found
    // timeout parameter optional (ms)

    // How many nodes to fetch data from?
    const numRequests = 5;

    // How many nodes must have the same response value?
    const numRequiredConfirms = 3;

    let ciphertextHex;
    let pubkey;
    let error;

    const _ = window.Lodash;

    const input = Buffer.from(lnsName);
    const output = await window.blake2b(input);
    const nameHash = dcodeIO.ByteBuffer.wrap(output).toString('base64');

    // Timeouts
    const maxTimeoutVal = 2 ** 31 - 1;
    const timeoutPromise = () =>
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(), timeout || maxTimeoutVal)
      );

    // Get nodes capable of doing LNS
    const lnsNodes = await window.SnodePool.getNodesMinVersion(
      window.CONSTANTS.LNS_CAPABLE_NODES_VERSION
    );

    // Enough nodes?
    if (lnsNodes.length < numRequiredConfirms) {
      error = { lnsTooFewNodes: window.i18n('lnsTooFewNodes') };
      return { pubkey, error };
    }

    const confirmedNodes = [];

    // Promise is only resolved when a consensus is found
    let cipherResolve;
    const cipherPromise = () =>
      new Promise(resolve => {
        cipherResolve = resolve;
      });

    const decryptHex = async cipherHex => {
      const ciphertext = new Uint8Array(StringView.hexToArrayBuffer(cipherHex));

      const res = await window.decryptLnsEntry(lnsName, ciphertext);
      const publicKey = StringView.arrayBufferToHex(res);

      return publicKey;
    };

    const fetchFromNode = async node => {
      const res = await window.NewSnodeAPI._requestLnsMapping(node, nameHash);

      // Do validation
      if (res && res.result && res.result.status === 'OK') {
        const hasMapping = res.result.entries && res.result.entries.length > 0;

        const resValue = hasMapping
          ? res.result.entries[0].encrypted_value
          : null;

        confirmedNodes.push(resValue);

        if (confirmedNodes.length >= numRequiredConfirms) {
          if (ciphertextHex) {
            // Result already found, dont worry
            return;
          }

          const [winner, count] = _.maxBy(
            _.entries(_.countBy(confirmedNodes)),
            x => x[1]
          );

          if (count >= numRequiredConfirms) {
            ciphertextHex = winner === String(null) ? null : winner;

            // null represents no LNS mapping
            if (ciphertextHex === null) {
              error = { lnsMappingNotFound: window.i18n('lnsMappingNotFound') };
            }

            cipherResolve({ ciphertextHex });
          }
        }
      }
    };

    const nodes = lnsNodes.splice(0, numRequests);

    // Start fetching from nodes
    nodes.forEach(node => fetchFromNode(node));

    // Timeouts (optional parameter)
    // Wait for cipher to be found; race against timeout
    // eslint-disable-next-line more/no-then
    await Promise.race([cipherPromise, timeoutPromise].map(f => f()))
      .then(async () => {
        if (ciphertextHex !== null) {
          pubkey = await decryptHex(ciphertextHex);
        }
      })
      .catch(() => {
        error = { lnsLookupTimeout: window.i18n('lnsLookupTimeout') };
      });

    return { pubkey, error };
  }

  async _getSwarmNodes(pubKey) {
    const snodes = [];
    // creates a range: [0, 1, 2]
    const questions = [...Array(RANDOM_SNODES_TO_USE_FOR_PUBKEY_SWARM).keys()];
    // FIXME: handle rejections
    await Promise.all(
      questions.map(async qNum => {
        // allow exceptions to pass through upwards
        const resList = await window.NewSnodeAPI.getSnodesForPubkey(pubKey);
        log.info(
          `LokiSnodeAPI::_getSwarmNodes - question ${qNum} got`,
          resList.length,
          'snodes'
        );
        resList.map(item => {
          const hasItem = snodes.some(n => compareSnodes(n, item));
          if (!hasItem) {
            snodes.push(item);
          }
          return true;
        });
      })
    );
    // should we only activate entries that are in all results? yes
    return snodes;
  }
}

module.exports = LokiSnodeAPI;
