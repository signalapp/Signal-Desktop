/* eslint-disable no-restricted-syntax */
import { isFinite, isNil, isNumber, sample } from 'lodash';
import pRetry from 'p-retry';
import { Snode } from '../../../data/data';
import { UserUtils } from '../../utils';
import { EmptySwarmError } from '../../utils/errors';
import { SeedNodeAPI } from '../seed_node_api';
import { GetExpiriesFromNodeSubRequest, fakeHash } from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { getSwarmFor } from './snodePool';
import { SnodeSignature } from './snodeSignatures';
import { GetExpiriesResultsContent } from './types';

export type GetExpiriesRequestResponseResults = Record<string, number>;

export async function processGetExpiriesRequestResponse(
  _targetNode: Snode,
  expiries: GetExpiriesResultsContent,
  messageHashes: Array<string>
): Promise<GetExpiriesRequestResponseResults> {
  if (isNil(expiries)) {
    throw Error(
      `[processGetExpiriesRequestResponse] Expiries are nul/undefined! ${JSON.stringify(
        messageHashes
      )}`
    );
  }

  const results: GetExpiriesRequestResponseResults = {};
  // Note: we iterate over the hash we've requested and not the one we received,
  // because a message which expired already is not in the result at all (and we need to force it to be expired)
  for (const messageHash of messageHashes) {
    const expiryMs = expiries[messageHash];

    if (expiries[messageHash] && isNumber(expiryMs) && isFinite(expiryMs)) {
      results[messageHash] = expiryMs;
    } // not adding the Date.now() fallback here as it is done in the caller of this function
  }

  return results;
}

async function getExpiriesFromNodes(
  targetNode: Snode,
  expireRequest: GetExpiriesFromNodeSubRequest
) {
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
      throw Error(`getExpiriesFromNodes result is not 200 but ${firstResult.code}`);
    }

    // expirationResults is a record of {messageHash: currentExpiry}
    const expirationResults = await processGetExpiriesRequestResponse(
      targetNode,
      firstResult.body.expiries as GetExpiriesResultsContent,
      expireRequest.params.messages
    );

    // Note: even if expirationResults is empty we need to process the results.
    // The status code is 200, so if the results is empty, it means all those messages already expired.

    // Note: a hash which already expired on the server is not going to be returned. So we force it's fetchedExpiry to be now() to make it expire asap
    const expiriesWithForcedExpiried = expireRequest.params.messages.map(messageHash => ({
      messageHash,
      fetchedExpiry: expirationResults?.[messageHash] || Date.now(),
    }));

    return expiriesWithForcedExpiried;
  } catch (err) {
    // NOTE batch requests have their own retry logic which includes abort errors that will break our retry logic so we need to catch them and throw regular errors
    if (err instanceof pRetry.AbortError) {
      throw Error(err.message);
    }

    throw err;
  }
}

export type GetExpiriesFromSnodeProps = {
  messageHashes: Array<string>;
};

export async function buildGetExpiriesRequest({
  messageHashes,
}: GetExpiriesFromSnodeProps): Promise<GetExpiriesFromNodeSubRequest | null> {
  const timestamp = GetNetworkTime.getNowWithNetworkOffset();

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('[buildGetExpiriesRequest] No pubkey found', messageHashes);
    return null;
  }

  const signResult = await SnodeSignature.generateGetExpiriesSignature({
    timestamp,
    messageHashes,
  });

  if (!signResult) {
    window.log.error(
      `[buildGetExpiriesRequest] SnodeSignature.generateUpdateExpirySignature returned an empty result ${messageHashes}`
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
export async function getExpiriesFromSnode({ messageHashes }: GetExpiriesFromSnodeProps) {
  // FIXME There is a bug in the snode code that requires at least 2 messages to be requested. Will be fixed in next storage server release
  if (messageHashes.length === 1) {
    messageHashes.push(fakeHash);
  }

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('[getExpiriesFromSnode] No pubkey found', messageHashes);
    return [];
  }

  let snode: Snode | undefined;

  try {
    const expireRequestParams = await buildGetExpiriesRequest({ messageHashes });
    if (!expireRequestParams) {
      throw new Error(`Failed to build get_expiries request ${JSON.stringify({ messageHashes })}`);
    }

    const fetchedExpiries = await pRetry(
      async () => {
        const swarm = await getSwarmFor(ourPubKey);
        snode = sample(swarm);
        if (!snode) {
          throw new EmptySwarmError(ourPubKey, 'Ran out of swarm nodes to query');
        }
        return getExpiriesFromNodes(snode, expireRequestParams);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: SeedNodeAPI.getMinTimeout(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `[getExpiriesFromSnode] get expiries from snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
          );
        },
      }
    );

    return fetchedExpiries;
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `[getExpiriesFromSnode] ${e.code ? `${e.code} ` : ''}${
        e.message || e
      } by ${ourPubKey} for ${messageHashes} via snode:${snodeStr}`
    );
    throw e;
  }
}
