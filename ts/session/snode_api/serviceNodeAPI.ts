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
import {
  sendOnionRequestLsrpcDest,
  snodeHttpsAgent,
  SnodeResponse,
} from './onions';

import { sleepFor } from '../../../js/modules/loki_primitives';

export { sendOnionRequestLsrpcDest };

import {
  getRandomSnodeAddress,
  markNodeUnreachable,
  Snode,
  updateSnodesFor,
} from './snodePool';
import { Constants } from '..';

/**
 * Currently unused. If we need it again, be sure to update it to onion routing rather
 * than using a plain nodeFetch
 */
export async function getVersion(
  node: Snode,
  retries: number = 0
): Promise<string | boolean> {
  const SNODE_VERSION_RETRIES = 3;

  const { log } = window;

  try {
    window.log.warn('insecureNodeFetch => plaintext for getVersion');
    const result = await insecureNodeFetch(
      `https://${node.ip}:${node.port}/get_stats/v1`,
      {
        agent: snodeHttpsAgent,
      }
    );
    const data = await result.json();
    if (data.version) {
      return data.version;
    } else {
      return false;
    }
  } catch (e) {
    // ECONNREFUSED likely means it's just offline...
    // ECONNRESET seems to retry and fail as ECONNREFUSED (so likely a node going offline)
    // ETIMEDOUT not sure what to do about these
    // retry for now but maybe we should be marking bad...
    if (e.code === 'ECONNREFUSED') {
      markNodeUnreachable(node);
      // clean up these error messages to be a little neater
      log.warn(
        `LokiSnodeAPI::_getVersion - ${node.ip}:${node.port} is offline, removing`
      );
      // if not ECONNREFUSED, it's mostly ECONNRESETs
      // ENOTFOUND could mean no internet or hiccup
    } else if (retries < SNODE_VERSION_RETRIES) {
      log.warn(
        'LokiSnodeAPI::_getVersion - Error',
        e.code,
        e.message,
        `on ${node.ip}:${node.port} retrying in 1s`
      );
      await sleepFor(1000);
      return getVersion(node, retries + 1);
    } else {
      markNodeUnreachable(node);
      log.warn(
        `LokiSnodeAPI::_getVersion - failing to get version for ${node.ip}:${node.port}`
      );
    }
    // maybe throw?
    return false;
  }
}

const sha256 = (s: string) => {
  return crypto
    .createHash('sha256')
    .update(s)
    .digest('base64');
};

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
  const crt = fs.readFileSync(
    path.join(appPath, `/certificates/${filePrefix}.crt`),
    'utf-8'
  );
  // debugger;
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
    return result.service_node_states.filter(
      (snode: any) => snode.public_ip !== '0.0.0.0'
    );
  } catch (e) {
    log.error('Invalid json response');
    return [];
  }
}

interface SendParams {
  pubKey: string;
  ttl: string;
  nonce: string;
  timestamp: string;
  data: string;
}

// get snodes for pubkey from random snode. Uses an existing snode
export async function requestSnodesForPubkey(
  pubKey: string
): Promise<Array<Snode>> {
  const { log } = window;

  let snode;
  try {
    snode = await getRandomSnodeAddress();
    const result = await snodeRpc(
      'get_snodes_for_pubkey',
      {
        pubKey,
      },
      snode
    );

    if (!result) {
      log.warn(
        `LokiSnodeAPI::requestSnodesForPubkey - lokiRpc on ${snode.ip}:${snode.port} returned falsish value`,
        result
      );
      return [];
    }

    const res = result as SnodeResponse;

    if (res.status !== 200) {
      log.warn('Status is not 200 for get_snodes_for_pubkey');
      return [];
    }

    try {
      const json = JSON.parse(res.body);

      if (!json.snodes) {
        // we hit this when snode gives 500s
        log.warn(
          `LokiSnodeAPI::requestSnodesForPubkey - lokiRpc on ${snode.ip}:${snode.port} returned falsish value for snodes`,
          result
        );
        return [];
      }

      const snodes = json.snodes.filter(
        (tSnode: any) => tSnode.ip !== '0.0.0.0'
      );
      return snodes;
    } catch (e) {
      log.warn('Invalid json');
      return [];
    }
  } catch (e) {
    log.error(
      'LokiSnodeAPI::requestSnodesForPubkey - error',
      e.code,
      e.message
    );

    if (snode) {
      markNodeUnreachable(snode);
    }

    return [];
  }
}

export async function requestLnsMapping(node: Snode, nameHash: any) {
  const { log } = window;

  log.debug('[lns] lns requests to {}:{}', node.ip, node.port);

  try {
    // TODO: Check response status
    return snodeRpc(
      'get_lns_mapping',
      {
        name_hash: nameHash,
      },
      node
    );
  } catch (e) {
    log.warn('exception caught making lns requests to a node', node, e);
    return false;
  }
}

