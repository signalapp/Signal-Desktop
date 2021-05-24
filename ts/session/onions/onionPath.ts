import { getGuardNodes, updateGuardNodes } from '../../../ts/data/data';
import * as SnodePool from '../snode_api/snodePool';
import _ from 'lodash';
import { default as insecureNodeFetch } from 'node-fetch';
import { UserUtils } from '../utils';
import { incrementBadSnodeCountOrDrop, snodeHttpsAgent } from '../snode_api/onions';
import { allowOnlyOneAtATime } from '../utils/Promise';

const desiredGuardCount = 3;
const minimumGuardCount = 2;

type SnodePath = Array<SnodePool.Snode>;

const onionRequestHops = 3;
let onionPaths: Array<SnodePath> = [];

/**
 * Used for testing only
 * @returns a copy of the onion path currently used by the app.
 *
 */
export const getTestOnionPath = () => {
  return _.cloneDeep(onionPaths);
};

/**
 * Used for testing only. Clears the saved onion paths
 *
 */
export const clearTestOnionPath = () => {
  onionPaths = [];
};

//
/**
 * hold the failure count of the path starting with the snode ed25519 pubkey.
 * exported just for tests. do not interact with this directly
 */
export const pathFailureCount: Record<string, number> = {};

// The number of times a path can fail before it's replaced.
const pathFailureThreshold = 3;

// This array is meant to store nodes will full info,
// so using GuardNode would not be correct (there is
// some naming issue here it seems)
let guardNodes: Array<SnodePool.Snode> = [];

export const ed25519Str = (ed25519Key: string) => `(...${ed25519Key.substr(58)})`;

