import _, { intersectionWith, sampleSize } from 'lodash';
import { SnodePool } from '.';
import { Snode } from '../../../data/data';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { minSnodePoolCount, requiredSnodesForAgreement } from './snodePool';
import { GetServiceNodesSubRequest } from './SnodeRequestTypes';

function buildSnodeListRequests(): Array<GetServiceNodesSubRequest> {
  const request: GetServiceNodesSubRequest = {
    method: 'oxend_request',
    params: {
      endpoint: 'get_service_nodes',
      params: {
        active_only: true,
        fields: {
          public_ip: true,
          storage_port: true,
          pubkey_x25519: true,
          pubkey_ed25519: true,
        },
      },
    },
  };
  return [request];
}

/**
 * Returns a list of unique snodes got from the specified targetNode.
 * This function won't try to rebuild a path if at some point we don't have enough snodes.
 * This is exported for testing purpose only.
 */
async function getSnodePoolFromSnode(targetNode: Snode): Promise<Array<Snode>> {
  const requests = buildSnodeListRequests();
  const results = await doSnodeBatchRequest(requests, targetNode, 4000, null);

  const firstResult = results[0];

  if (!firstResult || firstResult.code !== 200) {
    throw new Error('Invalid result');
  }

  try {
    const json = firstResult.body;

    if (!json || !json.result || !json.result.service_node_states?.length) {
      window?.log?.error('getSnodePoolFromSnode - invalid result from snode', firstResult);
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
      })) as Array<Snode>;
    GetNetworkTime.handleTimestampOffsetFromNetwork('get_service_nodes', json.t);

    // we the return list by the snode is already made of uniq snodes
    return _.compact(snodes);
  } catch (e) {
    window?.log?.error('Invalid json response');
    return [];
  }
}

/**
 * Try to fetch from 3 different snodes an updated list of snodes.
 * If we get less than 24 common snodes in those result, we consider the request to failed and an exception is thrown.
 * The three snode we make the request to is randomized.
 * This function is to be called with a pRetry so that if one snode does not reply anything, another might be choose next time.
 * Return the list of nodes all snodes agreed on.
 */
async function getSnodePoolFromSnodes() {
  const existingSnodePool = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
  if (existingSnodePool.length <= minSnodePoolCount) {
    window?.log?.warn(
      'getSnodePoolFromSnodes: Cannot get snodes list from snodes; not enough snodes',
      existingSnodePool.length
    );
    throw new Error(
      `Cannot get snodes list from snodes; not enough snodes even after refetching from seed', ${existingSnodePool.length}`
    );
  }

  // Note intersectionWith only works with 3 at most array to find the common snodes.
  const nodesToRequest = sampleSize(existingSnodePool, 3);
  const results = await Promise.all(
    nodesToRequest.map(async node => {
      /**
       * this call is already retried if the snode does not reply
       * (at least when onion requests are enabled)
       * this request might want to rebuild a path if the snode length gets < minSnodePoolCount during the
       * retries, so we need to make sure this does not happen.
       *
       * Remember that here, we are trying to fetch from snodes the updated list of snodes to rebuild a path.
       * If we don't disable rebuilding a path below, this gets to a chicken and egg problem.
       */
      return ServiceNodesList.getSnodePoolFromSnode(node);
    })
  );

  // we want those at least `requiredSnodesForAgreement` snodes common between all the result
  const commonSnodes = intersectionWith(
    results[0],
    results[1],
    results[2],
    (s1: Snode, s2: Snode) => {
      return s1.ip === s2.ip && s1.port === s2.port;
    }
  );
  // We want the snodes to agree on at least this many snodes
  if (commonSnodes.length < requiredSnodesForAgreement) {
    throw new Error(
      `Inconsistent snode pools. We did not get at least ${requiredSnodesForAgreement} in common`
    );
  }
  return commonSnodes;
}

export const ServiceNodesList = { getSnodePoolFromSnode, getSnodePoolFromSnodes };
