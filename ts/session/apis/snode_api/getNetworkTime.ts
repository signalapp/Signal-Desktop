/**
 * Makes a post to a node to receive the timestamp info. If non-existant, returns -1
 * @param snode Snode to send request to
 * @returns timestamp of the response from snode
 */

import { isNumber } from 'lodash';
import { Snode } from '../../../data/data';
import { doSnodeBatchRequest } from './batchRequest';
import { NetworkTimeSubRequest } from './SnodeRequestTypes';

function getNetworkTimeSubRequests(): Array<NetworkTimeSubRequest> {
  const request: NetworkTimeSubRequest = { method: 'info', params: {} };

  return [request];
}

const getNetworkTime = async (snode: Snode): Promise<string | number> => {
  const subRequests = getNetworkTimeSubRequests();
  const result = await doSnodeBatchRequest(subRequests, snode, 4000, null);
  if (!result || !result.length) {
    window?.log?.warn(`getNetworkTime on ${snode.ip}:${snode.port} returned falsish value`, result);
    throw new Error('getNetworkTime: Invalid result');
  }

  const firstResult = result[0];

  if (firstResult.code !== 200) {
    window?.log?.warn('Status is not 200 for getNetworkTime but: ', firstResult.code);
    throw new Error('getNetworkTime: Invalid status code');
  }

  const timestamp = firstResult?.body?.timestamp;
  if (!timestamp) {
    throw new Error(`getNetworkTime returned invalid timestamp: ${timestamp}`);
  }
  GetNetworkTime.handleTimestampOffsetFromNetwork('getNetworkTime', timestamp);
  return timestamp;
};

let latestTimestampOffset = Number.MAX_SAFE_INTEGER;

function handleTimestampOffsetFromNetwork(_request: string, snodeTimestamp: number) {
  if (snodeTimestamp && isNumber(snodeTimestamp) && snodeTimestamp > 1609419600 * 1000) {
    // first january 2021. Arbitrary, just want to make sure the return timestamp is somehow valid and not some crazy low value
    const now = Date.now();
    if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
      window?.log?.info(`first timestamp offset received:  ${now - snodeTimestamp}ms`);
    }
    latestTimestampOffset = now - snodeTimestamp;
  }
}

/**
 * This function has no use to be called except during tests.
 * @returns the current offset we have with the rest of the network.
 */
function getLatestTimestampOffset() {
  if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
    window.log.debug('latestTimestampOffset is not set yet');
    return 0;
  }
  // window.log.info('latestTimestampOffset is ', latestTimestampOffset);

  return latestTimestampOffset;
}

function getNowWithNetworkOffset() {
  // make sure to call exports here, as we stub the exported one for testing.
  return Date.now() - GetNetworkTime.getLatestTimestampOffset();
}

export const GetNetworkTime = {
  getNetworkTime,
  handleTimestampOffsetFromNetwork,
  getLatestTimestampOffset,
  getNowWithNetworkOffset,
};
