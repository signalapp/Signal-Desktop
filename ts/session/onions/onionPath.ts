import { getGuardNodes, updateGuardNodes } from '../../../ts/data/data';
import * as SnodePool from '../snode_api/snodePool';
import _ from 'lodash';
import { default as insecureNodeFetch } from 'node-fetch';
import { UserUtils } from '../utils';
import { getPathString, incrementBadSnodeCountOrDrop, snodeHttpsAgent } from '../snode_api/onions';
import { allowOnlyOneAtATime } from '../utils/Promise';

const desiredGuardCount = 3;
const minimumGuardCount = 2;

type SnodePath = Array<SnodePool.Snode>;

const onionRequestHops = 3;
let onionPaths: Array<SnodePath> = [];

// hold the failure count of the path starting with the snode ed25519 pubkey
const pathFailureCount: Record<string, number> = {};

// The number of times a path can fail before it's replaced.
const pathFailureThreshold = 3;

// This array is meant to store nodes will full info,
// so using GuardNode would not be correct (there is
// some naming issue here it seems)
let guardNodes: Array<SnodePool.Snode> = [];
let onionRequestCounter = 0; // Request index for debugging

export async function buildNewOnionPaths() {
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
    return;
  }

  // make a copy now so we don't alter the real one while doing stuff here
  const oldPaths = _.cloneDeep(onionPaths);

  let pathtoPatchUp = oldPaths[pathWithSnodeIndex];
  // remove the snode causing issue from this path
  const nodeToRemoveIndex = pathtoPatchUp.findIndex(snode => snode.pubkey_ed25519 === snodeEd25519);

  // this should not happen, but well...
  if (nodeToRemoveIndex === -1) {
    return;
  }
  console.warn('removing ', snodeEd25519, ' from path ', getPathString(pathtoPatchUp));

  pathtoPatchUp = pathtoPatchUp.filter(snode => snode.pubkey_ed25519 !== snodeEd25519);
  console.warn('removed:', getPathString(pathtoPatchUp));

  const pubKeyToExclude = _.flatten(oldPaths.map(p => p.map(m => m.pubkey_ed25519)));
  // this call throws if it cannot return a valid snode.
  const snodeToAppendToPath = await SnodePool.getRandomSnode(pubKeyToExclude);
  // Don't test the new snode as this would reveal the user's IP
  pathtoPatchUp.push(snodeToAppendToPath);
  console.warn('Updated path:', getPathString(pathtoPatchUp));
  onionPaths[pathWithSnodeIndex] = pathtoPatchUp;
}

export async function getOnionPath(toExclude?: SnodePool.Snode): Promise<Array<SnodePool.Snode>> {
  const { log } = window;

  let attemptNumber = 0;
  while (onionPaths.length < minimumGuardCount) {
    log.error(
      `Must have at least 2 good onion paths, actual: ${onionPaths.length}, attempt #${attemptNumber} fetching more...`
    );
    // eslint-disable-next-line no-await-in-loop
    await buildNewOnionPaths();
    // should we add a delay? buildNewOnionPaths should act as one

    // reload goodPaths now
    attemptNumber += 1;
  }

  const paths = _.shuffle(onionPaths);

  if (!toExclude) {
    if (!paths[0]) {
      log.error('LokiSnodeAPI::getOnionPath - no path in', paths);
      return [];
    }
    if (!paths[0]) {
      log.error('LokiSnodeAPI::getOnionPath - no path in', paths[0]);
    }

    return paths[0];
  }

  // Select a path that doesn't contain `toExclude`
  const otherPaths = paths.filter(
    path => !_.some(path, node => node.pubkey_ed25519 === toExclude.pubkey_ed25519)
  );

  if (otherPaths.length === 0) {
    // This should never happen!
    // well it did happen, should we
    // await this.buildNewOnionPaths();
    // and restart call?
    log.error(
      'LokiSnodeAPI::getOnionPath - no paths without',
      toExclude.pubkey_ed25519,
      'path count',
      paths.length,
      'goodPath count',
      onionPaths.length,
      'paths',
      paths
    );
    throw new Error('No onion paths available after filtering');
  }

  if (!otherPaths[0]) {
    log.error('LokiSnodeAPI::getOnionPath - otherPaths no path in', otherPaths[0]);
  }

  return otherPaths[0];
}

/**
 * If we don't know which nodes is causing trouble, increment the issue with this full path.
 */