export async function buildNewOnionPathsOneAtATime() {
  // this function may be called concurrently make sure we only have one inflight
  return allowOnlyOneAtATime('buildNewOnionPaths', async () => {
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

export async function getOnionPath(toExclude?: SnodePool.Snode): Promise<Array<SnodePool.Snode>> {
  let attemptNumber = 0;
  while (onionPaths.length < minimumGuardCount) {
    window?.log?.error(
      `Must have at least ${minimumGuardCount} good onion paths, actual: ${onionPaths.length}, attempt #${attemptNumber} fetching more...`
    );
    // eslint-disable-next-line no-await-in-loop
    await buildNewOnionPathsOneAtATime();
    // should we add a delay? buildNewOnionPathsOneAtATime should act as one

    // reload goodPaths now
    attemptNumber += 1;
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
export async function incrementBadPathCountOrDrop(guardNodeEd25519: string) {
  const pathIndex = onionPaths.findIndex(p => p[0].pubkey_ed25519 === guardNodeEd25519);
  window?.log?.info(
    `\t\tincrementBadPathCountOrDrop starting with guard ${ed25519Str(guardNodeEd25519)}`
  );

  if (pathIndex === -1) {
    window?.log?.info('Did not find path with this guard node');
    return;
  }

  const pathWithIssues = onionPaths[pathIndex];

  window?.log?.info('handling bad path for path index', pathIndex);
  const oldPathFailureCount = pathFailureCount[guardNodeEd25519] || 0;

  // tslint:disable: prefer-for-of

  const newPathFailureCount = oldPathFailureCount + 1;
  // skip the first one as the first one is the guard node.
  // a guard node is dropped when the path is dropped completely (in dropPathStartingWithGuardNode)
  for (let index = 1; index < pathWithIssues.length; index++) {
    const snode = pathWithIssues[index];
    await incrementBadSnodeCountOrDrop({ snodeEd25519: snode.pubkey_ed25519 });
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
    return;
  }
  window?.log?.info(
    `Dropping path starting with guard node ${ed25519Str(
      guardNodeEd25519
    )}; index:${failingPathIndex}`
  );
  onionPaths = onionPaths.filter(p => p[0].pubkey_ed25519 !== guardNodeEd25519);

  const edKeys = guardNodes
    .filter(g => g.pubkey_ed25519 !== guardNodeEd25519)
    .map(n => n.pubkey_ed25519);

  guardNodes = guardNodes.filter(g => g.pubkey_ed25519 !== guardNodeEd25519);
  pathFailureCount[guardNodeEd25519] = 0;

  // write the updates guard nodes to the db.
  // the next call to getOnionPath will trigger a rebuild of the path
  await updateGuardNodes(edKeys);
}

async function testGuardNode(snode: SnodePool.Snode) {
  window?.log?.info(`Testing a candidate guard node ${ed25519Str(snode.pubkey_ed25519)}`);

  // Send a post request and make sure it is OK
  const endpoint = '/storage_rpc/v1';

  const url = `https://${snode.ip}:${snode.port}${endpoint}`;

  const ourPK = UserUtils.getOurPubKeyStrFromCache();
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
    return false;
  }

  if (!response.ok) {
    const tg = await response.text();
    window?.log?.info('Node failed the guard test:', snode);
  }

  return response.ok;
}

/**
 * Only exported for testing purpose. DO NOT use this directly
 */
export async function selectGuardNodes(): Promise<Array<SnodePool.Snode>> {
  // `getRandomSnodePool` is expected to refresh itself on low nodes
  const nodePool = await SnodePool.getRandomSnodePool();
  if (nodePool.length < desiredGuardCount) {
    window?.log?.error(
      'Could not select guard nodes. Not enough nodes in the pool: ',
      nodePool.length
    );
    return [];
  }

  const shuffled = _.shuffle(nodePool);

  let selectedGuardNodes: Array<SnodePool.Snode> = [];

  // The use of await inside while is intentional:
  // we only want to repeat if the await fails
  // eslint-disable-next-line-no-await-in-loop
  while (selectedGuardNodes.length < desiredGuardCount) {
    if (shuffled.length < desiredGuardCount) {
      window?.log?.error('Not enought nodes in the pool');
      break;
    }

    const candidateNodes = shuffled.splice(0, desiredGuardCount);

    // Test all three nodes at once
    // eslint-disable-next-line no-await-in-loop
    const idxOk = await Promise.all(candidateNodes.map(testGuardNode));

    const goodNodes = _.zip(idxOk, candidateNodes)
      .filter(x => x[0])
      .map(x => x[1]) as Array<SnodePool.Snode>;

    selectedGuardNodes = _.concat(selectedGuardNodes, goodNodes);
  }

  if (selectedGuardNodes.length < desiredGuardCount) {
    window?.log?.error(`Cound't get enough guard nodes, only have: ${guardNodes.length}`);
  }
  guardNodes = selectedGuardNodes;

  const edKeys = guardNodes.map(n => n.pubkey_ed25519);

  await updateGuardNodes(edKeys);

  return guardNodes;
}

async function buildNewOnionPathsWorker() {
  window?.log?.info('LokiSnodeAPI::buildNewOnionPaths - building new onion paths...');

  const allNodes = await SnodePool.getRandomSnodePool();

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
  if (guardNodes.length < minimumGuardCount) {
    // TODO: don't throw away potentially good guard nodes
    guardNodes = await exports.selectGuardNodes();
  }

  // TODO: select one guard node and 2 other nodes randomly
  let otherNodes = _.differenceBy(allNodes, guardNodes, 'pubkey_ed25519');
  if (otherNodes.length < 2) {
    window?.log?.warn(
      'LokiSnodeAPI::buildNewOnionPaths - Too few nodes to build an onion path! Refreshing pool and retrying'
    );
    await SnodePool.refreshRandomPool();
    // FIXME this is a recursive call limited to only one call at a time. This cannot work
    await buildNewOnionPathsOneAtATime();
    return;
  }

  otherNodes = _.shuffle(otherNodes);
  const guards = _.shuffle(guardNodes);

  // Create path for every guard node:
  const nodesNeededPerPaths = onionRequestHops - 1;

  // Each path needs X (nodesNeededPerPaths) nodes in addition to the guard node:
  const maxPath = Math.floor(
    Math.min(
      guards.length,
      nodesNeededPerPaths ? otherNodes.length / nodesNeededPerPaths : otherNodes.length
    )
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
