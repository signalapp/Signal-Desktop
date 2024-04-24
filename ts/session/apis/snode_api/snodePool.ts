import _, { shuffle } from 'lodash';
import pRetry from 'p-retry';

import { Data, Snode } from '../../../data/data';

import { OnionPaths } from '../../onions';
import { Onions, SnodePool } from '.';
import { SeedNodeAPI } from '../seed_node_api';
import { requestSnodesForPubkeyFromNetwork } from './getSwarmFor';
import { ServiceNodesList } from './getServiceNodesList';
import { ed25519Str } from '../../utils/String';

/**
 * If we get less than this snode in a swarm, we fetch new snodes for this pubkey
 */
const minSwarmSnodeCount = 3;

/**
 * If we get less than minSnodePoolCount we consider that we need to fetch the new snode pool from a seed node
 * and not from those snodes.
 */
export const minSnodePoolCount = 12;

/**
 * If we get less than this amount of snodes (24), lets try to get an updated list from those while we can
 */
export const minSnodePoolCountBeforeRefreshFromSnodes = minSnodePoolCount * 2;

/**
 * If we do a request to fetch nodes from snodes and they don't return at least
 * the same `requiredSnodesForAgreement` snodes we consider that this is not a valid return.
 *
 * Too many nodes are not shared for this call to be trustworthy
 */
export const requiredSnodesForAgreement = 24;

let randomSnodePool: Array<Snode> = [];

export function TEST_resetState() {
  randomSnodePool = [];
  swarmCache.clear();
}

// We only store nodes' identifiers here,
const swarmCache: Map<string, Array<string>> = new Map();

/**
 * Drop a snode from the snode pool. This does not update the swarm containing this snode.
 * Use `dropSnodeFromSwarmIfNeeded` for that
 * @param snodeEd25519 the snode ed25519 to drop from the snode pool
 */
export async function dropSnodeFromSnodePool(snodeEd25519: string) {
  const exists = _.some(randomSnodePool, x => x.pubkey_ed25519 === snodeEd25519);
  if (exists) {
    _.remove(randomSnodePool, x => x.pubkey_ed25519 === snodeEd25519);
    window?.log?.warn(
      `Droppping ${ed25519Str(snodeEd25519)} from snode pool. ${
        randomSnodePool.length
      } snodes remaining in randomPool`
    );
    await Data.updateSnodePoolOnDb(JSON.stringify(randomSnodePool));
  }
}

/**
 *
 * excludingEd25519Snode can be used to exclude some nodes from the random list.
 * Useful to rebuild a path excluding existing node already in a path
 */
export async function getRandomSnode(excludingEd25519Snode?: Array<string>): Promise<Snode> {
  // make sure we have a few snodes in the pool excluding the one passed as args
  const requiredCount = minSnodePoolCount + (excludingEd25519Snode?.length || 0);
  if (randomSnodePool.length < requiredCount) {
    await getSnodePoolFromDBOrFetchFromSeed(excludingEd25519Snode?.length);

    if (randomSnodePool.length < requiredCount) {
      window?.log?.warn(
        `getRandomSnode: failed to fetch snodes from seed. Current pool: ${randomSnodePool.length}`
      );

      throw new Error(
        `getRandomSnode: failed to fetch snodes from seed. Current pool: ${randomSnodePool.length}, required count: ${requiredCount}`
      );
    }
  }
  // We know the pool can't be empty at this point
  if (!excludingEd25519Snode) {
    return _.sample(randomSnodePool) as Snode;
  }

  // we have to double check even after removing the nodes to exclude we still have some nodes in the list
  const snodePoolExcluding = randomSnodePool.filter(
    e => !excludingEd25519Snode.includes(e.pubkey_ed25519)
  );
  if (!snodePoolExcluding || !snodePoolExcluding.length) {
    // used for tests
    throw new Error(`Not enough snodes with excluding length ${excludingEd25519Snode.length}`);
  }
  return _.sample(snodePoolExcluding) as Snode;
}

/**
 * This function force the snode poll to be refreshed from a random seed node or snodes if we have enough of them.
 * This should be called once in a day or so for when the app it kept on.
 */