export async function incrementBadPathCountOrDrop(guardNodeEd25519: string) {
  const pathIndex = onionPaths.findIndex(p => p[0].pubkey_ed25519 === guardNodeEd25519);

  if (pathIndex === -1) {
    window.log.info('Did not find path with this guard node');
    return;
  }

  const pathFailing = onionPaths[pathIndex];

  console.warn('handling bad path for path index', pathIndex);
  const oldPathFailureCount = pathFailureCount[guardNodeEd25519] || 0;
  const newPathFailureCount = oldPathFailureCount + 1;
  if (newPathFailureCount >= pathFailureThreshold) {
    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < pathFailing.length; index++) {
      const snode = pathFailing[index];
      await incrementBadSnodeCountOrDrop(snode.pubkey_ed25519);
    }

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
async function dropPathStartingWithGuardNode(ed25519Key: string) {
  // we are dropping it. Reset the counter in case this same guard gets used later
  pathFailureCount[ed25519Key] = 0;
  const failingPathIndex = onionPaths.findIndex(p => p[0].pubkey_ed25519 === ed25519Key);
  if (failingPathIndex === -1) {
    console.warn('No such path starts with this guard node ');
    return;
  }
  onionPaths = onionPaths.filter(p => p[0].pubkey_ed25519 !== ed25519Key);

  const edKeys = guardNodes.filter(g => g.pubkey_ed25519 !== ed25519Key).map(n => n.pubkey_ed25519);

  await updateGuardNodes(edKeys);
}

export function assignOnionRequestNumber() {
  onionRequestCounter += 1;
  return onionRequestCounter;
}

async function testGuardNode(snode: SnodePool.Snode) {
  const { log } = window;

  log.info('Testing a candidate guard node ', snode);

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
    window.log.info('insecureNodeFetch => plaintext for testGuardNode');

    response = await insecureNodeFetch(url, fetchOptions);
  } catch (e) {
    if (e.type === 'request-timeout') {
      log.warn('test timeout for node,', snode);
    }
    return false;
  }

  if (!response.ok) {
    const tg = await response.text();
    log.info('Node failed the guard test:', snode);
  }

  return response.ok;
}

async function selectGuardNodes(): Promise<Array<SnodePool.Snode>> {
  const { log } = window;

  // `getRandomSnodePool` is expected to refresh itself on low nodes
  const nodePool = await SnodePool.getRandomSnodePool();
  if (nodePool.length < desiredGuardCount) {
    log.error('Could not select guard nodes. Not enough nodes in the pool: ', nodePool.length);
    return [];
  }

  const shuffled = _.shuffle(nodePool);

  let selectedGuardNodes: Array<SnodePool.Snode> = [];

  // The use of await inside while is intentional:
  // we only want to repeat if the await fails
  // eslint-disable-next-line-no-await-in-loop
  while (selectedGuardNodes.length < 3) {
    if (shuffled.length < desiredGuardCount) {
      log.error('Not enought nodes in the pool');
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

  if (guardNodes.length < desiredGuardCount) {
    log.error(`COULD NOT get enough guard nodes, only have: ${guardNodes.length}`);
  }

  log.info('new guard nodes: ', guardNodes);

  const edKeys = guardNodes.map(n => n.pubkey_ed25519);

  await updateGuardNodes(edKeys);

  return guardNodes;
}

async function buildNewOnionPathsWorker() {
  const { log } = window;

  log.info('LokiSnodeAPI::buildNewOnionPaths - building new onion paths');

  const allNodes = await SnodePool.getRandomSnodePool();

  if (guardNodes.length === 0) {
    // Not cached, load from DB
    const nodes = await getGuardNodes();

    if (nodes.length === 0) {
      log.warn(
        'LokiSnodeAPI::buildNewOnionPaths - no guard nodes in DB. Will be selecting new guards nodes...'
      );
    } else {
      // We only store the nodes' keys, need to find full entries:
      const edKeys = nodes.map(x => x.ed25519PubKey);
      guardNodes = allNodes.filter(x => edKeys.indexOf(x.pubkey_ed25519) !== -1);

      if (guardNodes.length < edKeys.length) {
        log.warn(
          `LokiSnodeAPI::buildNewOnionPaths - could not find some guard nodes: ${guardNodes.length}/${edKeys.length} left`
        );
      }
    }

    // If guard nodes is still empty (the old nodes are now invalid), select new ones:
    if (guardNodes.length < minimumGuardCount) {
      // TODO: don't throw away potentially good guard nodes
      guardNodes = await selectGuardNodes();
    }
  }

  // TODO: select one guard node and 2 other nodes randomly
  let otherNodes = _.differenceBy(allNodes, guardNodes, 'pubkey_ed25519');

  if (otherNodes.length < 2) {
    log.warn(
      'LokiSnodeAPI::buildNewOnionPaths - Too few nodes to build an onion path! Refreshing pool and retrying'
    );
    await SnodePool.refreshRandomPool();
    await buildNewOnionPaths();
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

  log.info(`Built ${onionPaths.length} onion paths`);
}
