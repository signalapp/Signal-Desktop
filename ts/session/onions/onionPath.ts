import { getGuardNodes, Snode, updateGuardNodes } from '../../../ts/data/data';
import * as SnodePool from '../snode_api/snodePool';
import _ from 'lodash';
import { default as insecureNodeFetch } from 'node-fetch';
import { UserUtils } from '../utils';
import { incrementBadSnodeCountOrDrop, snodeHttpsAgent } from '../snode_api/onions';
import { allowOnlyOneAtATime } from '../utils/Promise';
import pRetry from 'p-retry';

const desiredGuardCount = 3;
const minimumGuardCount = 2;

import { updateOnionPaths } from '../../state/ducks/onion';
import { ERROR_CODE_NO_CONNECT } from '../snode_api/SNodeAPI';
import { getStoragePubKey } from '../types/PubKey';

const ONION_REQUEST_HOPS = 3;
export let onionPaths: Array<Array<Snode>> = [];

/**
 * Used for testing only
 * @returns a copy of the onion path currently used by the app.
 *
 */
// tslint:disable-next-line: variable-name
export const TEST_getTestOnionPath = () => {
  return _.cloneDeep(onionPaths);
};

// tslint:disable-next-line: variable-name
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

// tslint:disable-next-line: variable-name
export const resetPathFailureCount = () => {
  pathFailureCount = {};
};

// The number of times a path can fail before it's replaced.
const pathFailureThreshold = 3;

// This array is meant to store nodes will full info,
// so using GuardNode would not be correct (there is
// some naming issue here it seems)
export let guardNodes: Array<Snode> = [];

export const ed25519Str = (ed25519Key: string) => `(...${ed25519Key.substr(58)})`;

let buildNewOnionPathsWorkerRetry = 0;

