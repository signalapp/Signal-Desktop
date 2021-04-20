import semver from 'semver';
import _ from 'lodash';

import {
  abortableIterator,
  allowOnlyOneAtATime,
} from '../../../js/modules/loki_primitives';

import { getSnodesFromSeedUrl, requestSnodesForPubkey } from './serviceNodeAPI';

import {
  getSwarmNodesForPubkey,
  updateSwarmNodesForPubkey,
} from '../../../ts/data/data';

export type SnodeEdKey = string;

const MIN_NODES = 3;

export interface Snode {
  ip: string;
  port: number;
  pubkey_x25519: string;
  pubkey_ed25519: SnodeEdKey;
  version: string;
}

// This should be renamed to `allNodes` or something
let randomSnodePool: Array<Snode> = [];
let stopGetAllVersionPromiseControl: any = false;

// We only store nodes' identifiers here,
const nodesForPubkey: Map<string, Array<SnodeEdKey>> = new Map();

// just get the filtered list
async function tryGetSnodeListFromLokidSeednode(
  seedNodes = window.seedNodeList
): Promise<Array<Snode>> {
  const { log } = window;

  if (!seedNodes.length) {
    log.info(
      'loki_snode_api::tryGetSnodeListFromLokidSeednode - seedNodes are empty'
    );
    return [];
  }

  const seedNode = _.sample(seedNodes);
  if (!seedNode) {
    log.warn(
      'loki_snode_api::tryGetSnodeListFromLokidSeednode - Could not select random snodes from',
      seedNodes
    );
    return [];
  }
  let snodes = [];
  try {
    const tryUrl = new URL(seedNode.url);

    snodes = await getSnodesFromSeedUrl(tryUrl);
    // throw before clearing the lock, so the retries can kick in
    if (snodes.length === 0) {
      log.warn(
        `loki_snode_api::tryGetSnodeListFromLokidSeednode - ${seedNode.url} did not return any snodes, falling back to IP`,
        seedNode.ip_url
      );
      // fall back on ip_url
      const tryIpUrl = new URL(seedNode.ip_url);
      snodes = await getSnodesFromSeedUrl(tryIpUrl);
      if (snodes.length === 0) {
        log.warn(
          `loki_snode_api::tryGetSnodeListFromLokidSeednode - ${seedNode.ip_url} did not return any snodes`
        );
        // does this error message need to be exactly this?
        throw new window.textsecure.SeedNodeError(
          'Failed to contact seed node'
        );
      }
    }
    if (snodes.length) {
      log.info(
        `loki_snode_api::tryGetSnodeListFromLokidSeednode - ${seedNode.url} returned ${snodes.length} snodes`
      );
    }
    return snodes;
  } catch (e) {
    log.warn(
      'LokiSnodeAPI::tryGetSnodeListFromLokidSeednode - error',
      e.code,
      e.message,
      'on',
      seedNode
    );
    if (snodes.length === 0) {
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
  }
  return [];
}

export function markNodeUnreachable(snode: Snode): void {
  const { log } = window;
  _.remove(randomSnodePool, x => x.pubkey_ed25519 === snode.pubkey_ed25519);

  for (const [pubkey, nodes] of nodesForPubkey) {
    const edkeys = _.filter(nodes, edkey => edkey !== snode.pubkey_ed25519);

    void internalUpdateSnodesFor(pubkey, edkeys);
  }

  log.warn(
    `Marking ${snode.ip}:${snode.port} as unreachable, ${randomSnodePool.length} snodes remaining in randomPool`
  );
}

export async function getRandomSnodeAddress(): Promise<Snode> {
  // resolve random snode
  if (randomSnodePool.length === 0) {
    // TODO: ensure that we only call this once at a time
    // Should not this be saved to the database?
    await refreshRandomPool([]);

    if (randomSnodePool.length === 0) {
      throw new window.textsecure.SeedNodeError('Invalid seed node response');
    }
  }

  // We know the pool can't be empty at this point
  return _.sample(randomSnodePool) as Snode;
}

function compareSnodes(lhs: any, rhs: any): boolean {
  return lhs.pubkey_ed25519 === rhs.pubkey_ed25519;
}

/**
 * Request the version of the snode.
 * THIS IS AN INSECURE NODE FETCH and leaks our IP to all snodes but with no other identifying information
 * except "that a client started up" or "ran out of random pool snodes"
 * and the order of the list is randomized, so a snode can't tell if it just started or not
 */
async function requestVersion(node: any): Promise<void> {
  const { log } = window;

  // WARNING: getVersion is doing an insecure node fetch.
  // be sure to update getVersion to onion routing if we need this call again.
  const result = false; // await getVersion(node);

  if (result === false) {
    return;
  }

  const version = result as string;

  const foundNodeIdx = randomSnodePool.findIndex((n: any) =>
    compareSnodes(n, node)
  );
  if (foundNodeIdx !== -1) {
    randomSnodePool[foundNodeIdx].version = version;
  } else {
    // maybe already marked bad...
    log.debug(
      `LokiSnodeAPI::_getVersion - can't find ${node.ip}:${node.port} in randomSnodePool`
    );
  }
}

export async function getRandomSnodePool(): Promise<Array<Snode>> {
  if (randomSnodePool.length === 0) {
    await refreshRandomPool([]);
  }
  return randomSnodePool;
}

// not cacheable because we write to this.randomSnodePool elsewhere
export function getNodesMinVersion(minVersion: string): Array<Snode> {
  return randomSnodePool.filter(
    (node: any) => node.version && semver.gt(node.version, minVersion)
  );
}

/**
 * Currently unused as it makes call over insecure node fetch and we don't need
 * to filter out nodes by versions anymore.
 *
 * now get version for all snodes
 * also acts an early online test/purge of bad nodes
 */
export async function getAllVersionsForRandomSnodePool(): Promise<void> {
  const { log } = window;

  // let count = 0;
  // const verionStart = Date.now();
  // const total = this.randomSnodePool.length;
  // const noticeEvery = parseInt(total / 10, 10);
  const loop = abortableIterator(randomSnodePool, async (node: any) => {
    try {
      await requestVersion(node);
    } catch (e) {
      log.error(
        'LokiSnodeAPI::_getAllVersionsForRandomSnodePool - error',
        e.code,
        e.message
      );
      throw e;
    }
  });
  // make abortable accessible outside this scope
  stopGetAllVersionPromiseControl = loop.stop;
  await loop.start(true);
  stopGetAllVersionPromiseControl = false; // clear lock
  // an array of objects
  const versions = randomSnodePool.reduce((curVal: any, node: any) => {
    if (curVal.indexOf(node.version) === -1) {
      curVal.push(node.version);
    }
    return curVal;
  }, []);
  log.debug(
    `LokiSnodeAPI::_getAllVersionsForRandomSnodePool - ${versions.length} versions retrieved from network!:`,
    versions.join(',')
  );
}

async function getSnodeListFromLokidSeednode(
  seedNodes = window.seedNodeList,
  retries = 0
): Promise<Array<Snode>> {
  const SEED_NODE_RETRIES = 3;

  const { log } = window;

  if (!seedNodes.length) {
    log.info(
      'loki_snode_api::getSnodeListFromLokidSeednode - seedNodes are empty'
    );
    return [];
  }
  let snodes: Array<Snode> = [];
  try {
    snodes = await tryGetSnodeListFromLokidSeednode(seedNodes);
  } catch (e) {
    log.warn(
      'loki_snode_api::getSnodeListFromLokidSeednode - error',
      e.code,
      e.message
    );
    // handle retries in case of temporary hiccups
    if (retries < SEED_NODE_RETRIES) {
      setTimeout(() => {
        log.info(
          'loki_snode_api::getSnodeListFromLokidSeednode - Retrying initialising random snode pool, try #',
          retries,
          'seed nodes total',
          seedNodes.length
        );
        void getSnodeListFromLokidSeednode(seedNodes, retries + 1);
      }, retries * retries * 5000);
    } else {
      log.error('loki_snode_api::getSnodeListFromLokidSeednode - failing');
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
  }
  return snodes;
}

async function refreshRandomPoolDetail(seedNodes: Array<any>): Promise<void> {
  const { log } = window;

  // are we running any _getAllVersionsForRandomSnodePool
  if (stopGetAllVersionPromiseControl !== false) {
    // we are, stop them
    stopGetAllVersionPromiseControl();
  }
  let snodes = [];
  try {
    snodes = await getSnodeListFromLokidSeednode(seedNodes);
    // make sure order of the list is random, so we get version in a non-deterministic way
    snodes = _.shuffle(snodes);
    // commit changes to be live
    // we'll update the version (in case they upgrade) every cycle
    randomSnodePool = snodes.map((snode: any) => ({
      ip: snode.public_ip,
      port: snode.storage_port,
      pubkey_x25519: snode.pubkey_x25519,
      pubkey_ed25519: snode.pubkey_ed25519,
      version: '',
    }));
    log.info(
      'LokiSnodeAPI::refreshRandomPool - Refreshed random snode pool with',
      randomSnodePool.length,
      'snodes'
    );
    // Warning: the call below will call getVersions to all existing nodes.
    // And not with onion routing
    // void getAllVersionsForRandomSnodePool();
  } catch (e) {
    log.warn('LokiSnodeAPI::refreshRandomPool - error', e.code, e.message);
    /*
        log.error(
          'LokiSnodeAPI:::refreshRandomPoolPromise -  Giving up trying to contact seed node'
        );
        */
    if (snodes.length === 0) {
      throw new window.textsecure.SeedNodeError('Failed to contact seed node');
    }
  }
}

export async function refreshRandomPool(seedNodes?: Array<any>): Promise<void> {
  const { log } = window;

  if (!seedNodes || !seedNodes.length) {
    if (!window.seedNodeList || !window.seedNodeList.length) {
      log.error(
        'LokiSnodeAPI:::refreshRandomPool - seedNodeList has not been loaded yet'
      );
      return;
    }
    // tslint:disable-next-line:no-parameter-reassignment
    seedNodes = window.seedNodeList;
  }

  return allowOnlyOneAtATime('refreshRandomPool', async () => {
    if (seedNodes) {
      await refreshRandomPoolDetail(seedNodes);
    }
  });
}

export async function updateSnodesFor(
  pubkey: string,
  snodes: Array<Snode>
): Promise<void> {
  const edkeys = snodes.map((sn: Snode) => sn.pubkey_ed25519);
  await internalUpdateSnodesFor(pubkey, edkeys);
}

async function internalUpdateSnodesFor(pubkey: string, edkeys: Array<string>) {
  nodesForPubkey.set(pubkey, edkeys);
  await updateSwarmNodesForPubkey(pubkey, edkeys);
}

export async function getSnodesFor(pubkey: string): Promise<Array<Snode>> {
  const maybeNodes = nodesForPubkey.get(pubkey);
  let nodes: Array<string>;

  // NOTE: important that maybeNodes is not [] here
  if (maybeNodes === undefined) {
    // First time access, try the database:
    nodes = await getSwarmNodesForPubkey(pubkey);
    nodesForPubkey.set(pubkey, nodes);
  } else {
    nodes = maybeNodes;
  }

  // See how many are actually still reachable
  const goodNodes = randomSnodePool.filter(
    (n: Snode) => nodes.indexOf(n.pubkey_ed25519) !== -1
  );

  if (goodNodes.length < MIN_NODES) {
    // Request new node list from the network
    const freshNodes = _.shuffle(await requestSnodesForPubkey(pubkey));

    const edkeys = freshNodes.map((n: Snode) => n.pubkey_ed25519);
    void internalUpdateSnodesFor(pubkey, edkeys);
    // TODO: We could probably check that the retuned sndoes are not "unreachable"

    return freshNodes;
  } else {
    return goodNodes;
  }
}