export async function forceRefreshRandomSnodePool(): Promise<Array<Snode>> {
  try {
    await getSnodePoolFromDBOrFetchFromSeed();

    window?.log?.info(
      `forceRefreshRandomSnodePool: enough snodes to fetch from them, so we try using them ${randomSnodePool.length}`
    );

    // this function throws if it does not have enough snodes to do it
    await tryToGetConsensusWithSnodesWithRetries();
    if (randomSnodePool.length < minSnodePoolCountBeforeRefreshFromSnodes) {
      throw new Error('forceRefreshRandomSnodePool still too small after refetching from snodes');
    }
  } catch (e) {
    window?.log?.warn(
      'forceRefreshRandomSnodePool: Failed to fetch snode pool from snodes. Fetching from seed node instead:',
      e.message
    );

    // if that fails to get enough snodes, even after retries, well we just have to retry later.
    try {
      await SnodePool.TEST_fetchFromSeedWithRetriesAndWriteToDb();
    } catch (err2) {
      window?.log?.warn(
        'forceRefreshRandomSnodePool: Failed to fetch snode pool from seed. Fetching from seed node instead:',
        err2.message
      );
    }
  }

  return randomSnodePool;
}

/**
 * Fetches from DB if snode pool is not cached, and returns it if the length is >= 12.
 * If length is < 12, fetches from seed an updated list of snodes
 */
export async function getSnodePoolFromDBOrFetchFromSeed(
  countToAddToRequirement = 0
): Promise<Array<Snode>> {
  if (randomSnodePool && randomSnodePool.length > minSnodePoolCount + countToAddToRequirement) {
    return randomSnodePool;
  }
  const fetchedFromDb = await Data.getSnodePoolFromDb();

  if (!fetchedFromDb || fetchedFromDb.length <= minSnodePoolCount + countToAddToRequirement) {
    window?.log?.warn(
      `getSnodePoolFromDBOrFetchFromSeed: not enough snodes in db (${fetchedFromDb?.length}), Fetching from seed node instead... `
    );
    // if that fails to get enough snodes, even after retries, well we just have to retry later.
    // this call does not throw
    await SnodePool.TEST_fetchFromSeedWithRetriesAndWriteToDb();

    return randomSnodePool;
  }

  // write to memory only if it is valid.
  randomSnodePool = fetchedFromDb;
  return randomSnodePool;
}

export async function getRandomSnodePool(): Promise<Array<Snode>> {
  if (randomSnodePool.length <= minSnodePoolCount) {
    await getSnodePoolFromDBOrFetchFromSeed();
  }
  return randomSnodePool;
}

/**
 * This function tries to fetch snodes list from seednodes and handle retries.
 * It will write the updated snode list to the db once it succeeded.
 * It also resets the onionpaths failure count and snode failure count.
 * This function does not throw.
 */

export async function TEST_fetchFromSeedWithRetriesAndWriteToDb() {
  const seedNodes = window.getSeedNodeList();

  if (!seedNodes || !seedNodes.length) {
    window?.log?.error(
      'SessionSnodeAPI:::fetchFromSeedWithRetriesAndWriteToDb - getSeedNodeList has not been loaded yet'
    );

    return;
  }
  const start = Date.now();
  try {
    randomSnodePool = await SeedNodeAPI.fetchSnodePoolFromSeedNodeWithRetries(seedNodes);
    await Data.updateSnodePoolOnDb(JSON.stringify(randomSnodePool));
    window.log.info(`fetchSnodePoolFromSeedNodeWithRetries took ${Date.now() - start}ms`);

    OnionPaths.resetPathFailureCount();
    Onions.resetSnodeFailureCount();
  } catch (e) {
    window?.log?.error(
      'SessionSnodeAPI:::fetchFromSeedWithRetriesAndWriteToDb - Failed to fetch snode poll from seed node with retries. Error:',
      e
    );
  }
}

async function clearOutAllSnodesNotInPool(snodePool: Array<Snode>) {
  if (snodePool.length <= 10) {
    return;
  }
  const edKeysOfSnodePool = snodePool.map(m => m.pubkey_ed25519);

  await Data.clearOutAllSnodesNotInPool(edKeysOfSnodePool);

  // just remove all the cached entries, we will refetch them as needed from the DB
  swarmCache.clear();
}

/**
 * This function retries a few times to get a consensus between 3 snodes of at least 24 snodes in the snode pool.
 *
 * If a consensus cannot be made, this function throws an error and the caller needs to call the fetch snodes from seed.
 *
 */