export async function buildNewOnionPathsOneAtATime() {
  // this function may be called concurrently make sure we only have one inflight
  return allowOnlyOneAtATime('buildNewOnionPaths', async () => {
    buildNewOnionPathsWorkerRetry = 0;
    await buildNewOnionPathsWorker();
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
    window?.log?.warn(
      `Could not drop ${ed25519Str(snodeEd25519)} from path index: ${pathWithSnodeIndex}`
    );
    throw new Error(`Could not drop snode ${ed25519Str(snodeEd25519)} from path: not in any paths`);
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

export async function getOnionPath(toExclude?: Snode): Promise<Array<Snode>> {
  let attemptNumber = 0;

  while (onionPaths.length < minimumGuardCount) {
    window?.log?.info(
      `Must have at least ${minimumGuardCount} good onion paths, actual: ${onionPaths.length}, attempt #${attemptNumber} fetching more...`
    );
    // eslint-disable-next-line no-await-in-loop
    await buildNewOnionPathsOneAtATime();
    // should we add a delay? buildNewOnionPathsOneA  tATime should act as one

    // reload goodPaths now
    attemptNumber += 1;

    if (attemptNumber >= 10) {
      window?.log?.error('Failed to get an onion path after 10 attempts');
      throw new Error(`Failed to build enough onion paths, current count: ${onionPaths.length}`);
    }
  }

  if (onionPaths.length <= 0) {
    if (!_.isEmpty(window.inboxStore?.getState().onionPaths.snodePaths)) {
      window.inboxStore?.dispatch(updateOnionPaths([]));
    }
  } else {
    if (!_.isEqual(window.inboxStore?.getState().onionPaths.snodePaths, onionPaths)) {
      window.inboxStore?.dispatch(updateOnionPaths(onionPaths));
    }
  }

  const onionPathsWithoutExcluded = toExclude
    ? onionPaths.filter(
        path => !_.some(path, node => node.pubkey_ed25519 === toExclude.pubkey_ed25519)
      )
    : onionPaths;

  if (!onionPathsWithoutExcluded) {
    window?.log?.error('LokiSnodeAPI::getOnionPath - no path in', onionPathsWithoutExcluded);
    return [];
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
    window?.log?.info('Did not find any path containing this snode');
    // this can only be bad. throw an abortError so we use another path if needed
    throw new pRetry.AbortError(
      'incrementBadPathCountOrDrop: Did not find any path containing this snode'
    );
  }

  const guardNodeEd25519 = onionPaths[pathWithSnodeIndex][0].pubkey_ed25519;

  window?.log?.info(
    `incrementBadPathCountOrDrop starting with guard ${ed25519Str(guardNodeEd25519)}`
  );

  const pathWithIssues = onionPaths[pathWithSnodeIndex];

  window?.log?.info('handling bad path for path index', pathWithSnodeIndex);
  const oldPathFailureCount = pathFailureCount[guardNodeEd25519] || 0;

  // tslint:disable: prefer-for-of

  const newPathFailureCount = oldPathFailureCount + 1;
  // skip the first one as the first one is the guard node.
  // a guard node is dropped when the path is dropped completely (in dropPathStartingWithGuardNode)
  for (let index = 1; index < pathWithIssues.length; index++) {
    const snode = pathWithIssues[index];
    await incrementBadSnodeCountOrDrop({ snodeEd25519: snode.pubkey_ed25519, guardNodeEd25519 });
  }

  if (newPathFailureCount >= pathFailureThreshold) {
    return dropPathStartingWithGuardNode(guardNodeEd25519);
  }
  // the path is not yet THAT bad. keep it for now
  pathFailureCount[guardNodeEd25519] = newPathFailureCount;
}

/**
 * This function is used to drop a path and its corresponding guard node.
 * It writes to the db the updated list of guardNodes.
 * @param ed25519Key the guard node ed25519 pubkey
 */
async function dropPathStartingWithGuardNode(guardNodeEd25519: string) {
  // we are dropping it. Reset the counter in case this same guard gets choosen later
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
  pathFailureCount[guardNodeEd25519] = 0;

  await SnodePool.dropSnodeFromSnodePool(guardNodeEd25519);

  // write the updates guard nodes to the db.
  // the next call to getOnionPath will trigger a rebuild of the path
  await internalUpdateGuardNodes(guardNodes);
}

async function internalUpdateGuardNodes(updatedGuardNodes: Array<Snode>) {
  const edKeys = updatedGuardNodes.map(n => n.pubkey_ed25519);

  await updateGuardNodes(edKeys);
}

async function testGuardNode(snode: Snode) {
  window?.log?.info(`Testing a candidate guard node ${ed25519Str(snode.pubkey_ed25519)}`);

  // Send a post request and make sure it is OK
  const endpoint = '/storage_rpc/v1';

  const url = `https://${snode.ip}:${snode.port}${endpoint}`;

  const ourPK = UserUtils.getOurPubKeyStrFromCache();
  const pubKey = getStoragePubKey(ourPK); // truncate if testnet

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
    headers: {
      'Content-Type': 'application/json',
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
      window?.log?.warn('test timeout for node,', snode);
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
 * Only exported for testing purpose. DO NOT use this directly
 */
export async function selectGuardNodes(): Promise<Array<Snode>> {
  // `getRandomSnodePool` is expected to refresh itself on low nodes
  const nodePool = await SnodePool.getRandomSnodePool();
  window.log.info('selectGuardNodes snodePool:', nodePool.length);
  if (nodePool.length < desiredGuardCount) {
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
    if (shuffled.length < desiredGuardCount) {
      window?.log?.error('Not enough nodes in the pool');
      break;
    }

    const candidateNodes = shuffled.splice(0, desiredGuardCount);

    if (attempts > 10) {
      // too many retries. something is wrong.
      window.log.info(`selectGuardNodes stopping after attempts: ${attempts}`);
      throw new Error(`selectGuardNodes stopping after attempts: ${attempts}`);
    }
    window.log.info(`selectGuardNodes attempts: ${attempts}`);

    // Test all three nodes at once, wait for all to resolve or reject
    // eslint-disable-next-line no-await-in-loop
    const idxOk = (await Promise.allSettled(candidateNodes.map(testGuardNode))).flatMap(p =>
      p.status === 'fulfilled' ? p.value : null
    );

    const goodNodes = _.zip(idxOk, candidateNodes)
      .filter(x => x[0])
      .map(x => x[1]) as Array<Snode>;

    selectedGuardNodes = _.concat(selectedGuardNodes, goodNodes);
    attempts++;
  }

  if (selectedGuardNodes.length < desiredGuardCount) {
    window?.log?.error(`Cound't get enough guard nodes, only have: ${guardNodes.length}`);
  }
  guardNodes = selectedGuardNodes;

  await internalUpdateGuardNodes(guardNodes);

  return guardNodes;
}

async function buildNewOnionPathsWorker() {
  window?.log?.info('LokiSnodeAPI::buildNewOnionPaths - building new onion paths...');

  let allNodes = await SnodePool.getRandomSnodePool();

  if (guardNodes.length === 0) {
    // Not cached, load from DB
    const nodes = await getGuardNodes();

    if (nodes.length === 0) {
      window?.log?.warn(
        'LokiSnodeAPI::buildNewOnionPaths - no guard nodes in DB. Will be selecting new guards nodes...'
      );
    } else {
      // We only store the nodes' keys, need to find full entries:
      const edKeys = nodes.map(x => x.ed25519PubKey);
      guardNodes = allNodes.filter(x => edKeys.indexOf(x.pubkey_ed25519) !== -1);

      if (guardNodes.length < edKeys.length) {
        window?.log?.warn(
          `LokiSnodeAPI::buildNewOnionPaths - could not find some guard nodes: ${guardNodes.length}/${edKeys.length} left`
        );
      }
    }
  }
  // If guard nodes is still empty (the old nodes are now invalid), select new ones:
  if (guardNodes.length < desiredGuardCount) {
    try {
      guardNodes = await exports.selectGuardNodes();
    } catch (e) {
      window.log.warn('selectGuardNodes throw error. Not retrying.', e);
      return;
    }
  }
  // be sure to fetch again as that list might have been refreshed by selectGuardNodes
  allNodes = await SnodePool.getRandomSnodePool();
  window?.log?.info(
    'LokiSnodeAPI::buildNewOnionPaths - after refetch, snodePool length:',
    allNodes.length
  );
  // TODO: select one guard node and 2 other nodes randomly
  let otherNodes = _.differenceBy(allNodes, guardNodes, 'pubkey_ed25519');
  if (otherNodes.length < SnodePool.minSnodePoolCount) {
    window?.log?.warn(
      'LokiSnodeAPI::buildNewOnionPaths - Too few nodes to build an onion path! Refreshing pool and retrying'
    );
    await SnodePool.refreshRandomPool();
    // this is a recursive call limited to only one call at a time. we use the timeout
    // here to make sure we retry this call if we cannot get enough otherNodes

    // how to handle failing to rety
    buildNewOnionPathsWorkerRetry = buildNewOnionPathsWorkerRetry + 1;
    window?.log?.warn(
      'buildNewOnionPathsWorker failed to get otherNodes. Current retry:',
      buildNewOnionPathsWorkerRetry
    );
    if (buildNewOnionPathsWorkerRetry >= 3) {
      // we failed enough. Something is wrong. Lets get out of that function and get a new fresh call.
      window?.log?.warn(
        `buildNewOnionPathsWorker failed to get otherNodes even after retries... Exiting after ${buildNewOnionPathsWorkerRetry} retries`
      );

      return;
    } else {
      window?.log?.info(
        `buildNewOnionPathsWorker failed to get otherNodes. Next attempt: ${buildNewOnionPathsWorkerRetry}`
      );
    }
    await buildNewOnionPathsWorker();
    return;
  }

  otherNodes = _.shuffle(otherNodes);
  const guards = _.shuffle(guardNodes);

  // Create path for every guard node:
  const nodesNeededPerPaths = ONION_REQUEST_HOPS - 1;

  // Each path needs nodesNeededPerPaths nodes in addition to the guard node:
  const maxPath = Math.floor(Math.min(guards.length, otherNodes.length / nodesNeededPerPaths));
  window?.log?.info(
    `Building ${maxPath} onion paths based on guard nodes length: ${guards.length}, other nodes length ${otherNodes.length} `
  );

  // TODO: might want to keep some of the existing paths
  onionPaths = [];

  for (let i = 0; i < maxPath; i += 1) {
    const path = [guards[i]];
    for (let j = 0; j < nodesNeededPerPaths; j += 1) {
      path.push(otherNodes[i * nodesNeededPerPaths + j]);
    }
    onionPaths.push(path);
  }

  window?.log?.info(`Built ${onionPaths.length} onion paths`);
}
