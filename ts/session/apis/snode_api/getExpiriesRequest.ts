/* eslint-disable no-restricted-syntax */
import { isEmpty, sample } from 'lodash';
import pRetry from 'p-retry';
import { Snode } from '../../../data/data';
import { UserUtils } from '../../utils';
import { EmptySwarmError } from '../../utils/errors';
import { GetExpiriesFromNodeSubRequest } from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { getSwarmFor } from './snodePool';
import { SnodeSignature } from './snodeSignatures';
import { GetExpiriesResultsContent } from './types';
import { SeedNodeAPI } from '../seed_node_api';

type GetExpiriesRequestResponseResults = Record<string, number>;

async function processGetExpiriesRequestResponse(
  targetNode: Snode,
  expiries: GetExpiriesResultsContent,
  messageHashes: Array<string>
): Promise<GetExpiriesRequestResponseResults> {
  if (isEmpty(expiries)) {
    throw Error(
      `[processExpireRequestResponse] Expiries are missing! ${JSON.stringify(messageHashes)}`
    );
  }

  const results: GetExpiriesRequestResponseResults = {};
  // window.log.debug(
  //   `WIP: [processGetExpiriesRequestResponse] initial results:\nexpiries:${JSON.stringify(
  //     expiries
  //   )}`
  // );

  for (const messageHash of Object.keys(expiries)) {
    if (!expiries[messageHash]) {
      window.log.warn(
        `WIP: [processExpireRequestResponse] Expiries result failure on ${
          targetNode.pubkey_ed25519
        } for messageHash ${messageHash}\n${JSON.stringify(expiries[messageHash])}`
      );
      continue;
    }

    const expiryMs = expiries[messageHash];

    if (!expiryMs) {
      window.log.warn(
        `WIP: [processGetExpiriesRequestResponse] Missing expiry value on ${
          targetNode.pubkey_ed25519
        } so we will ignore this result (${messageHash}) and trust in the force.\n${JSON.stringify(
          expiries[messageHash]
        )}`
      );
      results[messageHash] = -1; // explicit failure value
    } else {
      results[messageHash] = expiryMs;
    }
  }

  return results;
}

async function getExpiriesFromNodes(
  targetNode: Snode,
  expireRequest: GetExpiriesFromNodeSubRequest
): Promise<Array<number>> {
  try {
    const result = await doSnodeBatchRequest(
      [expireRequest],
      targetNode,
      4000,
      expireRequest.params.pubkey,
      'batch'
    );

    if (!result || result.length !== 1) {
      throw Error(
        `There was an issue with the results. sessionRpc ${targetNode.ip}:${
          targetNode.port
        } expireRequest ${JSON.stringify(expireRequest)}`
      );
    }

    // TODOLATER make sure that this code still works once disappearing messages is merged
    // do a basic check to know if we have something kind of looking right (status 200 should always be there for a retrieve)
    const firstResult = result[0];

    if (firstResult.code !== 200) {
      throw Error(`result is not 200 but ${firstResult.code}`);
    }

    const bodyFirstResult = firstResult.body;
    const expirationResults = await processGetExpiriesRequestResponse(
      targetNode,
      bodyFirstResult.expiries as GetExpiriesResultsContent,
      expireRequest.params.messages
    );

    if (!Object.keys(expirationResults).length) {
      throw new Error('expirationResults is empty');
    }

    const expiryTimestamps: Array<number> = Object.values(expirationResults);

    window.log.debug(
      `WIP: [getExpiriesFromNodes] Success!\nHere are the results.\nexpirationResults: ${Object.entries(
        expirationResults
      )}`
    );

    return expiryTimestamps;
  } catch (err) {
    window?.log?.warn(
      'WIP: [getExpiriesFromNodes] - send error:',
      err.message || err,
      `destination ${targetNode.ip}:${targetNode.port}`
    );

    // NOTE batch requests have their own retry logic which includes abort errors that will break our retry logic so we need to catch them and throw regular errors
    if (err instanceof pRetry.AbortError) {
      throw Error(err.message);
    }

    throw err;
  }
}

type GetExpiriesFromSnodeProps = {
  messageHashes: Array<string>;
  timestamp: number;
};

async function buildGetExpiriesRequest(
  props: GetExpiriesFromSnodeProps
): Promise<GetExpiriesFromNodeSubRequest | null> {
  const { messageHashes, timestamp } = props;

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [buildGetExpiriesRequest] No pubkey found', messageHashes);
    return null;
  }

  const signResult = await SnodeSignature.generateGetExpiriesSignature({
    timestamp,
    messageHashes,
  });

  if (!signResult) {
    window.log.error(
      `WIP: [buildGetExpiriesRequest] SnodeSignature.generateUpdateExpirySignature returned an empty result ${messageHashes}`
    );
    return null;
  }

  const getExpiriesParams: GetExpiriesFromNodeSubRequest = {
    method: 'get_expiries',
    params: {
      pubkey: ourPubKey,
      pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
      messages: messageHashes,
      timestamp,
      signature: signResult?.signature,
    },
  };

  window.log.debug(
    `WIP: [buildGetExpiriesRequest] getExpiriesParams: ${JSON.stringify(getExpiriesParams)}`
  );

  return getExpiriesParams;
}

/**
 * Sends an 'get_expiries' request which retrieves the current expiry timestamps of the given messages.
 *
 * The returned TTLs should be assigned to the given disappearing messages.
 * @param messageHashes the hashes of the messages we want the current expiries for
 * @param timestamp the time (ms) the request was initiated, must be within ±60s of the current time so using the server time is recommended.
 * @returns an arrray of the expiry timestamps (TTL) for the given messages
 */
export async function getExpiriesFromSnode(
  props: GetExpiriesFromSnodeProps
): Promise<Array<number>> {
  const { messageHashes } = props;

  // FIXME There is a bug in the snode code that requires at least 2 messages to be requested. Will be fixed in next storage server release
  if (messageHashes.length === 1) {
    messageHashes.push('fakehash');
  }

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [getExpiriesFromSnode] No pubkey found', messageHashes);
    return [];
  }

  let snode: Snode | undefined;

  try {
    const expireRequestParams = await buildGetExpiriesRequest(props);
    if (!expireRequestParams) {
      throw new Error(`Failed to build get_expiries request ${JSON.stringify(props)}`);
    }

    let expiryTimestamps: Array<number> = [];

    await pRetry(
      async () => {
        const swarm = await getSwarmFor(ourPubKey);
        snode = sample(swarm);
        if (!snode) {
          throw new EmptySwarmError(ourPubKey, 'Ran out of swarm nodes to query');
        }
        expiryTimestamps = await getExpiriesFromNodes(snode, expireRequestParams);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: SeedNodeAPI.getMinTimeout(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `WIP: [getExpiriesFromSnode] get expiries from snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
          );
        },
      }
    );

    return expiryTimestamps;
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `WIP: [getExpiriesFromSnode] ${e.code ? `${e.code} ` : ''}${e.message ||
        e} by ${ourPubKey} for ${messageHashes} via snode:${snodeStr}`
    );
    throw e;
  }
}
