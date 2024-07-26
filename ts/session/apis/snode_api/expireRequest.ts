/* eslint-disable no-restricted-syntax */
import {
  chunk,
  compact,
  difference,
  flatten,
  isArray,
  isEmpty,
  isNumber,
  sample,
  uniqBy,
} from 'lodash';
import pRetry from 'p-retry';
import { Snode } from '../../../data/types';
import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { fromBase64ToArray, fromHexToArray } from '../../utils/String';
import { EmptySwarmError } from '../../utils/errors';
import { SeedNodeAPI } from '../seed_node_api';
import {
  MAX_SUBREQUESTS_COUNT,
  UpdateExpiryOnNodeSubRequest,
  WithShortenOrExtend,
  fakeHash,
} from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { getSwarmFor } from './snodePool';
import { SnodeSignature } from './snodeSignatures';
import { ExpireMessageResultItem, ExpireMessagesResultsContent } from './types';

export type verifyExpireMsgsResponseSignatureProps = ExpireMessageResultItem & {
  pubkey: string;
  snodePubkey: string;
  messageHashes: Array<string>;
};

export async function verifyExpireMsgsResponseSignature({
  pubkey,
  snodePubkey,
  messageHashes,
  expiry,
  signature,
  updated,
  unchanged,
}: verifyExpireMsgsResponseSignatureProps): Promise<boolean> {
  if (!expiry || isEmpty(messageHashes) || isEmpty(signature)) {
    window.log.error(
      `[verifyExpireMsgsSignature] missing argument\nexpiry:${expiry}\nmessageHashes:${messageHashes}\nsignature:${signature}`
    );
    return false;
  }

  const edKeyPrivBytes = fromHexToArray(snodePubkey);
  const hashes = [...messageHashes, ...updated];
  if (unchanged && Object.keys(unchanged).length > 0) {
    hashes.push(
      ...Object.entries(unchanged)
        .map(([key, value]: [string, number]) => {
          return `${key}${value}`;
        })
        .sort()
    );
  }

  const verificationString = `${pubkey}${expiry}${hashes.join('')}`;
  const verificationData = StringUtils.encode(verificationString, 'utf8');

  const sodium = await getSodiumRenderer();
  try {
    const isValid = sodium.crypto_sign_verify_detached(
      fromBase64ToArray(signature),
      new Uint8Array(verificationData),
      edKeyPrivBytes
    );

    return isValid;
  } catch (e) {
    window.log.error('[verifyExpireMsgsSignature] operation failed with: ', e.message);
    return false;
  }
}

export type ExpireRequestResponseResults = Record<
  string,
  { hashes: Array<string>; expiry: number; unchangedHashes: Record<string, number> }
>;

