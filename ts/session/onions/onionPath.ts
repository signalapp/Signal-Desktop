/* eslint-disable import/no-mutable-exports */
/* eslint-disable no-await-in-loop */
import _, { compact, sample } from 'lodash';
import pRetry from 'p-retry';
// eslint-disable-next-line import/no-named-default
import { default as insecureNodeFetch } from 'node-fetch';

import { OnionPaths } from '.';
import { Data } from '../../data/data';
import { Snode } from '../../data/types';
import { updateOnionPaths } from '../../state/ducks/onion';
import { APPLICATION_JSON } from '../../types/MIME';
import { Onions, snodeHttpsAgent } from '../apis/snode_api/onions';
import { ERROR_CODE_NO_CONNECT } from '../apis/snode_api/SNodeAPI';
import * as SnodePool from '../apis/snode_api/snodePool';
import { DURATION } from '../constants';
import { UserUtils } from '../utils';
import { allowOnlyOneAtATime } from '../utils/Promise';
import { ed25519Str } from '../utils/String';

const desiredGuardCount = 3;
const minimumGuardCount = 2;
const ONION_REQUEST_HOPS = 3;

export function getOnionPathMinTimeout() {
  return DURATION.SECONDS;
}

export let onionPaths: Array<Array<Snode>> = [];

/**
 * Used for testing only
 * @returns a copy of the onion path currently used by the app.
 *
 */

export const TEST_getTestOnionPath = () => {
  return _.cloneDeep(onionPaths);
};

export const TEST_getTestguardNodes = () => {
  return _.cloneDeep(guardNodes);
};

/**
 * Used for testing only. Clears the saved onion paths
 *
 */
export const clearTestOnionPath = () => {
  onionPaths = [];
  guardNodes = [];
};

//
/**
 * hold the failure count of the path starting with the snode ed25519 pubkey.
 * exported just for tests. do not interact with this directly
 */
export let pathFailureCount: Record<string, number> = {};

export const resetPathFailureCount = () => {
  pathFailureCount = {};
};

// The number of times a path can fail before it's replaced.
const pathFailureThreshold = 3;

// This array is meant to store nodes will full info,
// so using GuardNode would not be correct (there is
// some naming issue here it seems)
export let guardNodes: Array<Snode> = [];

export async function buildNewOnionPathsOneAtATime() {
  // this function may be called concurrently make sure we only have one inflight
  return allowOnlyOneAtATime('buildNewOnionPaths', async () => {
    try {
      await buildNewOnionPathsWorker();
    } catch (e) {
      window?.log?.warn(`buildNewOnionPathsWorker failed with ${e.message}`);
    }
  });
}

/**
 * Once a snode is causing too much trouble, we remove it from the path it is used in.
 * If we can rebuild a new path right away (in sync) we do it, otherwise we throw an error.
 *
 * The process to rebuild a path is easy:
 * 1. remove the snode causing issue in the path where it is used
 * 2. get a random snode from the pool excluding all current snodes in use in all paths
 * 3. append the random snode to the old path which was failing
 * 4. you have rebuilt path
 *
 * @param snodeEd25519 the snode pubkey to drop
 */
export async function dropSnodeFromPath(snodeEd25519: string) {
  const pathWithSnodeIndex = onionPaths.findIndex(path =>
    path.some(snode => snode.pubkey_ed25519 === snodeEd25519)
  );

  if (pathWithSnodeIndex === -1) {
    window?.log?.warn(`Could not drop ${ed25519Str(snodeEd25519)} as it is not in any paths`);
    // this can happen for instance if the snode given is the destination snode.
    // like a `retrieve` request returns node not found being the request the snode is made to.
    // in this case, nothing bad is happening for the path. We just have to use another snode to do the request
    return;
  }
  window?.log?.info(
    `dropping snode ${ed25519Str(snodeEd25519)} from path index: ${pathWithSnodeIndex}`
  );
  // make a copy now so we don't alter the real one while doing stuff here
  const oldPaths = _.cloneDeep(onionPaths);

  let pathtoPatchUp = oldPaths[pathWithSnodeIndex];
  // remove the snode causing issue from this path
  const nodeToRemoveIndex = pathtoPatchUp.findIndex(snode => snode.pubkey_ed25519 === snodeEd25519);

  // this should not happen, but well...
  if (nodeToRemoveIndex === -1) {
    return;
  }

  pathtoPatchUp = pathtoPatchUp.filter(snode => snode.pubkey_ed25519 !== snodeEd25519);

  const ed25519KeysToExclude = _.flattenDeep(oldPaths).map(m => m.pubkey_ed25519);
  // this call throws if it cannot return a valid snode.
  const snodeToAppendToPath = await SnodePool.getRandomSnode(ed25519KeysToExclude);
  // Don't test the new snode as this would reveal the user's IP
  pathtoPatchUp.push(snodeToAppendToPath);
  onionPaths[pathWithSnodeIndex] = pathtoPatchUp;
}

