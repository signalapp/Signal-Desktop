import { isEmpty } from 'lodash';
import { Snode } from '../../../data/types';
import {
  DeleteByHashesFromNodeParams,
  DeleteFromNodeSubRequest,
  NotEmptyArrayOfBatchResults,
  StoreOnNodeParams,
  StoreOnNodeSubRequest,
} from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';

function justStores(params: Array<StoreOnNodeParams>) {
  return params.map(p => {
    return {
      method: 'store',
      params: p,
    } as StoreOnNodeSubRequest;
  });
}

function buildStoreRequests(
  params: Array<StoreOnNodeParams>,
  toDeleteOnSequence: DeleteByHashesFromNodeParams | null
): Array<StoreOnNodeSubRequest | DeleteFromNodeSubRequest> {
  if (!toDeleteOnSequence || isEmpty(toDeleteOnSequence)) {
    return justStores(params);
  }
  return [...justStores(params), ...buildDeleteByHashesSubRequest(toDeleteOnSequence)];
}

function buildDeleteByHashesSubRequest(
  params: DeleteByHashesFromNodeParams
): Array<DeleteFromNodeSubRequest> {
  return [
    {
      method: 'delete',
      params,
    },
  ];
}

/**
 * Send a 'store' request to the specified targetNode, using params as argument
 * @returns the Array of stored hashes if it is a success, or null
 */
async function storeOnNode(
  targetNode: Snode,
  params: Array<StoreOnNodeParams>,
  toDeleteOnSequence: DeleteByHashesFromNodeParams | null
): Promise<NotEmptyArrayOfBatchResults> {
  try {
    const subRequests = buildStoreRequests(params, toDeleteOnSequence);
    const result = await doSnodeBatchRequest(
      subRequests,
      targetNode,
      4000,
      params[0].pubkey,
      toDeleteOnSequence ? 'sequence' : 'batch'
    );

    if (!result || !result.length) {
      window?.log?.warn(
        `SessionSnodeAPI::requestSnodesForPubkeyWithTargetNodeRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsish value`,
        result
      );
      throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid result');
    }

    const firstResult = result[0];

    if (firstResult.code !== 200) {
      window?.log?.warn('first result status is not 200 for storeOnNode but: ', firstResult.code);
      throw new Error('storeOnNode: Invalid status code');
    }

    GetNetworkTime.handleTimestampOffsetFromNetwork('store', firstResult.body.t);

    return result;
  } catch (e) {
    window?.log?.warn('store - send error:', e, `destination ${targetNode.ip}:${targetNode.port}`);
    throw e;
  }
}

export const SnodeAPIStore = { storeOnNode };