export async function processExpireRequestResponse(
  pubkey: string,
  targetNode: Snode,
  swarm: ExpireMessagesResultsContent,
  messageHashes: Array<string>
): Promise<ExpireRequestResponseResults> {
  if (isEmpty(swarm)) {
    throw Error(`[processExpireRequestResponse] Swarm is missing! ${messageHashes}`);
  }

  const results: ExpireRequestResponseResults = {};

  for (const nodeKey of Object.keys(swarm)) {
    if (!isEmpty(swarm[nodeKey].failed)) {
      window.log.warn(
        `[processExpireRequestResponse] Swarm result failure on ${
          targetNode.pubkey_ed25519
        } for nodeKey ${nodeKey}\n${JSON.stringify(swarm[nodeKey])} moving to next node`
      );
      continue;
    }

    const updatedHashes = swarm[nodeKey].updated;
    const unchangedHashes = swarm[nodeKey].unchanged;
    const expiry = swarm[nodeKey].expiry;
    const signature = swarm[nodeKey].signature;

    if (!updatedHashes || !expiry || !signature) {
      // most likely just a timeout from one of the swarm members
      // window.log.debug(
      //   `[processExpireRequestResponse] Missing arguments on ${
      //     targetNode.pubkey_ed25519
      //   } so we will ignore this result on (${nodeKey}) and move onto the next node.\n${JSON.stringify(
      //     swarm[nodeKey]
      //   )}`
      // );
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const isValid = await verifyExpireMsgsResponseSignature({
      pubkey,
      snodePubkey: nodeKey,
      messageHashes,
      expiry,
      signature,
      updated: updatedHashes,
      unchanged: unchangedHashes,
    });

    if (!isValid) {
      window.log.error(
        `[processExpireRequestResponse] Signature verification failed on ${
          targetNode.pubkey_ed25519
        }\n${JSON.stringify(messageHashes)}`
      );
      continue;
    }
    results[nodeKey] = { hashes: updatedHashes, expiry, unchangedHashes: unchangedHashes ?? {} };
  }

  return results;
}

type UpdatedExpiryWithHashes = { messageHashes: Array<string>; updatedExpiryMs: number };
type UpdatedExpiryWithHash = { messageHash: string; updatedExpiryMs: number };

async function updateExpiryOnNodes(
  targetNode: Snode,
  ourPubKey: string,
  expireRequests: Array<UpdateExpiryOnNodeSubRequest>
): Promise<Array<UpdatedExpiryWithHash>> {
  try {
    const result = await doSnodeBatchRequest(expireRequests, targetNode, 4000, ourPubKey, 'batch');

    if (!result || result.length !== expireRequests.length) {
      window.log.error(
        `There was an issue with the results. updateExpiryOnNodes ${targetNode.ip}:${targetNode.port}. expected length or results ${expireRequests.length} but got ${result.length}`
      );
      throw Error(
        `There was an issue with the results. updateExpiryOnNodes ${targetNode.ip}:${targetNode.port}`
      );
    }

    // TODOLATER make sure that this code still works once disappearing messages is merged
    // do a basic check to know if we have something kind of looking right (status 200 should always be there for a retrieve)
    const firstResult = result[0];

    if (firstResult.code !== 200) {
      throw Error(`result is not 200 but ${firstResult.code}`);
    }

    // Note: expirationResults is an array of `Map<snode pubkeys, {msgHashes,expiry}>` changed/unchanged which have a valid signature
    const expirationResults: Array<ExpireRequestResponseResults> = await Promise.all(
      expireRequests.map((request, index) => {
        const bodyIndex = result[index]?.body?.swarm;
        if (!bodyIndex || isEmpty(bodyIndex)) {
          return {};
        }

        return processExpireRequestResponse(
          ourPubKey,
          targetNode,
          bodyIndex as ExpireMessagesResultsContent,
          request.params.messages
        );
      })
    );

    const changesValid: Array<UpdatedExpiryWithHashes> = [];
    // then we need to iterate over each subrequests result to find the snodes which reporting a valid update of the expiry

    for (let index = 0; index < expirationResults.length; index++) {
      // the 0 gets the first snode of the swarm (they all report the same *sig verified* changes).
      // the 1 discard the snode_pk entry and access the request result (i.e. a record with hashes: [string] and the expiry)
      const expirationResult = Object.entries(expirationResults?.[index])?.[0]?.[1];
      if (
        !expirationResult ||
        isEmpty(expirationResult) ||
        !isArray(expirationResult.hashes) ||
        !isNumber(expirationResult.expiry)
      ) {
        continue;
      }
      changesValid.push({
        messageHashes: expirationResult.hashes,
        updatedExpiryMs: expirationResult.expiry,
      });
      if (!isEmpty(expirationResult.unchangedHashes)) {
        const unchanged = Object.entries(expirationResult.unchangedHashes);
        unchanged.forEach(m => {
          changesValid.push({
            messageHashes: [m[0]],
            updatedExpiryMs: m[1],
          });
        });
      }
    }

    const hashesRequestedButNotInResults = difference(
      flatten(expireRequests.map(m => m.params.messages)),
      [...flatten(changesValid.map(c => c.messageHashes)), fakeHash]
    );
    if (!isEmpty(hashesRequestedButNotInResults)) {
      const now = Date.now();
      window.log.debug(
        'messageHashes not found on swarm, considering them expired now():',
        hashesRequestedButNotInResults,
        now
      );
      // we requested hashes which are not part of the result. They most likely expired already so let's mark those messages as expiring now.
      changesValid.push({
        messageHashes: hashesRequestedButNotInResults,
        updatedExpiryMs: now,
      });
    }

    const expiryWithIndividualHash: Array<UpdatedExpiryWithHash> = flatten(
      changesValid.map(change =>
        change.messageHashes.map(h => ({ messageHash: h, updatedExpiryMs: change.updatedExpiryMs }))
      )
    );
    window.log.debug('update expiry expiryWithIndividualHash: ', expiryWithIndividualHash);
    return expiryWithIndividualHash;
  } catch (err) {
    // NOTE batch requests have their own retry logic which includes abort errors that will break our retry logic so we need to catch them and throw regular errors
    if (err instanceof pRetry.AbortError) {
      throw Error(err.message);
    }

    throw err;
  }
}

export type ExpireMessageWithTimerOnSnodeProps = {
  messageHashes: Array<string>;
  expireTimerMs: number;
  readAt: number;
} & WithShortenOrExtend;

export type ExpireMessageWithExpiryOnSnodeProps = Pick<
  ExpireMessageWithTimerOnSnodeProps,
  'messageHashes'
> &
  WithShortenOrExtend & {
    expiryMs: number;
  };

/**
 * Exported for testing for testing only. Used to shorten/extend expiries of an array of array of messagehashes.
 * @param expireDetails the subrequest to do
 * @returns
 */
export async function buildExpireRequestBatchExpiry(
  expireDetails: Array<ExpireMessageWithExpiryOnSnodeProps>
) {
  if (expireDetails.length > MAX_SUBREQUESTS_COUNT) {
    throw new Error(`batch request can only have ${MAX_SUBREQUESTS_COUNT} subrequests at most`);
  }
  const results = await Promise.all(expireDetails.map(m => buildExpireRequestSingleExpiry(m)));
  return compact(results);
}

export async function buildExpireRequestSingleExpiry(
  expireDetails: ExpireMessageWithExpiryOnSnodeProps
): Promise<UpdateExpiryOnNodeSubRequest | null> {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('[buildExpireRequestSingleExpiry] No user pubkey');
    return null;
  }
  const { messageHashes, expiryMs, shortenOrExtend } = expireDetails;

  // NOTE for shortenOrExtend, '' means we want to hardcode the expiry to a TTL value, otherwise it's a shorten or extension of the TTL

  const signResult = await SnodeSignature.generateUpdateExpirySignature({
    shortenOrExtend,
    timestamp: expiryMs,
    messageHashes,
  });

  if (!signResult) {
    window.log.error(
      `[buildExpireRequestSingleExpiry] SnodeSignature.generateUpdateExpirySignature returned an empty result`
    );
    return null;
  }
  return {
    method: 'expire' as const,
    params: {
      pubkey: ourPubKey,
      pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
      messages: messageHashes,
      expiry: expiryMs,
      extend: shortenOrExtend === 'extend' || undefined,
      shorten: shortenOrExtend === 'shorten' || undefined,
      signature: signResult?.signature,
    },
  };
}