function checkResponse(response: SnodeResponse): void {
  const { log, textsecure } = window;

  if (response.status === 406) {
    throw new textsecure.TimestampError('Invalid Timestamp (check your clock)');
  }

  const json = JSON.parse(response.body);

  // Wrong swarm
  if (response.status === 421) {
    log.warn('Wrong swarm, now looking at snodes', json.snodes);
    const newSwarm = json.snodes ? json.snodes : [];
    throw new textsecure.WrongSwarmError(newSwarm);
  }

  // Wrong PoW difficulty
  if (response.status === 432) {
    log.error('Wrong POW', json);
    throw new textsecure.WrongDifficultyError(json.difficulty);
  }
}

export async function storeOnNode(
  targetNode: Snode,
  params: SendParams
): Promise<boolean> {
  const { log, textsecure } = window;

  let successiveFailures = 0;
  while (successiveFailures < MAX_ACCEPTABLE_FAILURES) {
    // the higher this is, the longer the user delay is
    // we don't want to burn through all our retries quickly
    // we need to give the node a chance to heal
    // also failed the user quickly, just means they pound the retry faster
    // this favors a lot more retries and lower delays
    // but that may chew up the bandwidth...
    await sleepFor(successiveFailures * 500);
    try {
      const result = await snodeRpc('store', params, targetNode);

      // succcessful messages should look like
      // `{\"difficulty\":1}`
      // but so does invalid pow, so be careful!

      // do not return true if we get false here...
      if (result === false) {
        // this means the node we asked for is likely down
        log.warn(
          `loki_message:::storeOnNode - Try #${successiveFailures}/${MAX_ACCEPTABLE_FAILURES} ${targetNode.ip}:${targetNode.port} failed`
        );
        successiveFailures += 1;
        // eslint-disable-next-line no-continue
        continue;
      }

      const snodeRes = result as SnodeResponse;

      checkResponse(snodeRes);

      if (snodeRes.status !== 200) {
        return false;
      }

      const json = JSON.parse(snodeRes.body);
      // Make sure we aren't doing too much PoW
      const currentDifficulty = window.storage.get('PoWDifficulty', null);
      if (
        json &&
        json.difficulty &&
        json.difficulty !== parseInt(currentDifficulty, 10)
      ) {
        window.storage.put('PoWDifficulty', json.difficulty);
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
      } else if (e instanceof textsecure.WrongDifficultyError) {
        const { newDifficulty } = e;
        // difficulty of 100 happens when a snode restarts. We have to exit the loop and markNodeUnreachable()
        if (newDifficulty === 100) {
          log.warn(
            'loki_message:::storeOnNode - invalid new difficulty:100. Marking node as bad.'
          );
          successiveFailures = MAX_ACCEPTABLE_FAILURES;
          continue;
        }

        if (!Number.isNaN(newDifficulty)) {
          window.storage.put('PoWDifficulty', newDifficulty);
        }
        throw e;
      } else if (e instanceof textsecure.NotFoundError) {
        // TODO: Handle resolution error
      } else if (e instanceof textsecure.TimestampError) {
        log.warn('loki_message:::storeOnNode - Timestamp is invalid');
        throw e;
      } else if (e instanceof textsecure.HTTPError) {
        // TODO: Handle working connection but error response
        const body = await e.response.text();
        log.warn('loki_message:::storeOnNode - HTTPError body:', body);
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
  nodeData: Snode,
  lastHash: string,
  pubkey: string
): Promise<Array<any>> {
  const params = {
    pubKey: pubkey,
    lastHash: lastHash || '',
  };

  // let exceptions bubble up
  const result = await snodeRpc('retrieve', params, nodeData);

  if (!result) {
    window.log.warn(
      `loki_message:::_retrieveNextMessages - lokiRpc could not talk to ${nodeData.ip}:${nodeData.port}`
    );
    return [];
  }

  const res = result as SnodeResponse;

  // NOTE: Retrieve cannot result in "wrong POW", but we call
  // `checkResponse` to check for "wrong swarm"
  try {
    checkResponse(res);
  } catch (e) {
    window.log.warn(
      'loki_message:::retrieveNextMessages - send error:',
      e.code,
      e.message
    );
    if (e instanceof window.textsecure.WrongSwarmError) {
      const { newSwarm } = e;
      await updateSnodesFor(params.pubKey, newSwarm);
      return [];
    }
  }

  if (res.status !== 200) {
    window.log('retrieve result is not 200');
    return [];
  }

  try {
    const json = JSON.parse(res.body);
    return json.messages || [];
  } catch (e) {
    window.log.warn('exception while parsing json of nextMessage:', e);

    return [];
  }
}

const MAX_ACCEPTABLE_FAILURES = 10;
