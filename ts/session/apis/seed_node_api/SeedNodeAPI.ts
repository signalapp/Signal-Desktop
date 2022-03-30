import { Constants } from '../..';
import { default as insecureNodeFetch } from 'node-fetch';
import https from 'https';
import _ from 'lodash';

import fs from 'fs';
import path from 'path';
import tls from 'tls';
import { sha256 } from '../../crypto';
import * as Data from '../../../data/data';
import pRetry from 'p-retry';
import { SeedNodeAPI } from '.';
import { ipcRenderer } from 'electron';

// tslint:disable: function-name

export type SeedNode = {
  url: string;
};

/**
 * Fetch all snodes from seed nodes.
 * Exported only for tests. This is not to be used by the app directly
 * @param seedNodes the seednodes to use to fetch snodes details
 */
export async function fetchSnodePoolFromSeedNodeWithRetries(
  seedNodes: Array<SeedNode>
): Promise<Array<Data.Snode>> {
  try {
    window?.log?.info(`fetchSnodePoolFromSeedNode with seedNodes.length ${seedNodes.length}`);

    let snodes = await getSnodeListFromSeednode(seedNodes);
    // make sure order of the list is random, so we get version in a non-deterministic way
    snodes = _.shuffle(snodes);
    // commit changes to be live
    // we'll update the version (in case they upgrade) every cycle
    const fetchSnodePool = snodes.map(snode => ({
      ip: snode.public_ip,
      port: snode.storage_port,
      pubkey_x25519: snode.pubkey_x25519,
      pubkey_ed25519: snode.pubkey_ed25519,
    }));
    window?.log?.info(
      'SeedNodeAPI::fetchSnodePoolFromSeedNodeWithRetries - Refreshed random snode pool with',
      snodes.length,
      'snodes'
    );
    return fetchSnodePool;
  } catch (e) {
    window?.log?.warn(
      'SessionSnodeAPI::fetchSnodePoolFromSeedNodeWithRetries - error',
      e.code,
      e.message
    );

    throw new Error('Failed to contact seed node');
  }
}

let cachedAppPath: string | undefined;

const getSslAgentForSeedNode = async (seedNodeHost: string, isSsl = false) => {
  let filePrefix = '';
  let pubkey256 = '';
  let cert256 = '';
  if (!isSsl) {
    return undefined;
  }

  switch (seedNodeHost) {
    case 'storage.seed1.loki.network':
      filePrefix = 'storage-seed-1';
      pubkey256 = 'JOsnIcAanVbgECNA8lHtC8f/cqN9m8EP7jKT6XCjeL8=';
      cert256 =
        '6E:2B:AC:F3:6E:C1:FF:FF:24:F3:CA:92:C6:94:81:B4:82:43:DF:C7:C6:03:98:B8:F5:6B:7D:30:7B:16:C1:CB';
      break;
    case 'storage.seed3.loki.network':
      filePrefix = 'storage-seed-3';
      pubkey256 = 'mMmZD3lG4Fi7nTC/EWzRVaU3bbCLsH6Ds2FHSTpo0Rk=';
      cert256 =
        '24:13:4C:0A:03:D8:42:A6:09:DE:35:76:F4:BD:FB:11:60:DB:F9:88:9F:98:46:B7:60:A6:60:0C:4C:CF:60:72';

      break;
    case 'public.loki.foundation':
      filePrefix = 'public-loki-foundation';
      pubkey256 = 'W+Zv52qlcm1BbdpJzFwxZrE7kfmEboq7h3Dp/+Q3RPg=';
      cert256 =
        '40:E4:67:7D:18:6B:4D:08:8D:E9:D5:47:52:25:B8:28:E0:D3:63:99:9B:38:46:7D:92:19:5B:61:B9:AE:0E:EA';

      break;

    default:
      throw new Error(`Unknown seed node: ${seedNodeHost}`);
  }
  // tslint:disable: non-literal-fs-path
  // read the cert each time. We only run this request once for each seed node nevertheless.
  const appPath = cachedAppPath || (await ipcRenderer.invoke('get-data-path'));
  cachedAppPath = appPath;
  const crt = fs.readFileSync(path.join(appPath, `/certificates/${filePrefix}.crt`), 'utf-8');
  const sslOptions = {
    // as the seed nodes are using a self signed certificate, we have to provide it here.
    ca: crt,
    // we have to reject them, otherwise our errors returned in the checkServerIdentity are simply not making the call fail.
    // so in production, rejectUnauthorized must be true.
    rejectUnauthorized: true,
    keepAlive: false,
    checkServerIdentity: (host: string, cert: any) => {
      // Make sure the certificate is issued to the host we are connected to
      const err = tls.checkServerIdentity(host, cert);
      if (err) {
        return err;
      }

      // Pin the public key, similar to HPKP pin-sha25 pinning
      if (sha256(cert.pubkey) !== pubkey256) {
        const msg =
          'Certificate verification error: ' +
          `The public key of '${cert.subject.CN}' ` +
          'does not match our pinned fingerprint';
        return new Error(msg);
      }

      // Pin the exact certificate, rather than the pub key
      if (cert.fingerprint256 !== cert256) {
        const msg =
          'Certificate verification error: ' +
          `The certificate of '${cert.subject.CN}' ` +
          'does not match our pinned fingerprint';
        return new Error(msg);
      }
      return undefined;
    },
  };

  // we're creating a new Agent that will now use the certs we have configured
  return new https.Agent(sslOptions);
};

export interface SnodeFromSeed {
  public_ip: string;
  storage_port: number;
  pubkey_x25519: string;
  pubkey_ed25519: string;
}