export async function getOnionPath({ toExclude }: { toExclude?: Snode }): Promise<Array<Snode>> {
  let attemptNumber = 0;

  // the buildNewOnionPathsOneAtATime will try to fetch from seed if it needs more snodes
  while (onionPaths.length < minimumGuardCount) {
    window?.log?.info(
      `getOnionPath: Must have at least ${minimumGuardCount} good onion paths, actual: ${onionPaths.length}, attempt #${attemptNumber}`
    );
    try {
      // eslint-disable-next-line no-await-in-loop
      await buildNewOnionPathsOneAtATime();
    } catch (e) {
      window?.log?.warn(`buildNewOnionPathsOneAtATime failed with ${e.message}`);
    }
    // should we add a delay? buildNewOnionPathsOneA  tATime should act as one

    // reload goodPaths now
    attemptNumber += 1;

    if (attemptNumber >= 10) {
      window?.log?.error('Failed to get an onion path after 10 attempts');
      throw new Error(`Failed to build enough onion paths, current count: ${onionPaths.length}`);
    }
  }
  onionPaths = onionPaths.map(compact);

  if (onionPaths.length === 0) {
    if (!_.isEmpty(window.inboxStore?.getState().onionPaths.snodePaths)) {
      window.inboxStore?.dispatch(updateOnionPaths([]));
    }
  } else {
    const ipsOnly = onionPaths.map(m =>
      m.map(c => {
        return { ip: c.ip };
      })
    );
    if (!_.isEqual(window.inboxStore?.getState().onionPaths.snodePaths, ipsOnly)) {
      window.inboxStore?.dispatch(updateOnionPaths(ipsOnly));
    }
  }

  if (!toExclude) {
    // no need to exclude a node, then just return a random path from the list of path
    if (!onionPaths || onionPaths.length === 0) {
      throw new Error('No onion paths available');
    }
    const randomPathNoExclude = _.sample(onionPaths);
    if (!randomPathNoExclude) {
      throw new Error('No onion paths available');
    }
    return randomPathNoExclude;
  }

  // here we got a snode to exclude from the returned path
  const onionPathsWithoutExcluded = onionPaths.filter(
    path => !_.some(path, node => node.pubkey_ed25519 === toExclude.pubkey_ed25519)
  );

  if (!onionPathsWithoutExcluded || onionPathsWithoutExcluded.length === 0) {
    throw new Error('No onion paths available after filtering');
  }
  const randomPath = _.sample(onionPathsWithoutExcluded);
  if (!randomPath) {
    throw new Error('No onion paths available after filtering');
  }
  return randomPath;
}

/**
 * If we don't know which nodes is causing trouble, increment the issue with this full path.
 */