async function tryToGetConsensusWithSnodesWithRetries() {
  // let this request try 4 (3+1) times. If all those requests end up without having a consensus,
  // fetch the snode pool from one of the seed nodes (see the catch).
  return pRetry(
    async () => {
      const commonNodes = await ServiceNodesList.getSnodePoolFromSnodes();

      if (!commonNodes || commonNodes.length < requiredSnodesForAgreement) {
        // throwing makes trigger a retry if we have some left.
        window?.log?.info(
          `tryToGetConsensusWithSnodesWithRetries: Not enough common nodes ${commonNodes?.length}`
        );
        throw new Error('Not enough common nodes.');
      }
      window?.log?.info(
        'Got consensus: updating snode list with snode pool length:',
        commonNodes.length
      );
      randomSnodePool = commonNodes;
      await Data.updateSnodePoolOnDb(JSON.stringify(randomSnodePool));
      await clearOutAllSnodesNotInPool(randomSnodePool);

      OnionPaths.resetPathFailureCount();
      Onions.resetSnodeFailureCount();
    },
    {
      retries: 3,
      factor: 1,
      minTimeout: 1000,
      onFailedAttempt: e => {
        window?.log?.warn(
          `tryToGetConsensusWithSnodesWithRetries attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
        );
      },
    }
  );
}

/**
 * Drop a snode from the list of swarm for that specific publicKey
 * @param pubkey the associatedWith publicKey
 * @param snodeToDropEd25519 the snode pubkey to drop
 */
export async function dropSnodeFromSwarmIfNeeded(
  pubkey: string,
  snodeToDropEd25519: string
): Promise<void> {
  // this call either used the cache or fetch the swarm from the db
  window?.log?.warn(
    `Dropping ${ed25519Str(snodeToDropEd25519)} from swarm of ${ed25519Str(pubkey)}`
  );

  const existingSwarm = await getSwarmFromCacheOrDb(pubkey);

  if (!existingSwarm.includes(snodeToDropEd25519)) {
    return;
  }

  const updatedSwarm = existingSwarm.filter(ed25519 => ed25519 !== snodeToDropEd25519);
  await internalUpdateSwarmFor(pubkey, updatedSwarm);
}

export async function updateSwarmFor(pubkey: string, snodes: Array<Snode>): Promise<void> {
  const edkeys = snodes.map((sn: Snode) => sn.pubkey_ed25519);
  await internalUpdateSwarmFor(pubkey, edkeys);
}

async function internalUpdateSwarmFor(pubkey: string, edkeys: Array<string>) {
  // update our in-memory cache
  swarmCache.set(pubkey, edkeys);
  // write this change to the db
  await Data.updateSwarmNodesForPubkey(pubkey, edkeys);
}

export async function getSwarmFromCacheOrDb(pubkey: string): Promise<Array<string>> {
  // NOTE: important that maybeNodes is not [] here
  const existingCache = swarmCache.get(pubkey);
  if (existingCache === undefined) {
    // First time access, no cache yet, let's try the database.
    const nodes = await Data.getSwarmNodesForPubkey(pubkey);
    // if no db entry, this returns []
    swarmCache.set(pubkey, nodes);
    return nodes;
  }
  // cache already set, use it
  return existingCache;
}

/**
 * This call fetch from cache or db the swarm and extract only the one currently reachable.
 * If not enough snodes valid are in the swarm, if fetches new snodes for this pubkey from the network.
 */
export async function getSwarmFor(pubkey: string): Promise<Array<Snode>> {
  const nodes = await getSwarmFromCacheOrDb(pubkey);

  // See how many are actually still reachable
  // the nodes still reachable are the one still present in the snode pool
  const goodNodes = randomSnodePool.filter((n: Snode) => nodes.indexOf(n.pubkey_ed25519) !== -1);

  if (goodNodes.length >= minSwarmSnodeCount) {
    return goodNodes;
  }

  // Request new node list from the network and save it
  return getSwarmFromNetworkAndSave(pubkey);
}

/**
 * Force a request to be made to the network to fetch the swarm of the specificied pubkey, and cache the result.
 * Note: should not be called directly unless you know what you are doing. Use the cached `getSwarmFor()` function instead
 * @param pubkey the pubkey to request the swarm for
 * @returns the fresh swarm, shuffled
 */
export async function getFreshSwarmFor(pubkey: string): Promise<Array<Snode>> {
  return getSwarmFromNetworkAndSave(pubkey);
}

async function getSwarmFromNetworkAndSave(pubkey: string) {
  // Request new node list from the network
  const swarm = await requestSnodesForPubkeyFromNetwork(pubkey);
  const shuffledSwarm = shuffle(swarm);

  const edkeys = shuffledSwarm.map((n: Snode) => n.pubkey_ed25519);
  await internalUpdateSwarmFor(pubkey, edkeys);

  return shuffledSwarm;
}