/**
 * This call will try 4 times to contact a seed nodes (random) and get the snode list from it.
 * If all attempts fails, this function will throw the last error.
 * The returned list is not shuffled when returned.
 */
async function getSnodeListFromSeednode(seedNodes: Array<SeedNode>): Promise<Array<SnodeFromSeed>> {
  const SEED_NODE_RETRIES = 4;

  return pRetry(
    async () => {
      window?.log?.info('getSnodeListFromSeednode starting...');
      if (!seedNodes.length) {
        window?.log?.info('loki_snode_api::getSnodeListFromSeednode - seedNodes are empty');
        throw new Error('getSnodeListFromSeednode - seedNodes are empty');
      }
      // do not try/catch, we do want exception to bubble up so pRetry, well, retries
      const snodes = await SeedNodeAPI.TEST_fetchSnodePoolFromSeedNodeRetryable(seedNodes);

      return snodes;
    },
    {
      retries: SEED_NODE_RETRIES - 1,
      factor: 2,
      minTimeout: SeedNodeAPI.getMinTimeout(),
      onFailedAttempt: e => {
        window?.log?.warn(
          `fetchSnodePoolFromSeedNodeRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
        );
      },
    }
  );
}

export function getMinTimeout() {
  return 1000;
}

/**
 * This functions choose randonly a seed node from seedNodes and try to get the snodes from it, or throws.
 * This function is to be used with a pRetry caller
 */
export async function TEST_fetchSnodePoolFromSeedNodeRetryable(
  seedNodes: Array<SeedNode>
): Promise<Array<SnodeFromSeed>> {
  window?.log?.info('fetchSnodePoolFromSeedNodeRetryable starting...');

  if (!seedNodes.length) {
    window?.log?.info('loki_snode_api::fetchSnodePoolFromSeedNodeRetryable - seedNodes are empty');
    throw new Error('fetchSnodePoolFromSeedNodeRetryable: Seed nodes are empty');
  }

  const seedNode = _.sample(seedNodes);
  if (!seedNode) {
    window?.log?.warn(
      'loki_snode_api::fetchSnodePoolFromSeedNodeRetryable - Could not select random snodes from',
      seedNodes
    );
    throw new Error('fetchSnodePoolFromSeedNodeRetryable: Seed nodes are empty #2');
  }

  const tryUrl = new URL(seedNode.url);

  const snodes = await getSnodesFromSeedUrl(tryUrl);
  if (snodes.length === 0) {
    window?.log?.warn(
      `loki_snode_api::fetchSnodePoolFromSeedNodeRetryable - ${seedNode.url} did not return any snodes`
    );
    throw new Error(`Failed to contact seed node: ${seedNode.url}`);
  }

  return snodes;
}

/**
 * Try to get the snode list from the given seed node URL, or throws.
 * This function throws for whatever reason might happen (timeout, invalid response, 0 valid snodes returned, ...)
 * This function is to be used inside a pRetry function
 */
async function getSnodesFromSeedUrl(urlObj: URL): Promise<Array<any>> {
  // Removed limit until there is a way to get snode info
  // for individual nodes (needed for guard nodes);  this way
  // we get all active nodes
  window?.log?.info(`getSnodesFromSeedUrl starting with ${urlObj.href}`);

  const params = {
    active_only: true,
    fields: {
      public_ip: true,
      storage_port: true,
      pubkey_x25519: true,
      pubkey_ed25519: true,
    },
  };

  const endpoint = 'json_rpc';
  const url = `${urlObj.href}${endpoint}`;

  const body = {
    jsonrpc: '2.0',
    id: '0',
    method: 'get_n_service_nodes',
    params,
  };

  const sslAgent = await getSslAgentForSeedNode(
    urlObj.hostname,
    urlObj.protocol !== Constants.PROTOCOLS.HTTP
  );

  const fetchOptions = {
    method: 'POST',
    timeout: 5000,
    body: JSON.stringify(body),
    headers: {
      'User-Agent': 'WhatsApp',
      'Accept-Language': 'en-us',
    },
    agent: sslAgent,
  };
  window?.log?.info('insecureNodeFetch => plaintext for getSnodesFromSeedUrl');

  const response = await insecureNodeFetch(url, fetchOptions);

  if (response.status !== 200) {
    window?.log?.error(
      `loki_snode_api:::getSnodesFromSeedUrl - invalid response from seed ${urlObj.toString()}:`,
      response
    );
    throw new Error(
      `getSnodesFromSeedUrl: status is not 200 ${response.status} from ${urlObj.href}`
    );
  }

  if (response.headers.get('Content-Type') !== 'application/json') {
    window?.log?.error('Response is not json');
    throw new Error(`getSnodesFromSeedUrl: response is not json Content-Type from ${urlObj.href}`);
  }

  try {
    const json = await response.json();
    const result = json.result;

    if (!result) {
      window?.log?.error(
        `loki_snode_api:::getSnodesFromSeedUrl - invalid result from seed ${urlObj.toString()}:`,
        response
      );
      throw new Error(`getSnodesFromSeedUrl: json.result is empty from ${urlObj.href}`);
    }
    // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
    const validNodes = result.service_node_states.filter(
      (snode: any) => snode.public_ip !== '0.0.0.0'
    );

    if (validNodes.length === 0) {
      throw new Error(`Did not get a single valid snode from ${urlObj.href}`);
    }
    return validNodes;
  } catch (e) {
    window?.log?.error('Invalid json response');
    throw new Error(`getSnodesFromSeedUrl: cannot parse content as JSON from ${urlObj.href}`);
  }
}