export async function incrementBadPathCountOrDrop(snodeEd25519: string) {
  const pathWithSnodeIndex = onionPaths.findIndex(path =>
    path.some(snode => snode.pubkey_ed25519 === snodeEd25519)
  );

  if (pathWithSnodeIndex === -1) {
    window?.log?.info('incrementBadPathCountOrDrop: Did not find any path containing this snode');
    // this might happen if the snodeEd25519 is the one of the target snode, just increment the target snode count by 1
    await Onions.incrementBadSnodeCountOrDrop({ snodeEd25519 });

    return undefined;
  }

  const guardNodeEd25519 = onionPaths[pathWithSnodeIndex][0].pubkey_ed25519;

  window?.log?.info(
    `incrementBadPathCountOrDrop starting with guard ${ed25519Str(guardNodeEd25519)}`
  );

  const pathWithIssues = onionPaths[pathWithSnodeIndex];

  window?.log?.info('handling bad path for path index', pathWithSnodeIndex);
  const oldPathFailureCount = pathFailureCount[guardNodeEd25519] || 0;

  const newPathFailureCount = oldPathFailureCount + 1;
  // skip the first one as the first one is the guard node.
  // a guard node is dropped when the path is dropped completely (in dropPathStartingWithGuardNode)
  for (let index = 1; index < pathWithIssues.length; index++) {
    const snode = pathWithIssues[index];
    await Onions.incrementBadSnodeCountOrDrop({ snodeEd25519: snode.pubkey_ed25519 });
  }

  if (newPathFailureCount >= pathFailureThreshold) {
    return dropPathStartingWithGuardNode(guardNodeEd25519);
  }
  // the path is not yet THAT bad. keep it for now
  pathFailureCount[guardNodeEd25519] = newPathFailureCount;
  return undefined;
}

/**
 * This function is used to drop a path and its corresponding guard node.
 * It writes to the db the updated list of guardNodes.
 * @param ed25519Key the guard node ed25519 pubkey
 */
async function dropPathStartingWithGuardNode(guardNodeEd25519: string) {
  await SnodePool.dropSnodeFromSnodePool(guardNodeEd25519);

  const failingPathIndex = onionPaths.findIndex(p => p[0].pubkey_ed25519 === guardNodeEd25519);
  if (failingPathIndex === -1) {
    window?.log?.warn('No such path starts with this guard node ');
  } else {
    window?.log?.info(
      `Dropping path starting with guard node ${ed25519Str(
        guardNodeEd25519
      )}; index:${failingPathIndex}`
    );
    onionPaths = onionPaths.filter(p => p[0].pubkey_ed25519 !== guardNodeEd25519);
  }

  // make sure to drop the guard node even if the path starting with this guard node is not found
  guardNodes = guardNodes.filter(g => g.pubkey_ed25519 !== guardNodeEd25519);
  // write the updates guard nodes to the db.
  await internalUpdateGuardNodes(guardNodes);
  // we are dropping it. Reset the counter in case this same guard gets chosen later
  pathFailureCount[guardNodeEd25519] = 0;

  // trigger path rebuilding for the dropped path. This will throw if anything happens
  await buildNewOnionPathsOneAtATime();
}

async function internalUpdateGuardNodes(updatedGuardNodes: Array<Snode>) {
  const edKeys = updatedGuardNodes.map(n => n.pubkey_ed25519);

  await Data.updateGuardNodes(edKeys);
}

export async function testGuardNode(snode: Snode) {
  window?.log?.info(`Testing a candidate guard node ${ed25519Str(snode.pubkey_ed25519)}`);

  // Send a post request and make sure it is OK
  const endpoint = '/storage_rpc/v1';

  const url = `https://${snode.ip}:${snode.port}${endpoint}`;

  const ourPK = UserUtils.getOurPubKeyStrFromCache();

  const method = 'get_swarm';
  const params = { pubkey: ourPK };
  const body = {
    jsonrpc: '2.0',
    method,
    params,
  };

  const fetchOptions = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': APPLICATION_JSON,
      'User-Agent': 'WhatsApp',
      'Accept-Language': 'en-us',
    },
    timeout: 10000, // 10s, we want a smaller timeout for testing
    agent: snodeHttpsAgent,
  };

  let response;

  try {
    // Log this line for testing
    // curl -k -X POST -H 'Content-Type: application/json' -d '"+fetchOptions.body.replace(/"/g, "\\'")+"'", url
    window?.log?.info('insecureNodeFetch => plaintext for testGuardNode');

    response = await insecureNodeFetch(url, fetchOptions);
  } catch (e) {
    if (e.type === 'request-timeout') {
      window?.log?.warn('test :,', ed25519Str(snode.pubkey_ed25519));
    }
    if (e.code === 'ENETUNREACH') {
      window?.log?.warn('no network on node,', snode);
      throw new pRetry.AbortError(ERROR_CODE_NO_CONNECT);
    }
    return false;
  }

  if (!response.ok) {
    await response.text();
    window?.log?.info('Node failed the guard test:', snode);
  }

  return response.ok;
}

