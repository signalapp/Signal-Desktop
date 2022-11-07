import { Snode } from '../../../data/data';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { StoreOnNodeParams, StoreOnNodeSubRequest } from './SnodeRequestTypes';

function buildStoreRequests(params: StoreOnNodeParams): Array<StoreOnNodeSubRequest> {
  const request: StoreOnNodeSubRequest = {
    method: 'store',
    params,
  };
  return [request];
}

async function storeOnNode(
  targetNode: Snode,
  params: StoreOnNodeParams
): Promise<string | null | boolean> {
  try {
    const subRequests = buildStoreRequests(params);
    const result = await doSnodeBatchRequest(subRequests, targetNode, 4000, params.pubkey);

    if (!result || !result.length) {
      window?.log?.warn(
        `SessionSnodeAPI::requestSnodesForPubkeyWithTargetNodeRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsish value`,
        result
      );
      throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid result');
    }

    const firstResult = result[0];

    if (firstResult.code !== 200) {
      window?.log?.warn('Status is not 200 for storeOnNode but: ', firstResult.code);
      throw new Error('storeOnNode: Invalid status code');
    }

    // no retry here. If an issue is with the path this is handled in lokiOnionFetch
    // if there is an issue with the targetNode, we still send a few times this request to a few snodes in // already so it's handled

    const parsed = firstResult.body;
    GetNetworkTime.handleTimestampOffsetFromNetwork('store', parsed.t);

    const messageHash = parsed.hash;
    if (messageHash) {
      return messageHash;
    }

    return true;
  } catch (e) {
    window?.log?.warn('store - send error:', e, `destination ${targetNode.ip}:${targetNode.port}`);
    throw e;
  }
}

export const SnodeAPIStore = { storeOnNode };