type GroupedBySameExpiry = Record<string, Array<string>>;

function getBatchExpiryChunk({
  expiryChunk,
  groupedBySameExpiry,
  shortenOrExtend,
}: {
  expiryChunk: Array<string>;
} & WithShortenOrExtend & { groupedBySameExpiry: GroupedBySameExpiry }) {
  const expiryDetails: Array<ExpireMessageWithExpiryOnSnodeProps> = expiryChunk.map(expiryStr => {
    const expiryMs = parseInt(expiryStr, 10);
    const msgHashesForThisExpiry = groupedBySameExpiry[expiryStr];

    return {
      expiryMs,
      messageHashes: msgHashesForThisExpiry,
      shortenOrExtend,
    };
  });

  return buildExpireRequestBatchExpiry(expiryDetails);
}

function groupMsgByExpiry(expiringDetails: ExpiringDetails) {
  const hashesWithExpiry = uniqBy(
    expiringDetails.map(m => ({
      messageHash: m.messageHash,
      expiry: m.expireTimerMs + m.readAt,
    })),
    n => n.messageHash
  );

  const groupedBySameExpiry: GroupedBySameExpiry = {};
  for (let index = 0; index < hashesWithExpiry.length; index++) {
    const { expiry, messageHash } = hashesWithExpiry[index];
    const expiryStr = `${expiry}`;
    if (!groupedBySameExpiry[expiryStr]) {
      groupedBySameExpiry[expiryStr] = [];
    }
    groupedBySameExpiry[expiryStr].push(messageHash);
  }

  Object.keys(groupedBySameExpiry).forEach(k => {
    if (groupedBySameExpiry[k].length === 1) {
      // We need to have at least 2 hashes until the next storage server release
      groupedBySameExpiry[k].push(fakeHash);
    }
  });

  return groupedBySameExpiry;
}