/**
 * Only exported for testing purpose.
 * If the random snode p
 */
export async function selectGuardNodes(): Promise<Array<Snode>> {
  // `getSnodePoolFromDBOrFetchFromSeed` does not refetch stuff. It just throws.
  // this is to avoid having circular dependencies of path building, needing new snodes, which needs new paths building...
  const nodePool = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();

  window.log.info(`selectGuardNodes snodePool length: ${nodePool.length}`);
  if (nodePool.length < SnodePool.minSnodePoolCount) {
    window?.log?.error(
      `Could not select guard nodes. Not enough nodes in the pool: ${nodePool.length}`
    );
    throw new Error(
      `Could not select guard nodes. Not enough nodes in the pool: ${nodePool.length}`
    );
  }

  const shuffled = _.shuffle(nodePool);

  let selectedGuardNodes: Array<Snode> = [];

  let attempts = 0;

  // The use of await inside while is intentional:
  // we only want to repeat if the await fails
  // eslint-disable-next-line-no-await-in-loop
  while (selectedGuardNodes.length < desiredGuardCount) {
    if (!window.getGlobalOnlineStatus()) {
      window?.log?.error('selectedGuardNodes: offline');
      throw new Error('selectedGuardNodes: offline');
    }

    const candidateNodes = shuffled.splice(0, desiredGuardCount);

    if (attempts > 5) {
      // too many retries. something is wrong.
      window.log.info(`selectGuardNodes stopping after attempts: ${attempts}`);
      throw new Error(`selectGuardNodes stopping after attempts: ${attempts}`);
    }
    window.log.info(`selectGuardNodes attempts: ${attempts}`);

    // Test all three nodes at once, wait for all to resolve or reject
    // eslint-disable-next-line no-await-in-loop
    const idxOk = (await Promise.allSettled(candidateNodes.map(OnionPaths.testGuardNode))).flatMap(
      p => (p.status === 'fulfilled' ? p.value : null)
    );

    const goodNodes = _.zip(idxOk, candidateNodes)
      .filter(x => x[0])
      .map(x => x[1]) as Array<Snode>;

    selectedGuardNodes = _.concat(selectedGuardNodes, goodNodes);
    attempts++;
  }

  guardNodes = selectedGuardNodes.slice(0, desiredGuardCount);
  if (guardNodes.length < desiredGuardCount) {
    window?.log?.error(`Cound't get enough guard nodes, only have: ${guardNodes.length}`);
    throw new Error(`Cound't get enough guard nodes, only have: ${guardNodes.length}`);
  }

  await internalUpdateGuardNodes(guardNodes);

  return guardNodes;
}

/**
 * Fetches from db if needed the current guard nodes.
 * If we do find in the snode pool (cached or got from seed in here) those guard nodes, use them.
 * Otherwise select new guard nodes (might refetch from seed if needed).
 *
 * This function might throw
 *
 * This function will not try to fetch snodes from snodes. Only from seed.
 * This is to avoid circular dependency of building new path needing new snodes, which needs a new path,...
 */
export async function getGuardNodeOrSelectNewOnes() {
  if (guardNodes.length === 0) {
    // Not cached, load from DB
    const guardNodesFromDb = await Data.getGuardNodes();

    if (guardNodesFromDb.length === 0) {
      window?.log?.warn(
        'SessionSnodeAPI::getGuardNodeOrSelectNewOnes - no guard nodes in DB. Will be selecting new guards nodes...'
      );
    } else {
      const allNodes = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
      // We only store the nodes' keys, need to find full entries:
      const edKeys = guardNodesFromDb.map(x => x.ed25519PubKey);
      guardNodes = allNodes.filter(x => edKeys.indexOf(x.pubkey_ed25519) !== -1);
      if (guardNodes.length < edKeys.length) {
        window?.log?.warn(
          `SessionSnodeAPI::getGuardNodeOrSelectNewOnes - could not find some guard nodes: ${guardNodes.length}/${edKeys.length} left`
        );
      }
    }
  }
  // If guard nodes is still empty (the old nodes are now invalid), select new ones:
  if (guardNodes.length < desiredGuardCount) {
    // if an error is thrown, the caller must take care of it.
    const start = Date.now();
    guardNodes = await OnionPaths.selectGuardNodes();
    window.log.info(`OnionPaths.selectGuardNodes took ${Date.now() - start}ms`);
  }
}

