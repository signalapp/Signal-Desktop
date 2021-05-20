import { getGuardNodes, updateGuardNodes } from '../../../ts/data/data';
import * as SnodePool from '../snode_api/snodePool';
import _ from 'lodash';
import { default as insecureNodeFetch } from 'node-fetch';
import { UserUtils } from '../utils';
import { snodeHttpsAgent } from '../snode_api/onions';
import { allowOnlyOneAtATime } from '../utils/Promise';

export type Snode = SnodePool.Snode;

const desiredGuardCount = 3;
const minimumGuardCount = 2;
interface SnodePath {
  path: Array<Snode>;
  bad: boolean;
}

export class OnionPaths {
  private static instance: OnionPaths | null;
  private static readonly onionRequestHops = 3;
  private onionPaths: Array<SnodePath> = [];

  // This array is meant to store nodes will full info,
  // so using GuardNode would not be correct (there is
  // some naming issue here it seems)
  private guardNodes: Array<Snode> = [];
  private onionRequestCounter = 0; // Request index for debugging
  private constructor() {}

  public static getInstance() {
    if (OnionPaths.instance) {
      return OnionPaths.instance;
    }
    OnionPaths.instance = new OnionPaths();
    return OnionPaths.instance;
  }

  public async buildNewOnionPaths() {
    // this function may be called concurrently make sure we only have one inflight
    return allowOnlyOneAtATime('buildNewOnionPaths', async () => {
      await this.buildNewOnionPathsWorker();
    });
  }

  public async getOnionPath(toExclude?: { pubkey_ed25519: string }): Promise<Array<Snode>> {
    const { log, CONSTANTS } = window;

    let goodPaths = this.onionPaths.filter(x => !x.bad);

    let attemptNumber = 0;
    while (goodPaths.length < minimumGuardCount) {
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
      path => !_.some(path.path, node => node.pubkey_ed25519 === toExclude.pubkey_ed25519)
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
        goodPaths.length,
        'paths',
        paths
      );
      throw new Error('No onion paths available after filtering');
    }

    if (!otherPaths[0].path) {
      log.error('LokiSnodeAPI::getOnionPath - otherPaths no path in', otherPaths[0]);
    }

    return otherPaths[0].path;
  }

  public hasOnionPath(): boolean {
    // returns true if there exists a valid onion path
    return this.onionPaths.length !== 0 && this.onionPaths[0].path.length !== 0;
  }

  public getOnionPathNoRebuild() {
    return this.onionPaths ? this.onionPaths[0].path : [];
  }

  public markPathAsBad(path: Array<Snode>) {
    // TODO: we might want to remove the nodes from the
    // node pool (but we don't know which node on the path
    // is causing issues)

    this.onionPaths.forEach(p => {
      if (_.isEqual(p.path, path)) {
        // eslint-disable-next-line no-param-reassign
        p.bad = true;
      }
    });
  }

  public assignOnionRequestNumber() {
    this.onionRequestCounter += 1;
    return this.onionRequestCounter;
  }

  private async testGuardNode(snode: Snode) {
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

  private async selectGuardNodes(): Promise<Array<Snode>> {
    const { log } = window;

    // `getRandomSnodePool` is expected to refresh itself on low nodes
    const nodePool = await SnodePool.getRandomSnodePool();
    if (nodePool.length < desiredGuardCount) {
      log.error('Could not select guard nodes. Not enough nodes in the pool: ', nodePool.length);
      return [];
    }

    const shuffled = _.shuffle(nodePool);

    let guardNodes: Array<Snode> = [];

    console.log('@@@@ guardNodes: ', guardNodes);

    // The use of await inside while is intentional:
    // we only want to repeat if the await fails
    // eslint-disable-next-line-no-await-in-loop
    while (guardNodes.length < 3) {
      if (shuffled.length < desiredGuardCount) {
        log.error('Not enought nodes in the pool');
        break;
      }

      const candidateNodes = shuffled.splice(0, desiredGuardCount);

      // Test all three nodes at once
      // eslint-disable-next-line no-await-in-loop
      const idxOk = await Promise.all(candidateNodes.map(n => this.testGuardNode(n)));

      const goodNodes = _.zip(idxOk, candidateNodes)
        .filter(x => x[0])
        .map(x => x[1]) as Array<Snode>;

      guardNodes = _.concat(guardNodes, goodNodes);
    }

    if (guardNodes.length < desiredGuardCount) {
      log.error(`COULD NOT get enough guard nodes, only have: ${guardNodes.length}`);
    }

    log.info('new guard nodes: ', guardNodes);

    const edKeys = guardNodes.map(n => n.pubkey_ed25519);

    await updateGuardNodes(edKeys);

    return guardNodes;
  }

  private async buildNewOnionPathsWorker() {
    const { log } = window;

    log.info('LokiSnodeAPI::buildNewOnionPaths - building new onion paths');

    const allNodes = await SnodePool.getRandomSnodePool();

    if (this.guardNodes.length === 0) {
      // Not cached, load from DB
      const nodes = await getGuardNodes();

      if (nodes.length === 0) {
        log.warn(
          'LokiSnodeAPI::buildNewOnionPaths - no guard nodes in DB. Will be selecting new guards nodes...'
        );
      } else {
        // We only store the nodes' keys, need to find full entries:
        const edKeys = nodes.map(x => x.ed25519PubKey);
        this.guardNodes = allNodes.filter(x => edKeys.indexOf(x.pubkey_ed25519) !== -1);

        if (this.guardNodes.length < edKeys.length) {
          log.warn(
            `LokiSnodeAPI::buildNewOnionPaths - could not find some guard nodes: ${this.guardNodes.length}/${edKeys.length} left`
          );
        }
      }

      // If guard nodes is still empty (the old nodes are now invalid), select new ones:
      if (this.guardNodes.length < minimumGuardCount) {
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
      await SnodePool.refreshRandomPool();
      await this.buildNewOnionPaths();
      return;
    }

    otherNodes = _.shuffle(otherNodes);
    const guards = _.shuffle(this.guardNodes);

    // Create path for every guard node:
    const nodesNeededPerPaths = OnionPaths.onionRequestHops - 1;

    // Each path needs X (nodesNeededPerPaths) nodes in addition to the guard node:
    const maxPath = Math.floor(
      Math.min(
        guards.length,
        nodesNeededPerPaths ? otherNodes.length / nodesNeededPerPaths : otherNodes.length
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

    log.info(`Built ${this.onionPaths.length} onion paths`);
  }
}
