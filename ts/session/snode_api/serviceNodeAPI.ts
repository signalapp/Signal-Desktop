// we don't throw or catch here
import { default as insecureNodeFetch } from 'node-fetch';
import https from 'https';
import crypto from 'crypto';

import fs from 'fs';
import path from 'path';
import tls from 'tls';
import Electron from 'electron';

const { remote } = Electron;

import { snodeRpc } from './lokiRpc';
import { sendOnionRequestLsrpcDest, snodeHttpsAgent, SnodeResponse } from './onions';

export { sendOnionRequestLsrpcDest };

import {
  getRandomSnodeAddress,
  getRandomSnodePool,
  getSwarm,
  markNodeUnreachable,
  requiredSnodesForAgreement,
  Snode,
  updateSnodesFor,
} from './snodePool';
import { Constants } from '..';
import { sleepFor } from '../utils/Promise';
import { sha256 } from '../crypto';
import pRetry from 'p-retry';
import _ from 'lodash';

const maxAcceptableFailuresStoreOnNode = 10;

const getSslAgentForSeedNode = (seedNodeHost: string, isSsl = false) => {
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
  const appPath = remote.app.getAppPath();
  const crt = fs.readFileSync(path.join(appPath, `/certificates/${filePrefix}.crt`), 'utf-8');
  const sslOptions = {
    // as the seed nodes are using a self signed certificate, we have to provide it here.
    ca: crt,
    // we might need to selectively disable that for tests on swarm-testing or so.
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

      // we might need to selectively disable that for tests on swarm-testing or so.

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

export async function getSnodesFromSeedUrl(urlObj: URL): Promise<Array<any>> {
  const { log } = window;

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

  const endpoint = 'json_rpc';
  const url = `${urlObj.href}${endpoint}`;

  const body = {
    jsonrpc: '2.0',
    id: '0',
    method: 'get_n_service_nodes',
    params,
  };

  const sslAgent = getSslAgentForSeedNode(
    urlObj.hostname,
    urlObj.protocol !== Constants.PROTOCOLS.HTTP
  );

  const fetchOptions = {
    method: 'POST',
    timeout: 10000,
    body: JSON.stringify(body),

    agent: sslAgent,
  };
  window.log.info('insecureNodeFetch => plaintext for getSnodesFromSeedUrl');

  const response = await insecureNodeFetch(url, fetchOptions);

  if (response.status !== 200) {
    log.error(
      `loki_snode_api:::getSnodesFromSeedUrl - invalid response from seed ${urlObj.toString()}:`,
      response
    );
    return [];
  }

  if (response.headers.get('Content-Type') !== 'application/json') {
    log.error('Response is not json');
    return [];
  }

  try {
    const json = await response.json();

    // TODO: validate that all of the fields are present?
    const result = json.result;

    if (!result) {
      log.error(
        `loki_snode_api:::getSnodesFromSeedUrl - invalid result from seed ${urlObj.toString()}:`,
        response
      );
      return [];
    }
    // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
    return result.service_node_states.filter((snode: any) => snode.public_ip !== '0.0.0.0');
  } catch (e) {
    log.error('Invalid json response');
    return [];
  }
}

export type SendParams = {
  pubKey: string;
  ttl: string;
  timestamp: string;
  data: string;
};

// get snodes for pubkey from random snode. Uses an existing snode
export async function requestSnodesForPubkey(pubKey: string): Promise<Array<Snode>> {
  const { log } = window;

  let targetNode;
  try {
    targetNode = await getRandomSnodeAddress();
    const result = await snodeRpc(
      'get_snodes_for_pubkey',
      {
        pubKey,
      },
      targetNode
    );

    if (!result) {
      log.warn(
        `LokiSnodeAPI::requestSnodesForPubkey - lokiRpc on ${targetNode.ip}:${targetNode.port} returned falsish value`,
        result
      );
      return [];
    }

    if (result.status !== 200) {
      log.warn('Status is not 200 for get_snodes_for_pubkey');
      return [];
    }

    try {
      const json = JSON.parse(result.body);

      if (!json.snodes) {
        // we hit this when snode gives 500s
        log.warn(
          `LokiSnodeAPI::requestSnodesForPubkey - lokiRpc on ${targetNode.ip}:${targetNode.port} returned falsish value for snodes`,
          result
        );
        return [];
      }

      const snodes = json.snodes.filter((tSnode: any) => tSnode.ip !== '0.0.0.0');
      return snodes;
    } catch (e) {
      log.warn('Invalid json');
      return [];
    }
  } catch (e) {
    log.error('LokiSnodeAPI::requestSnodesForPubkey - error', e.code, e.message);

    if (targetNode) {
      markNodeUnreachable(targetNode);
    }

    return [];
  }
}

export async function requestLnsMapping(targetNode: Snode, nameHash: any) {
  const { log } = window;

  log.debug('[lns] lns requests to {}:{}', targetNode.ip, targetNode);
  try {
    // TODO: Check response status
    return snodeRpc(
      'get_lns_mapping',
      {
        name_hash: nameHash,
      },
      targetNode
    );
  } catch (e) {
    log.warn('exception caught making lns requests to a node', targetNode, e);
    return false;
  }
}

/**
 * Try to fetch from 3 different snodes an updated list of snodes.
 * If we get less than 24 common snodes in those result, we consider the request to failed and an exception is thrown.
 * Return the list of nodes all snodes agreed on.
 */
export async function getSnodePoolFromSnodes() {
  const existingSnodePool = await getRandomSnodePool();
  if (existingSnodePool.length < 3) {
    window.log.warn('cannot get snodes from snodes; not enough snodes', existingSnodePool.length);
    return;
  }

  // Note intersectionWith only works with 3 at most array to find the common snodes.
  const nodesToRequest = _.sampleSize(existingSnodePool, 3);
  const results = await Promise.all(
    nodesToRequest.map(async node => {
      return pRetry(
        async () => {
          return getSnodePoolFromSnode(node);
        },
        {
          retries: 3,
          factor: 1,
          minTimeout: 1000,
        }
      );
    })
  );

  // we want those at least `requiredSnodesForAgreement` snodes common between all the result
  const commonSnodes = _.intersectionWith(
    results[0],
    results[1],
    results[2],
    (s1: Snode, s2: Snode) => {
      return s1.ip === s2.ip && s1.port === s2.port;
    }
  );
  // We want the snodes to agree on at least this many snodes
  if (commonSnodes.length < requiredSnodesForAgreement) {
    throw new Error('inconsistentSnodePools');
  }
  return commonSnodes;
}

/**
 * Returns a list of uniq snodes got from the specified targetNode
 */
async function getSnodePoolFromSnode(targetNode: Snode): Promise<Array<Snode>> {
  const params = {
    endpoint: 'get_service_nodes',
    params: {
      active_only: true,
      // limit: 256,
      fields: {
        public_ip: true,
        storage_port: true,
        pubkey_x25519: true,
        pubkey_ed25519: true,
      },
    },
  };
  const method = 'oxend_request';
  const result = await snodeRpc(method, params, targetNode);
  if (!result || result.status !== 200) {
    throw new Error('Invalid result');
  }

  try {
    const json = JSON.parse(result.body);

    if (!json || !json.result || !json.result.service_node_states?.length) {
      window.log.error(
        'loki_snode_api:::getSnodePoolFromSnode - invalid result from seed',
        result.body
      );
      return [];
    }

    // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
    const snodes = json.result.service_node_states
      .filter((snode: any) => snode.public_ip !== '0.0.0.0')
      .map((snode: any) => ({
        ip: snode.public_ip,
        port: snode.storage_port,
        pubkey_x25519: snode.pubkey_x25519,
        pubkey_ed25519: snode.pubkey_ed25519,
        version: '',
      })) as Array<Snode>;

    // we the return list by the snode is already made of uniq snodes
    return _.compact(snodes);
  } catch (e) {
    window.log.error('Invalid json response');
    return [];
  }
}

function checkResponse(response: SnodeResponse): void {
  if (response.status === 406) {
    throw new window.textsecure.TimestampError('Invalid Timestamp (check your clock)');
  }

  // Wrong/invalid swarm
  if (response.status === 421) {
    let json;
    try {
      json = JSON.parse(response.body);
    } catch (e) {
      // could not parse result. Consider that snode as invalid
      throw new window.textsecure.InvalidateSwarm();
    }

    // The snode isn't associated with the given public key anymore
    window.log.warn('Wrong swarm, now looking at snodes', json.snodes);
    if (json.snodes?.length) {
      throw new window.textsecure.WrongSwarmError(json.snodes);
    }
    // remove this node from the swarm of this pubkey
    throw new window.textsecure.InvalidateSwarm();
  }
}

export async function storeOnNode(targetNode: Snode, params: SendParams): Promise<boolean> {
  const { log, textsecure } = window;

  let successiveFailures = 0;

  while (successiveFailures < maxAcceptableFailuresStoreOnNode) {
    // the higher this is, the longer the user delay is
    // we don't want to burn through all our retries quickly
    // we need to give the node a chance to heal
    // also failed the user quickly, just means they pound the retry faster
    // this favors a lot more retries and lower delays
    // but that may chew up the bandwidth...
    await sleepFor(successiveFailures * 500);
    try {
      const result = await snodeRpc('store', params, targetNode);

      // do not return true if we get false here...
      if (!result) {
        // this means the node we asked for is likely down
        log.warn(
          `loki_message:::storeOnNode - Try #${successiveFailures}/${maxAcceptableFailuresStoreOnNode} ${targetNode.ip}:${targetNode.port} failed`
        );
        successiveFailures += 1;
        // eslint-disable-next-line no-continue
        continue;
      }

      const snodeRes = result;

      checkResponse(snodeRes);

      if (snodeRes.status !== 200) {
        return false;
      }

      return true;
    } catch (e) {
      log.warn(
        'loki_message:::storeOnNode - send error:',
        e.code,
        e.message,
        `destination ${targetNode.ip}:${targetNode.port}`
      );
      if (e instanceof textsecure.WrongSwarmError) {
        const { newSwarm } = e;
        await updateSnodesFor(params.pubKey, newSwarm);
        return false;
      } else if (e instanceof textsecure.NotFoundError) {
        // TODO: Handle resolution error
      } else if (e instanceof textsecure.TimestampError) {
        log.warn('loki_message:::storeOnNode - Timestamp is invalid');
        throw e;
      } else if (e instanceof textsecure.HTTPError) {
        // TODO: Handle working connection but error response
        const body = await e.response.text();
        log.warn('loki_message:::storeOnNode - HTTPError body:', body);
      } else if (e instanceof window.textsecure.InvalidateSwarm) {
        window.log.warn(
          'Got an `InvalidateSwarm` error, removing this node from this swarm of this pubkey'
        );
        const existingSwarm = await getSwarm(params.pubKey);
        const updatedSwarm = existingSwarm.filter(
          node => node.pubkey_ed25519 !== targetNode.pubkey_ed25519
        );

        await updateSnodesFor(params.pubKey, updatedSwarm);
      }
      successiveFailures += 1;
    }
  }
  markNodeUnreachable(targetNode);
  log.error(
    `loki_message:::storeOnNode - Too many successive failures trying to send to node ${targetNode.ip}:${targetNode.port}`
  );
  return false;
}

export async function retrieveNextMessages(
  targetNode: Snode,
  lastHash: string,
  pubkey: string
): Promise<Array<any>> {
  const params = {
    pubKey: pubkey,
    lastHash: lastHash || '',
  };

  // let exceptions bubble up
  const result = await snodeRpc('retrieve', params, targetNode);

  if (!result) {
    window.log.warn(
      `loki_message:::_retrieveNextMessages - lokiRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
    return [];
  }

  // NOTE: we call `checkResponse` to check for "wrong swarm"
  try {
    checkResponse(result);
  } catch (e) {
    window.log.warn('loki_message:::retrieveNextMessages - send error:', e.code, e.message);
    if (e instanceof window.textsecure.WrongSwarmError) {
      const { newSwarm } = e;
      await updateSnodesFor(params.pubKey, newSwarm);
      return [];
    } else if (e instanceof window.textsecure.InvalidateSwarm) {
      const existingSwarm = await getSwarm(params.pubKey);
      const updatedSwarm = existingSwarm.filter(
        node => node.pubkey_ed25519 !== targetNode.pubkey_ed25519
      );

      await updateSnodesFor(params.pubKey, updatedSwarm);
      return [];
    }
  }

  if (result.status !== 200) {
    window.log('retrieve result is not 200');
    return [];
  }

  try {
    const json = JSON.parse(result.body);
    return json.messages || [];
  } catch (e) {
    window.log.warn('exception while parsing json of nextMessage:', e);

    return [];
  }
}
