import { isArray } from 'lodash';
import { Snode } from '../../../data/data';
import { processOnionRequestErrorAtDestination, SnodeResponse } from './onions';
import { snodeRpc } from './sessionRpc';
import {
  MAX_SUBREQUESTS_COUNT,
  NotEmptyArrayOfBatchResults,
  SnodeApiSubRequests,
} from './SnodeRequestTypes';

/**
 * This is the equivalent to the batch send on sogs. The target node runs each sub request and returns a list of all the sub status and bodies.
 * If the global status code is not 200, an exception is thrown.
 * The body is already parsed from json and is enforced to be an Array of at least one element
 * @param subRequests the list of requests to do
 * @param targetNode the node to do the request to, once all the onion routing is done
 * @param timeout the timeout at which we should cancel this request.
 * @param associatedWith used mostly for handling 421 errors, we need the pubkey the change is associated to
 * @param method can be either batch or sequence. A batch call will run all calls even if one of them fails. A sequence call will stop as soon as the first one fails
 */
export async function doSnodeBatchRequest(
  subRequests: Array<SnodeApiSubRequests>,
  targetNode: Snode,
  timeout: number,
  associatedWith: string | null,
  method: 'batch' | 'sequence' = 'batch'
): Promise<NotEmptyArrayOfBatchResults> {
  if (subRequests.length > MAX_SUBREQUESTS_COUNT) {
    window.log.error(
      `batch subRequests count cannot be more than ${MAX_SUBREQUESTS_COUNT}. Got ${subRequests.length}`
    );
    throw new Error(
      `batch subRequests count cannot be more than ${MAX_SUBREQUESTS_COUNT}. Got ${subRequests.length}`
    );
  }
  const result = await snodeRpc({
    method,
    params: { requests: subRequests },
    targetNode,
    associatedWith,
    timeout,
  });
  if (!result) {
    window?.log?.warn(
      `doSnodeBatchRequest - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
    throw new Error(
      `doSnodeBatchRequest - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
  }
  const decoded = decodeBatchRequest(result);

  if (decoded?.length) {
    for (let index = 0; index < decoded.length; index++) {
      const resultRow = decoded[index];
      // eslint-disable-next-line no-await-in-loop
      await processOnionRequestErrorAtDestination({
        statusCode: resultRow.code,
        body: JSON.stringify(resultRow.body),
        associatedWith: associatedWith || undefined,
        destinationSnodeEd25519: targetNode.pubkey_ed25519,
      });
    }
  }

  return decoded;
}

/**
 * Make sure the global batch status code is 200, parse the content as json and return it
 */
function decodeBatchRequest(snodeResponse: SnodeResponse): NotEmptyArrayOfBatchResults {
  try {
    // console.error('decodeBatch: ', snodeResponse);
    if (snodeResponse.status !== 200) {
      throw new Error(`decodeBatchRequest invalid status code: ${snodeResponse.status}`);
    }
    const parsed = JSON.parse(snodeResponse.body);

    if (!isArray(parsed.results)) {
      throw new Error('decodeBatchRequest results is not an array');
    }

    if (!parsed.results.length) {
      throw new Error('decodeBatchRequest results an empty array');
    }

    return parsed.results;
  } catch (e) {
    window.log.error('decodeBatchRequest failed with ', e.message);
    throw e;
  }
  // "{"results":[{"body":"retrieve signature verification failed","code":401}]}"
}