export type ExpiringDetails = Array<
  { messageHash: string } & Pick<ExpireMessageWithTimerOnSnodeProps, 'readAt' | 'expireTimerMs'>
>;

/**
 * Sends an 'expire' request to the user's swarm for a specific message.
 * This supports both extending and shortening a message's TTL.
 * The returned TTL should be assigned to the message to expire.
 * @param messageHash the hash of the message to expire
 * @param readAt when that message was read on this device (network timestamp offset is removed later)
 * @param expireTimer amount of time until we expire the message from now in milliseconds
 * @param extend whether to extend the message's TTL
 * @param shorten whether to shorten the message's TTL
 * @returns the TTL of the message as set by the server
 */
export async function expireMessagesOnSnode(
  expiringDetails: ExpiringDetails,
  options: WithShortenOrExtend
): Promise<Array<{ messageHash: string; updatedExpiryMs: number }>> {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    throw new Error('[expireMessageOnSnode] No pubkey found');
  }

  let snode: Snode | undefined;

  try {
    // key is a string even if it is really a number because Object.keys only knows strings...
    const groupedBySameExpiry = groupMsgByExpiry(expiringDetails);
    const chunkedExpiries = chunk(Object.keys(groupedBySameExpiry), MAX_SUBREQUESTS_COUNT); // chunking because the batch endpoint only allow MAX_SUBREQUESTS_COUNT subrequests per requests

    // TODO after the next storage server fork we will get a new endpoint allowing to batch
    // update expiries even when they are * not * the same for all the message hashes.
    // But currently we can't access it that endpoint, so we need to keep this hacky way for now.
    // groupby expiries ( expireTimer+ readAt), then batch them with a limit of MAX_SUBREQUESTS_COUNT batch calls per batch requests, then do those in parralel, for now.
    const expireRequestsParams = await Promise.all(
      chunkedExpiries.map(chk =>
        getBatchExpiryChunk({
          expiryChunk: chk,
          groupedBySameExpiry,
          shortenOrExtend: options.shortenOrExtend,
        })
      )
    );
    if (!expireRequestsParams || isEmpty(expireRequestsParams)) {
      throw new Error(`Failed to build expire request`);
    }

    // we most likely will only have a single chunk, so this is a bit of over engineered.
    // if any of those requests fails, make sure to not consider
    const allSettled = await Promise.allSettled(
      expireRequestsParams.map(chunkRequest =>
        pRetry(
          async () => {
            const swarm = await getSwarmFor(ourPubKey);
            snode = sample(swarm);
            if (!snode) {
              throw new EmptySwarmError(ourPubKey, 'Ran out of swarm nodes to query');
            }
            return updateExpiryOnNodes(snode, ourPubKey, chunkRequest);
          },
          {
            retries: 3,
            factor: 2,
            minTimeout: SeedNodeAPI.getMinTimeout(),
            onFailedAttempt: e => {
              window?.log?.warn(
                `[expireMessageOnSnode] expire message on snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
              );
            },
          }
        )
      )
    );

    return flatten(compact(allSettled.map(m => (m.status === 'fulfilled' ? m.value : null))));
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `[expireMessageOnSnode] ${e.code || ''}${
        e.message || e
      } by ${ourPubKey} via snode:${snodeStr}`
    );
    throw e;
  }
}