async function buildNewOnionPathsWorker() {
  return pRetry(
    async () => {
      window?.log?.info('SessionSnodeAPI::buildNewOnionPaths - building new onion paths...');

      // get an up to date list of snodes from cache, from db, or from the a seed node.
      let allNodes = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();

      if (allNodes.length <= SnodePool.minSnodePoolCount) {
        throw new Error(`Cannot rebuild path as we do not have enough snodes: ${allNodes.length}`);
      }

      // make sure we have enough guard nodes to build the paths
      // this function will throw if for some reason we cannot do it
      await OnionPaths.getGuardNodeOrSelectNewOnes();

      // be sure to fetch again as that list might have been refreshed by selectGuardNodes
      allNodes = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
      window?.log?.info(
        `SessionSnodeAPI::buildNewOnionPaths, snodePool length: ${allNodes.length}`
      );
      // get all snodes minus the selected guardNodes
      if (allNodes.length <= SnodePool.minSnodePoolCount) {
        throw new Error('Too few nodes to build an onion path. Even after fetching from seed.');
      }

      // make sure to not reuse multiple times the same subnet /24
      const allNodesGroupedBySubnet24 = _.groupBy(allNodes, e => {
        const lastDot = e.ip.lastIndexOf('.');
        return e.ip.substr(0, lastDot);
      });
      const oneNodeForEachSubnet24KeepingRatio = _.flatten(
        _.map(allNodesGroupedBySubnet24, group => {
          return _.fill(Array(group.length), _.sample(group) as Snode);
        })
      );
      if (oneNodeForEachSubnet24KeepingRatio.length <= SnodePool.minSnodePoolCount) {
        throw new Error(
          'Too few nodes "unique by ip" to build an onion path. Even after fetching from seed.'
        );
      }
      let otherNodes = _.differenceBy(
        oneNodeForEachSubnet24KeepingRatio,
        guardNodes,
        'pubkey_ed25519'
      );
      const guards = _.shuffle(guardNodes);

      // Create path for every guard node:
      const nodesNeededPerPaths = ONION_REQUEST_HOPS - 1;

      // Each path needs nodesNeededPerPaths nodes in addition to the guard node:
      const maxPath = Math.floor(Math.min(guards.length, otherNodes.length / nodesNeededPerPaths));
      window?.log?.info(
        `Building ${maxPath} onion paths based on guard nodes length: ${guards.length}, other nodes length ${otherNodes.length} `
      );

      onionPaths = [];

      for (let i = 0; i < maxPath; i += 1) {
        const path = [guards[i]];

        do {
          // selection of the last snode (edge snode) needs at least v2.8.0
          if (path.length === nodesNeededPerPaths) {
            const randomEdgeSnode = getRandomEdgeSnode(otherNodes);
            otherNodes = otherNodes.filter(n => {
              return n.pubkey_ed25519 !== randomEdgeSnode?.pubkey_ed25519;
            });
            path.push(randomEdgeSnode);
          } else {
            const snode = sample(otherNodes);
            if (!snode) {
              throw new Error('no more snode found for path building');
            }
            otherNodes = otherNodes.filter(n => {
              return n.pubkey_ed25519 !== snode?.pubkey_ed25519;
            });

            path.push(snode);
          }
        } while (path.length <= nodesNeededPerPaths);
        onionPaths.push(path);
      }

      window?.log?.info(`Built ${onionPaths.length} onion paths`);
    },
    {
      retries: 3, // 4 total
      factor: 1,
      minTimeout: OnionPaths.getOnionPathMinTimeout(),
      onFailedAttempt: e => {
        window?.log?.warn(
          `buildNewOnionPathsWorker attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
        );
      },
    }
  );
}

export function getRandomEdgeSnode(snodes: Array<Snode>) {
  const randomEdgeSnode = sample(snodes);
  if (!randomEdgeSnode) {
    throw new Error('did not find a single snode which can be the edge');
  }
  return randomEdgeSnode;
}
